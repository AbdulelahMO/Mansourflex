"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { buildPaymentSchedule } from "@/lib/payment-schedule";
import { runSensitive } from "@/lib/approvals";
import type { ActionState } from "@/lib/types";

const contractSchema = z.object({
  ejarContractNumber: z.string().trim().optional().or(z.literal("")),
  unitId: z.string().trim().min(1, "اختر الوحدة"),
  tenantId: z.string().trim().min(1, "اختر المستأجر"),
  startDate: z.string().trim().min(1, "تاريخ البداية مطلوب"),
  endDate: z.string().trim().min(1, "تاريخ النهاية مطلوب"),
  rentAmount: z.string().trim().min(1, "قيمة العقد مطلوبة"),
  amountType: z.enum(["TOTAL", "ANNUAL", "INCREASING"]),
  increasePercent: z.string().trim().optional().or(z.literal("")),
  vatRate: z.enum(["0", "5", "10", "15"]),
  depositAmount: z.string().trim().optional().or(z.literal("")),
  paymentFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "ONE_TIME"]),
  notes: z.string().trim().optional().or(z.literal("")),
});

/**
 * Contract numbers are issued by the system, not typed in: derived from the highest number
 * already used this year so deleting a contract never makes the next one collide.
 */
async function nextContractNumber() {
  const year = new Date().getFullYear();
  const scope = `C-${year}-`;
  const issued = await prisma.contract.findMany({
    where: { contractNumber: { startsWith: scope } },
    select: { contractNumber: true },
  });
  const highest = issued.reduce((max, c) => {
    const seq = Number(c.contractNumber.slice(scope.length));
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `${scope}${String(highest + 1).padStart(4, "0")}`;
}

export async function createContract(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePermission("contracts.create");

  const parsed = contractSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);
  if (endDate <= startDate) {
    return { error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" };
  }
  const rentAmount = Number(data.rentAmount);
  if (!Number.isFinite(rentAmount) || rentAmount <= 0) {
    return { error: "قيمة العقد غير صحيحة" };
  }
  const increasePercent = data.increasePercent ? Number(data.increasePercent) : 0;
  if (data.amountType === "INCREASING" && (!Number.isFinite(increasePercent) || increasePercent <= 0)) {
    return { error: "أدخل نسبة الزيادة السنوية" };
  }

  const vatRate = Number(data.vatRate);
  const schedule = buildPaymentSchedule(startDate, endDate, rentAmount, data.paymentFrequency, data.amountType, increasePercent, vatRate);

  const created = await prisma.$transaction(async (tx) => {
    const contract = await tx.contract.create({
      data: {
        contractNumber: await nextContractNumber(),
        createdById: user.id,
        ejarContractNumber: data.ejarContractNumber || null,
        unitId: data.unitId,
        tenantId: data.tenantId,
        startDate,
        endDate,
        rentAmount,
        amountType: data.amountType,
        increasePercent: data.amountType === "INCREASING" ? increasePercent : null,
        vatRate,
        depositAmount: data.depositAmount ? Number(data.depositAmount) : null,
        paymentFrequency: data.paymentFrequency,
        notes: data.notes || null,
        status: "ACTIVE",
        payments: { create: schedule.map((p) => ({ dueDate: p.dueDate, amount: p.amount })) },
      },
    });

    await tx.unit.update({ where: { id: data.unitId }, data: { status: "OCCUPIED" } });

    return contract;
  });

  await recordAudit({ user, action: "contracts.create", summary: `إنشاء عقد ${created.contractNumber}`, targetId: created.id });

  revalidatePath("/contracts");
  revalidatePath("/units");
  revalidatePath("/payments");
  redirect("/contracts");
}

/** Contract fields that carry no consequence for the instalment schedule. */
const contractDetailsSchema = z.object({
  ejarContractNumber: z.string().trim().optional().or(z.literal("")),
  depositAmount: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
});

/** The terms the schedule is built from — changing any of them rebuilds it. */
const contractTermsSchema = z.object({
  startDate: z.string().trim().min(1, "تاريخ البداية مطلوب"),
  endDate: z.string().trim().min(1, "تاريخ النهاية مطلوب"),
  rentAmount: z.string().trim().min(1, "قيمة العقد مطلوبة"),
  amountType: z.enum(["TOTAL", "ANNUAL", "INCREASING"]),
  increasePercent: z.string().trim().optional().or(z.literal("")),
  vatRate: z.enum(["0", "5", "10", "15"]),
  paymentFrequency: z.enum(["MONTHLY", "QUARTERLY", "SEMI_ANNUAL", "ANNUAL", "ONE_TIME"]),
});

/**
 * Correcting a contract. The unit and the tenant are not among the fields: a lease with another
 * tenant is another lease, not a correction of this one.
 *
 * The terms behind the schedule are a different matter from the rest. Changing them rebuilds
 * the instalments — and an instalment that carries a financial document is never rebuilt, since
 * deleting it would take an issued invoice or receipt down with it. Those instalments stay as
 * billed and the new terms apply from the ones after them. Only the administrator may change
 * the terms once anything has been issued; for everyone else they are locked.
 */
export async function updateContract(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePermission("contracts.edit");

  const contract = await prisma.contract.findUnique({
    where: { id },
    include: { payments: { orderBy: { dueDate: "asc" }, include: { documents: { select: { id: true } } } } },
  });
  if (!contract) return { error: "العقد غير موجود" };

  const details = contractDetailsSchema.safeParse(Object.fromEntries(formData));
  if (!details.success) {
    return { error: "تحقق من الحقول", fieldErrors: details.error.flatten().fieldErrors };
  }

  const terms = contractTermsSchema.safeParse(Object.fromEntries(formData));
  if (!terms.success) {
    return { error: "تحقق من الحقول", fieldErrors: terms.error.flatten().fieldErrors };
  }
  const t = terms.data;

  const startDate = new Date(t.startDate);
  const endDate = new Date(t.endDate);
  const rentAmount = Number(t.rentAmount);
  const vatRate = Number(t.vatRate);
  const increasePercent = t.amountType === "INCREASING" ? Number(t.increasePercent || 0) : 0;

  if (endDate <= startDate) return { error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" };
  if (!Number.isFinite(rentAmount) || rentAmount <= 0) return { error: "قيمة العقد غير صحيحة" };
  if (t.amountType === "INCREASING" && increasePercent <= 0) {
    return { error: "نسبة الزيادة السنوية مطلوبة للعقد المتزايد" };
  }

  const termsChanged =
    startDate.getTime() !== contract.startDate.getTime() ||
    endDate.getTime() !== contract.endDate.getTime() ||
    rentAmount !== contract.rentAmount ||
    t.amountType !== contract.amountType ||
    increasePercent !== (contract.increasePercent ?? 0) ||
    vatRate !== contract.vatRate ||
    t.paymentFrequency !== contract.paymentFrequency;

  // An instalment is kept if anything has happened on it: a document, or money recorded before
  // documents were mandatory. Rebuilding it would delete an issued invoice with it, or erase a
  // collection that no longer has any other record.
  const documented = contract.payments.filter((p) => p.documents.length > 0 || (p.paidAmount ?? 0) > 0);

  if (termsChanged && documented.length > 0 && user.role !== "ADMIN") {
    return {
      error: `لا يمكن تعديل شروط العقد بعد تحصيل أو إصدار مستندات على ${documented.length} من أقساطه — راجع مدير النظام.`,
    };
  }

  const detailsData = {
    ejarContractNumber: details.data.ejarContractNumber || null,
    depositAmount: details.data.depositAmount ? Number(details.data.depositAmount) : null,
    notes: details.data.notes || null,
  };

  if (!termsChanged) {
    await prisma.contract.update({ where: { id }, data: detailsData });
    await recordAudit({ user, action: "contracts.edit", summary: `تعديل بيانات العقد ${contract.contractNumber}`, targetId: id });
    revalidatePath(`/contracts/${id}`);
    revalidatePath("/contracts");
    return { success: true, message: "تم حفظ التعديلات" };
  }

  const schedule = buildPaymentSchedule(
    startDate,
    endDate,
    rentAmount,
    t.paymentFrequency,
    t.amountType,
    increasePercent,
    vatRate
  );
  if (schedule.length === 0) return { error: "تعذر توليد جدول الدفعات — راجع التواريخ" };

  // Everything already billed stands; the new terms take effect after the last of it.
  const keptUntil = documented.reduce<Date | null>(
    (latest, p) => (!latest || p.dueDate > latest ? p.dueDate : latest),
    null
  );
  const replaceable = contract.payments.filter((p) => p.documents.length === 0 && !(p.paidAmount ?? 0));
  const fresh = keptUntil ? schedule.filter((p) => p.dueDate > keptUntil) : schedule;

  await prisma.$transaction([
    prisma.payment.deleteMany({ where: { id: { in: replaceable.map((p) => p.id) } } }),
    prisma.contract.update({
      where: { id },
      data: {
        ...detailsData,
        startDate,
        endDate,
        rentAmount,
        amountType: t.amountType,
        increasePercent: t.amountType === "INCREASING" ? increasePercent : null,
        vatRate,
        paymentFrequency: t.paymentFrequency,
        payments: { create: fresh.map((p) => ({ dueDate: p.dueDate, amount: p.amount })) },
      },
    }),
  ]);

  await recordAudit({
    user,
    action: "contracts.edit",
    summary: `تعديل شروط العقد ${contract.contractNumber} وإعادة توليد ${fresh.length} قسطاً${
      documented.length ? ` مع إبقاء ${documented.length} قسطاً عليها تحصيل أو مستندات` : ""
    }`,
    targetId: id,
  });

  revalidatePath(`/contracts/${id}`);
  revalidatePath("/contracts");
  revalidatePath("/payments");
  return {
    success: true,
    message: documented.length
      ? `تم الحفظ — أُبقيت ${documented.length} قسطاً عليها تحصيل أو مستندات، وأُعيد توليد ${fresh.length} قسطاً بالشروط الجديدة`
      : `تم الحفظ وأُعيد توليد ${fresh.length} قسطاً`,
  };
}

export async function updateContractStatus(id: string, status: "ACTIVE" | "EXPIRED" | "TERMINATED"): Promise<ActionState> {
  await requirePermission("contracts.edit");

  const contract = await prisma.contract.findUnique({ where: { id } });
  if (!contract) return { error: "العقد غير موجود" };

  await prisma.contract.update({ where: { id }, data: { status } });

  if (status !== "ACTIVE") {
    await prisma.unit.update({ where: { id: contract.unitId }, data: { status: "VACANT" } });
  }

  revalidatePath("/contracts");
  revalidatePath("/units");
  return { success: true };
}

export async function deleteContract(id: string, reason?: string): Promise<ActionState> {
  return runSensitive("contracts.delete", { id }, reason);
}



/**
 * Renews as a fresh contract for the same unit and tenant: its own number, term, rent and
 * schedule, linked back to the contract it replaces so the history stays traceable.
 */
export async function renewContract(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requirePermission("contracts.renew");

  const { user } = await requirePermission("contracts.renew");
  const previous = await prisma.contract.findUnique({ where: { id }, include: { renewedTo: true } });
  if (!previous) return { error: "العقد غير موجود" };
  if (previous.status === "TERMINATED") return { error: "لا يمكن تجديد عقد مفسوخ" };
  if (previous.renewedTo) return { error: `سبق تجديد هذا العقد (${previous.renewedTo.contractNumber})` };

  const startDate = new Date(String(formData.get("startDate") ?? ""));
  const endDate = new Date(String(formData.get("endDate") ?? ""));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return { error: "تواريخ العقد غير صحيحة" };
  if (endDate <= startDate) return { error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية" };

  const rentAmount = Number(formData.get("rentAmount") ?? 0);
  if (!Number.isFinite(rentAmount) || rentAmount <= 0) return { error: "قيمة الإيجار غير صحيحة" };

  const increasePercent = previous.amountType === "INCREASING" ? previous.increasePercent ?? 0 : 0;
  const schedule = buildPaymentSchedule(
    startDate,
    endDate,
    rentAmount,
    previous.paymentFrequency,
    previous.amountType as "TOTAL" | "ANNUAL" | "INCREASING",
    increasePercent,
    previous.vatRate
  );
  if (schedule.length === 0) return { error: "تعذر توليد جدول الدفعات — راجع التواريخ" };

  const created = await prisma.$transaction(async (tx) => {
    const contract = await tx.contract.create({
      data: {
        contractNumber: await nextContractNumber(),
        createdById: user.id,
        ejarContractNumber: String(formData.get("ejarContractNumber") ?? "").trim() || null,
        unitId: previous.unitId,
        tenantId: previous.tenantId,
        startDate,
        endDate,
        rentAmount,
        amountType: previous.amountType,
        increasePercent: previous.amountType === "INCREASING" ? increasePercent : null,
        vatRate: previous.vatRate,
        depositAmount: previous.depositAmount,
        paymentFrequency: previous.paymentFrequency,
        notes: String(formData.get("notes") ?? "").trim() || null,
        status: "ACTIVE",
        renewedFromId: previous.id,
        payments: { create: schedule.map((p) => ({ dueDate: p.dueDate, amount: p.amount })) },
      },
    });

    // The old contract has been replaced; it is finished whatever its previous state was.
    await tx.contract.update({ where: { id: previous.id }, data: { status: "EXPIRED" } });
    await tx.unit.update({ where: { id: previous.unitId }, data: { status: "OCCUPIED" } });

    return contract;
  });

  await recordAudit({
    user,
    action: "contracts.renew",
    summary: `تجديد العقد ${previous.contractNumber} بعقد جديد ${created.contractNumber}`,
    targetId: created.id,
  });

  revalidatePath("/contracts");
  revalidatePath("/payments");
  redirect(`/contracts/${created.id}`);
}
