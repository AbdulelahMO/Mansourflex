"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { saveUploadedFile } from "@/lib/uploads";
import { issueVoucherForExpense } from "@/lib/documents-core";
import { runSensitive } from "@/lib/approvals";
import type { ActionState } from "@/lib/types";

const expenseSchema = z.object({
  buildingId: z.string().min(1, "المبنى مطلوب"),
  unitId: z.string().optional(),
  category: z.enum([
    "MAINTENANCE",
    "PLUMBING",
    "RENOVATION",
    "ELECTRICITY",
    "WATER",
    "CLEANING",
    "SECURITY",
    "GOVERNMENT_FEES",
    "INSURANCE",
    "OTHER",
  ]),
  description: z.string().trim().min(1, "الوصف مطلوب"),
  amount: z.string().trim().min(1, "المبلغ مطلوب"),
  vendor: z.string().trim().optional(),
  expenseDate: z.string().min(1, "تاريخ الفاتورة مطلوب"),
  paidDate: z.string().optional(),
  bearer: z.enum(["OWNER", "TENANT", "OPERATOR"]),
  notes: z.string().trim().optional(),
});

async function saveInvoiceFile(formData: FormData) {
  const file = formData.get("expenseFile");
  if (!(file instanceof File) || file.size === 0) return { url: undefined };
  try {
    return { url: await saveUploadedFile(file, "expenses") };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "تعذر رفع الملف" };
  }
}

function parseForm(formData: FormData) {
  return expenseSchema.safeParse({
    buildingId: String(formData.get("buildingId") ?? ""),
    unitId: String(formData.get("unitId") ?? ""),
    category: String(formData.get("category") || "MAINTENANCE"),
    description: String(formData.get("description") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    vendor: String(formData.get("vendor") ?? ""),
    expenseDate: String(formData.get("expenseDate") ?? ""),
    paidDate: String(formData.get("paidDate") ?? ""),
    bearer: String(formData.get("bearer") || "OWNER"),
    notes: String(formData.get("notes") ?? ""),
  });
}

/** The unit, when given, must belong to the chosen building. */
async function invalidUnit(buildingId: string, unitId?: string) {
  if (!unitId) return null;
  const unit = await prisma.unit.findFirst({ where: { id: unitId, buildingId }, select: { id: true } });
  return unit ? null : "الوحدة المختارة لا تتبع هذا المبنى";
}

function toData(d: z.infer<typeof expenseSchema>, amount: number) {
  return {
    buildingId: d.buildingId,
    unitId: d.unitId || null,
    category: d.category,
    description: d.description,
    amount,
    vendor: d.vendor || null,
    expenseDate: new Date(d.expenseDate),
    paidDate: d.paidDate ? new Date(d.paidDate) : null,
    bearer: d.bearer,
    notes: d.notes || null,
  };
}

export async function createExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePermission("expenses.create");

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "تحقق من الحقول" };
  const d = parsed.data;

  const amount = Number(d.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "المبلغ غير صحيح" };

  const unitError = await invalidUnit(d.buildingId, d.unitId);
  if (unitError) return { error: unitError };

  const file = await saveInvoiceFile(formData);
  if (file.error) return { error: file.error };

  const created = await prisma.expense.create({
    data: { ...toData(d, amount), createdById: user.id, ...(file.url ? { fileUrl: file.url } : {}) },
  });
  await recordAudit({
    user,
    action: "expenses.create",
    summary: `تسجيل مصروف «${d.description}» بمبلغ ${amount}`,
    targetId: created.id,
  });

  revalidatePath("/expenses");
  revalidatePath(`/buildings/${d.buildingId}`);
  return { success: true, message: "تم تسجيل المصروف" };
}

export async function updateExpense(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("expenses.edit");

  const parsed = parseForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "تحقق من الحقول" };
  const d = parsed.data;

  const amount = Number(d.amount);
  if (!Number.isFinite(amount) || amount <= 0) return { error: "المبلغ غير صحيح" };

  const unitError = await invalidUnit(d.buildingId, d.unitId);
  if (unitError) return { error: unitError };

  // The voucher evidences a disbursement that happened; unpaying the expense would leave it dangling.
  if (!d.paidDate) {
    const voucher = await prisma.financialDocument.findFirst({
      where: { expenseId: id, type: "PAYMENT_VOUCHER" },
      select: { documentNumber: true },
    });
    if (voucher) {
      return { error: `لا يمكن إلغاء السداد لوجود سند صرف صادر (${voucher.documentNumber}) — احذف السند أولاً.` };
    }
  }

  const file = await saveInvoiceFile(formData);
  if (file.error) return { error: file.error };

  // Only replace the stored invoice when a new file was actually attached.
  await prisma.expense.update({
    where: { id },
    data: { ...toData(d, amount), ...(file.url ? { fileUrl: file.url } : {}) },
  });

  revalidatePath("/expenses");
  revalidatePath(`/buildings/${d.buildingId}`);
  return { success: true, message: "تم حفظ التعديلات" };
}

/**
 * Settles a supplier invoice: stamps the disbursement date and, unless asked otherwise,
 * issues the voucher that evidences it. An expense is settled in one go, never partially.
 */
export async function payExpense(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePermission("expenses.pay");

  const expense = await prisma.expense.findUnique({ where: { id } });
  if (!expense) return { error: "المصروف غير موجود" };
  if (expense.paidDate) return { error: "سبق سداد هذا المصروف" };

  const paidRaw = String(formData.get("paidDate") ?? "").trim();
  if (!paidRaw) return { error: "تاريخ الصرف مطلوب" };
  const paidDate = new Date(paidRaw);
  if (Number.isNaN(paidDate.getTime())) return { error: "تاريخ الصرف غير صحيح" };
  if (paidDate < expense.expenseDate) return { error: "تاريخ الصرف يسبق تاريخ الفاتورة" };

  const note = String(formData.get("notes") ?? "").trim();
  await prisma.expense.update({
    where: { id },
    data: { paidDate, ...(note ? { notes: note } : {}) },
  });

  await recordAudit({
    user,
    action: "expenses.pay",
    summary: `سداد المصروف «${expense.description}» بمبلغ ${expense.amount}`,
    targetId: id,
  });

  let message = "تم تسجيل السداد";
  if (formData.get("issueVoucher") === "on") {
    const res = await issueVoucherForExpense(id, user.id);
    message = res.ok ? `تم تسجيل السداد وإصدار سند الصرف ${res.documentNumber}` : `تم تسجيل السداد، لكن ${res.error}`;
  }

  revalidatePath("/expenses");
  revalidatePath("/documents");
  revalidatePath(`/buildings/${expense.buildingId}`);
  return { success: true, message };
}

/** Issues the voucher separately — for an expense settled before this feature, or after a cancelled voucher. */
export async function createExpenseVoucher(id: string): Promise<ActionState> {
  const { user } = await requirePermission("documents.issue");

  const res = await issueVoucherForExpense(id, user.id);
  if (!res.ok) return { error: res.error };

  await recordAudit({ user, action: "documents.issue", summary: `إصدار سند صرف ${res.documentNumber}`, targetId: id });

  revalidatePath("/expenses");
  revalidatePath("/documents");
  return { success: true, message: `تم إصدار سند الصرف ${res.documentNumber}` };
}

export async function deleteExpense(id: string, reason?: string): Promise<ActionState> {
  return runSensitive("expenses.delete", { id }, reason);
}
