import { prisma } from "@/lib/prisma";
import { round2 } from "@/lib/documents-core";
import { buildStatement, type Movement, type Period, type Statement } from "@/lib/tenant-statement-math";

export type StatementSummary = {
  /** Instalments already due and still short — the figure a collector acts on. */
  arrears: number;
  deposit: { held: number; applied: number; available: number };
  /** Collected but with no receipt behind it — should be zero, and is named when it is not. */
  unvouched: number;
};

/**
 * Gathers one contract's movements and states them as a ledger.
 *
 * The credit side is read from the receipts, not from `paidAmount`: the rule of the house is that
 * no riyal is recorded without a voucher, so the statement is built from the vouchers themselves
 * and any collection lacking one shows up as its own line rather than being quietly folded in.
 * A cancelled receipt acknowledges nothing and is left out — its number survives on the document,
 * which is where a cancellation belongs.
 *
 * Nothing that has not yet fallen due appears in it at all: the statement speaks of the account as
 * it stands on the day it is drawn, and rent owed next spring is not a debt today. The lease's own
 * schedule stays on the contract, which is where someone goes to read what is coming.
 */
export async function contractStatement(
  contractId: string,
  period: Period = {}
): Promise<{ statement: Statement; summary: StatementSummary }> {
  const [contract, payments, documents] = await Promise.all([
    prisma.contract.findUnique({
      where: { id: contractId },
      select: { depositAmount: true, depositApplied: true },
    }),
    prisma.payment.findMany({
      where: { contractId },
      orderBy: { dueDate: "asc" },
      select: { id: true, dueDate: true, amount: true, paidAmount: true, paidDate: true, method: true },
    }),
    prisma.financialDocument.findMany({
      where: { contractId, status: { not: "CANCELLED" } },
      orderBy: { issueDate: "asc" },
      select: { id: true, type: true, documentNumber: true, issueDate: true, amount: true, paymentId: true },
    }),
  ]);

  // A payment carries at most one invoice, so the charge line can name the bill raised for it.
  const invoiceByPayment = new Map(
    documents.filter((d) => d.type === "INVOICE" && d.paymentId).map((d) => [d.paymentId as string, d.documentNumber])
  );

  const movements: Movement[] = payments.map((p) => ({
    date: p.dueDate,
    kind: "CHARGE",
    label: "استحقاق قسط إيجار",
    amount: p.amount,
    reference: invoiceByPayment.get(p.id) ?? null,
  }));

  const receiptedByPayment = new Map<string, number>();
  for (const d of documents) {
    if (d.type !== "RECEIPT") continue;
    if (d.paymentId) {
      receiptedByPayment.set(d.paymentId, round2((receiptedByPayment.get(d.paymentId) ?? 0) + d.amount));
    }
    const method = d.paymentId ? payments.find((p) => p.id === d.paymentId)?.method : null;
    movements.push({
      date: d.issueDate,
      kind: "CREDIT",
      label: method === "خصم من التأمين" ? "سداد — خصم من التأمين" : "سداد — سند قبض",
      amount: d.amount,
      reference: d.documentNumber,
      note: method && method !== "خصم من التأمين" ? method : null,
    });
  }

  // Money the records say was taken in without a voucher behind it. Older rows may carry it, and
  // leaving it out would make the statement disagree with the payment it is drawn from.
  let unvouched = 0;
  for (const p of payments) {
    const short = round2((p.paidAmount ?? 0) - (receiptedByPayment.get(p.id) ?? 0));
    if (short <= 0) continue;
    unvouched = round2(unvouched + short);
    movements.push({
      date: p.paidDate ?? p.dueDate,
      kind: "CREDIT",
      label: "سداد — بلا سند قبض",
      amount: short,
      note: p.method,
      unvouched: true,
    });
  }

  const now = new Date();
  const remaining = (p: (typeof payments)[number]) => Math.max(0, round2(p.amount - (p.paidAmount ?? 0)));
  // Arrears are a fact about today, whatever window is on screen: what has fallen due and is short.
  const arrears = round2(payments.filter((p) => p.dueDate <= now).reduce((s, p) => s + remaining(p), 0));

  const held = contract?.depositAmount ?? 0;
  const applied = contract?.depositApplied ?? 0;

  return {
    statement: buildStatement(movements, period),
    summary: {
      arrears,
      deposit: { held, applied, available: Math.max(0, round2(held - applied)) },
      unvouched,
    },
  };
}
