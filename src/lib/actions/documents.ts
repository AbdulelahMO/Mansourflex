"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission, recordAudit } from "@/lib/authz";
import { runSensitive } from "@/lib/approvals";
import type { ActionState } from "@/lib/types";
import { createDocumentWithNumber } from "@/lib/documents-core";

async function loadPaymentWithOwner(paymentId: string) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    include: { contract: { include: { unit: { include: { building: { include: { owner: true } } } } } } },
  });
}

export async function createInvoice(paymentId: string): Promise<ActionState> {
  const { user } = await requirePermission("documents.issue");

  const payment = await loadPaymentWithOwner(paymentId);
  if (!payment) return { error: "الدفعة غير موجودة" };

  // One invoice per payment — receipts stay unrestricted so each partial payment can get its own.
  const existingInvoice = await prisma.financialDocument.findFirst({
    where: { paymentId, type: "INVOICE", status: { not: "CANCELLED" } },
    select: { documentNumber: true },
  });
  if (existingInvoice) {
    return { error: `سبق إصدار فاتورة لهذه الدفعة (${existingInvoice.documentNumber})` };
  }

  // The contract's rate decides whether this is a tax invoice; the owner's number is printed on it.
  const taxNumber = payment.contract.unit.building.owner.taxNumber?.trim() || null;

  const doc = await createDocumentWithNumber("INVOICE", {
    status: "ISSUED",
    amount: payment.amount,
    hasTax: payment.contract.vatRate > 0,
    taxNumber,
    paymentId: payment.id,
    contractId: payment.contract.id,
    issuedById: user.id,
  });

  await recordAudit({ user, action: "documents.issue", summary: `إصدار الفاتورة ${doc.documentNumber}`, targetId: doc.id });

  revalidatePath("/documents");
  revalidatePath(`/contracts/${payment.contract.id}`);
  return { success: true, message: "تم إصدار الفاتورة" };
}

/** Financial documents are never removed — they are voided and keep their number as a trace. */
export async function cancelFinancialDocument(id: string, reason?: string): Promise<ActionState> {
  return runSensitive("documents.cancel", { id, reason }, reason);
}
