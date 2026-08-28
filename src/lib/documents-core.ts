import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

/**
 * Next sequence number for the type/year, derived from the highest number already issued —
 * not from the row count, which would reuse a number after any document is deleted and
 * collide with the `documentNumber` unique constraint.
 */
export type DocumentKind = "INVOICE" | "RECEIPT" | "PAYMENT_VOUCHER" | "OWNER_REMITTANCE";

const NUMBER_PREFIX: Record<DocumentKind, string> = {
  INVOICE: "INV",
  RECEIPT: "RCT",
  PAYMENT_VOUCHER: "PV",
  OWNER_REMITTANCE: "REM",
};

export async function nextDocumentNumber(type: DocumentKind) {
  const prefix = NUMBER_PREFIX[type];
  const year = new Date().getFullYear();
  const scope = `${prefix}-${year}-`;

  const issued = await prisma.financialDocument.findMany({
    where: { type, documentNumber: { startsWith: scope } },
    select: { documentNumber: true },
  });

  const highest = issued.reduce((max, d) => {
    const seq = Number(d.documentNumber.slice(scope.length));
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);

  return `${scope}${String(highest + 1).padStart(4, "0")}`;
}

/**
 * Creates the document, retrying if a concurrent create claimed the same number first
 * (the unique constraint on `documentNumber` surfaces as P2002).
 */
export async function createDocumentWithNumber(
  type: DocumentKind,
  data: Omit<Prisma.FinancialDocumentUncheckedCreateInput, "documentNumber" | "type">
) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.financialDocument.create({
        data: { ...data, type, documentNumber: await nextDocumentNumber(type) },
      });
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "P2002" || attempt === 4) throw err;
    }
  }
  throw new Error("تعذر إصدار رقم مستند فريد");
}

/**
 * Amount still awaiting a receipt on a payment: what has been collected minus what
 * previous receipts already acknowledged. Receipts must sum to `paidAmount`, never exceed it.
 */
export async function unreceiptedAmount(paymentId: string, paidAmount: number | null) {
  const receipts = await prisma.financialDocument.findMany({
    where: { paymentId, type: "RECEIPT", status: { not: "CANCELLED" } },
    select: { amount: true },
  });
  const acknowledged = receipts.reduce((sum, r) => sum + r.amount, 0);
  return Math.max(0, (paidAmount ?? 0) - acknowledged);
}

export type IssueReceiptResult =
  | { ok: true; documentNumber: string; invoiceNumber?: string }
  | { ok: false; error: string };

/**
 * Issues a receipt for whatever has been collected on the payment but not yet receipted.
 * Shared by the manual button and the automatic issue on recording a payment, so both
 * apply the same rules, and the amount is this collection only.
 *
 * A receipt acknowledges payment against an invoice, so the invoice must exist — and when it
 * does not, it is raised here for the full instalment rather than refusing the receipt. The
 * instalment schedule comes from the contract, not from invoices, so a payment can be settled
 * long before anyone thinks to bill it; making the operator issue the invoice by hand first
 * only meant collections went unreceipted.
 */
export async function issueReceiptForPayment(paymentId: string, issuedById?: string): Promise<IssueReceiptResult> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { contract: { include: { unit: { include: { building: { include: { owner: true } } } } } } },
  });
  if (!payment) return { ok: false, error: "الدفعة غير موجودة" };

  if (!payment.paidAmount || payment.paidAmount <= 0) {
    return { ok: false, error: "لا يمكن إصدار سند قبض قبل تسجيل دفعة" };
  }

  const amount = await unreceiptedAmount(paymentId, payment.paidAmount);
  if (amount <= 0) {
    return { ok: false, error: "تم إصدار سندات قبض بكامل المبلغ المحصّل لهذه الدفعة" };
  }

  // The owner's tax registration decides whether both documents are tax documents.
  const taxNumber = payment.contract.unit.building.owner.taxNumber?.trim() || null;

  const invoice = await prisma.financialDocument.findFirst({
    where: { paymentId, type: "INVOICE", status: { not: "CANCELLED" } },
    select: { documentNumber: true },
  });

  // The invoice is for the whole instalment; the receipt covers only what has been collected.
  const raised = invoice
    ? null
    : await createDocumentWithNumber("INVOICE", {
        status: "ISSUED",
        amount: payment.amount,
        hasTax: !!taxNumber,
        taxNumber,
        paymentId: payment.id,
        contractId: payment.contract.id,
        issuedById: issuedById ?? null,
      });

  const doc = await createDocumentWithNumber("RECEIPT", {
    status: "ISSUED",
    amount,
    hasTax: !!taxNumber,
    taxNumber,
    paymentId: payment.id,
    contractId: payment.contract.id,
    issuedById: issuedById ?? null,
  });

  return { ok: true, documentNumber: doc.documentNumber, ...(raised ? { invoiceNumber: raised.documentNumber } : {}) };
}

/**
 * Issues the disbursement voucher for a settled expense. One voucher per expense — an expense
 * is paid in full in a single go, so a second voucher would double-count the disbursement.
 */
export async function issueVoucherForExpense(expenseId: string, issuedById?: string) {
  const expense = await prisma.expense.findUnique({
    where: { id: expenseId },
    include: { building: { include: { owner: true } } },
  });
  if (!expense) return { ok: false as const, error: "المصروف غير موجود" };
  if (!expense.paidDate) return { ok: false as const, error: "لا يصدر سند صرف لمصروف لم يُسدَّد بعد" };

  const existing = await prisma.financialDocument.findFirst({
    where: { expenseId, type: "PAYMENT_VOUCHER", status: { not: "CANCELLED" } },
    select: { documentNumber: true },
  });
  if (existing) {
    return { ok: false as const, error: `سبق إصدار سند صرف لهذا المصروف (${existing.documentNumber})` };
  }

  const doc = await createDocumentWithNumber("PAYMENT_VOUCHER", {
    status: "ISSUED",
    amount: expense.amount,
    issueDate: expense.paidDate,
    expenseId,
    issuedById: issuedById ?? null,
  });
  return { ok: true as const, documentNumber: doc.documentNumber, id: doc.id };
}
