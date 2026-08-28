"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { issueReceiptForPayment } from "@/lib/documents-core";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const markPaidSchema = z.object({
  paidAmount: z.string().trim().min(1, "المبلغ مطلوب"),
  paidDate: z.string().trim().min(1, "تاريخ الدفع مطلوب"),
  method: z.string().trim().optional().or(z.literal("")),
  recipient: z.enum(["OPERATOR", "OWNER"]).optional(),
  reference: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
  issueReceipt: z.string().optional(),
});

export async function markPaymentPaid(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const { user } = await requirePermission("payments.pay");

  const parsed = markPaidSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "تحقق من الحقول", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const data = parsed.data;

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return { error: "الدفعة غير موجودة" };

  const newlyPaid = Number(data.paidAmount);
  if (!Number.isFinite(newlyPaid) || newlyPaid <= 0) {
    return { error: "المبلغ غير صحيح" };
  }

  const paidDate = new Date(data.paidDate);
  const remainingOn = (p: { amount: number; paidAmount: number | null }) =>
    Math.max(0, p.amount - (p.paidAmount ?? 0));

  // Anything beyond this payment's remainder rolls onto the upcoming payments of the same
  // contract, oldest first. The plan is settled in full before anything is written, so an
  // amount that cannot be placed is rejected without leaving a partial update behind.
  const upcoming = await prisma.payment.findMany({
    where: {
      contractId: payment.contractId,
      id: { not: payment.id },
      status: { not: "PAID" },
      dueDate: { gte: payment.dueDate },
    },
    orderBy: [{ dueDate: "asc" }],
  });

  const allocations: { payment: typeof payment; add: number; carried: boolean }[] = [];
  let left = newlyPaid;

  const firstAdd = Math.min(left, remainingOn(payment));
  if (firstAdd > 0) {
    allocations.push({ payment, add: firstAdd, carried: false });
    left -= firstAdd;
  }
  for (const next of upcoming) {
    if (left <= 0) break;
    const room = remainingOn(next);
    if (room <= 0) continue;
    const add = Math.min(left, room);
    allocations.push({ payment: next, add, carried: true });
    left -= add;
  }

  if (left > 0) {
    return {
      error: `المبلغ يتجاوز المستحق على هذا العقد بمقدار ${formatCurrency(left)} — لا توجد دفعات قادمة لترحيل الفائض إليها.`,
    };
  }

  const carryNote = `مبلغ مرحّل من دفعة ${formatDate(payment.dueDate)}`;
  await prisma.$transaction(
    allocations.map(({ payment: p, add, carried }) => {
      const total = (p.paidAmount ?? 0) + add;
      return prisma.payment.update({
        where: { id: p.id },
        data: {
          paidAmount: total,
          paidDate,
          collectedById: user.id,
          method: data.method || null,
          recipient: data.recipient ?? null,
          reference: data.reference || null,
          notes: carried ? carryNote : data.notes || null,
          status: total >= p.amount ? "PAID" : "PARTIAL",
        },
      });
    })
  );

  await recordAudit({
    user,
    action: "payments.pay",
    summary: `تسجيل تحصيل ${formatCurrency(newlyPaid)} على دفعة مستحقة ${formatDate(payment.dueDate)}`,
    targetId: payment.id,
  });

  revalidatePath("/payments");
  revalidatePath(`/contracts/${payment.contractId}`);

  const carried = allocations.filter((a) => a.carried);
  const carryMessage = carried.length
    ? ` ورُحّل ${formatCurrency(carried.reduce((s, a) => s + a.add, 0))} إلى ${
        carried.length === 1 ? `دفعة ${formatDate(carried[0].payment.dueDate)}` : `${carried.length} دفعات قادمة`
      }`
    : "";

  if (data.issueReceipt !== "on") {
    return { success: true, message: `تم تسجيل الدفعة${carryMessage}` };
  }

  // Recording money received and acknowledging it are one act — but only when an invoice
  // exists to receipt against. Never fail the payment itself over the receipt.
  const issued: string[] = [];
  const invoiced: string[] = [];
  let firstFailure: string | null = null;
  for (const { payment: p } of allocations) {
    const receipt = await issueReceiptForPayment(p.id, user.id);
    if (!receipt.ok) {
      firstFailure ??= receipt.error;
      continue;
    }
    issued.push(receipt.documentNumber);
    if (receipt.invoiceNumber) invoiced.push(receipt.invoiceNumber);
  }

  if (issued.length === 0) {
    return { success: true, message: `تم تسجيل الدفعة${carryMessage} — لم يُصدر سند: ${firstFailure}` };
  }
  // An instalment that was never billed is invoiced now, so the receipt has its invoice.
  const invoiceMessage = invoiced.length ? ` والفاتورة ${invoiced.join("، ")}` : "";
  return {
    success: true,
    message: `تم تسجيل الدفعة${carryMessage} وإصدار سند القبض ${issued.join("، ")}${invoiceMessage}`,
  };
}

export async function syncOverduePayments() {
  await prisma.payment.updateMany({
    where: { status: "PENDING", dueDate: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
}
