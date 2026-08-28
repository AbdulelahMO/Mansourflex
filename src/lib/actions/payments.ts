"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { issueReceiptForPayment, round2 } from "@/lib/documents-core";
import { runSensitive } from "@/lib/approvals";
import { formatCurrency, formatDate } from "@/lib/format";
import type { ActionState } from "@/lib/types";

const markPaidSchema = z.object({
  paidAmount: z.string().trim().min(1, "المبلغ مطلوب"),
  paidDate: z.string().trim().min(1, "تاريخ الدفع مطلوب"),
  method: z.string().trim().optional().or(z.literal("")),
  recipient: z.enum(["OPERATOR", "OWNER"]).optional(),
  reference: z.string().trim().optional().or(z.literal("")),
  notes: z.string().trim().optional().or(z.literal("")),
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
  // Rounded to the halala: 1583.33 − 934 is 649.3299999999999 in binary, and paying the
  // remainder exactly as the screen shows it would otherwise be rejected as an overpayment.
  const remainingOn = (p: { amount: number; paidAmount: number | null }) =>
    Math.max(0, round2(p.amount - (p.paidAmount ?? 0)));

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

  const firstAdd = round2(Math.min(left, remainingOn(payment)));
  if (firstAdd > 0) {
    allocations.push({ payment, add: firstAdd, carried: false });
    left = round2(left - firstAdd);
  }
  for (const next of upcoming) {
    if (left <= 0) break;
    const room = remainingOn(next);
    if (room <= 0) continue;
    const add = round2(Math.min(left, room));
    allocations.push({ payment: next, add, carried: true });
    left = round2(left - add);
  }

  if (left > 0) {
    return {
      error: `المبلغ يتجاوز المستحق على هذا العقد بمقدار ${formatCurrency(left)} — لا توجد دفعات قادمة لترحيل الفائض إليها.`,
    };
  }

  const carryNote = `مبلغ مرحّل من دفعة ${formatDate(payment.dueDate)}`;

  // Not one riyal is recorded without its receipt: the collection and the documents that
  // acknowledge it are written in a single transaction, so a receipt that cannot be issued
  // leaves the payment unrecorded rather than money standing in the books unacknowledged.
  let documents: { receipt: string; invoice?: string }[];
  try {
    documents = await prisma.$transaction(async (tx) => {
      const issued: { receipt: string; invoice?: string }[] = [];

      for (const { payment: p, add, carried } of allocations) {
        const total = round2((p.paidAmount ?? 0) + add);

        // An instalment the surplus rolls onto may already carry a collection of its own, with
        // its own method, reference and date. The carried amount is appended to its record —
        // never written over it, which would erase how the earlier money arrived.
        const held = (p.paidAmount ?? 0) > 0;
        const details =
          carried && held
            ? { notes: [p.notes, carryNote].filter(Boolean).join(" — ") }
            : {
                paidDate,
                collectedById: user.id,
                method: data.method || null,
                recipient: data.recipient ?? null,
                reference: data.reference || null,
                notes: carried ? carryNote : data.notes || null,
              };

        await tx.payment.update({
          where: { id: p.id },
          data: {
            paidAmount: total,
            ...details,
            status: total >= p.amount ? "PAID" : "PARTIAL",
          },
        });

        // The receipt is for this collection alone, not for whatever the instalment has
        // gathered before it — each handover of money gets its own acknowledgement.
        const receipt = await issueReceiptForPayment(p.id, { issuedById: user.id, db: tx, amount: add });
        if (!receipt.ok) throw new Error(receipt.error);
        issued.push({ receipt: receipt.documentNumber, invoice: receipt.invoiceNumber });
      }

      return issued;
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : "خطأ غير متوقع";
    return { error: `لم تُسجَّل الدفعة — تعذّر إصدار سند القبض: ${reason}` };
  }

  await recordAudit({
    user,
    action: "payments.pay",
    summary: `تسجيل تحصيل ${formatCurrency(newlyPaid)} على دفعة مستحقة ${formatDate(payment.dueDate)}`,
    targetId: payment.id,
  });

  revalidatePath("/payments");
  revalidatePath("/documents"); // كل تحصيل يُصدر سنده، فالسجل يتغيّر معه
  revalidatePath(`/contracts/${payment.contractId}`);

  const carried = allocations.filter((a) => a.carried);
  const carryMessage = carried.length
    ? ` ورُحّل ${formatCurrency(carried.reduce((s, a) => s + a.add, 0))} إلى ${
        carried.length === 1 ? `دفعة ${formatDate(carried[0].payment.dueDate)}` : `${carried.length} دفعات قادمة`
      }`
    : "";

  const receipts = documents.map((d) => d.receipt);
  const invoices = documents.map((d) => d.invoice).filter(Boolean) as string[];
  // An instalment that was never billed is invoiced now, so the receipt has its invoice.
  const invoiceMessage = invoices.length ? ` والفاتورة ${invoices.join("، ")}` : "";
  return {
    success: true,
    message: `تم تسجيل الدفعة${carryMessage} وإصدار سند القبض ${receipts.join("، ")}${invoiceMessage}`,
  };
}

/** Undoes one collection: the receipt is voided and its amount taken back off the instalment. */
export async function reverseCollection(receiptId: string, reason?: string): Promise<ActionState> {
  return runSensitive("payments.reverse", { id: receiptId, reason }, reason);
}

export async function syncOverduePayments() {
  await prisma.payment.updateMany({
    where: { status: "PENDING", dueDate: { lt: new Date() } },
    data: { status: "OVERDUE" },
  });
}
