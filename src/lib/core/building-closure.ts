import "server-only";
import { prisma } from "@/lib/prisma";
import { formatCurrency } from "@/lib/format";
import { buildingAccount } from "@/lib/owner-account";
import { commissionForBuilding } from "@/lib/commission";

/** What deleting the building would take with it, and what money is still open on it. */
export type BuildingClosure = {
  name: string;
  units: number;
  contracts: number;
  payments: number;
  documents: number;
  expenses: number;
  /** Rent billed and not collected — money owed to us. */
  arrears: number;
  /** Supplier invoices recorded and not paid — money we owe. */
  unpaidExpenses: number;
  /** Still to be handed to the owner (negative means the owner owes us). */
  ownerBalance: number;
  hasDues: boolean;
};

export async function buildingClosure(buildingId: string): Promise<BuildingClosure | null> {
  const building = await prisma.building.findUnique({
    where: { id: buildingId },
    select: { name: true, createdAt: true },
  });
  if (!building) return null;

  const [units, contracts, payments, documents, expenses, duePayments, unpaidExpenseAgg] = await Promise.all([
    prisma.unit.count({ where: { buildingId } }),
    prisma.contract.count({ where: { unit: { buildingId } } }),
    prisma.payment.count({ where: { contract: { unit: { buildingId } } } }),
    prisma.financialDocument.count({
      where: { OR: [{ contract: { unit: { buildingId } } }, { expense: { buildingId } }, { remittance: { buildingId } }] },
    }),
    prisma.expense.count({ where: { buildingId } }),
    prisma.payment.findMany({
      // Future instalments are not arrears; only what has fallen due and is short.
      where: { contract: { unit: { buildingId } }, dueDate: { lte: new Date() }, status: { not: "PAID" } },
      select: { amount: true, paidAmount: true },
    }),
    prisma.expense.aggregate({ where: { buildingId, paidDate: null }, _sum: { amount: true } }),
  ]);

  const arrears = duePayments.reduce((s, p) => s + Math.max(0, p.amount - (p.paidAmount ?? 0)), 0);
  const unpaidExpenses = unpaidExpenseAgg._sum.amount ?? 0;

  // The owner's account over the building's whole life, so nothing outstanding is missed.
  const terms = await commissionForBuilding(buildingId);
  const account = await buildingAccount(
    buildingId,
    building.name,
    { from: building.createdAt < new Date(0) ? new Date(0) : new Date(0), to: new Date() },
    terms?.percent ?? 0
  );

  const ownerBalance = Math.round(account.balance * 100) / 100;

  return {
    name: building.name,
    units,
    contracts,
    payments,
    documents,
    expenses,
    arrears,
    unpaidExpenses,
    ownerBalance,
    hasDues: arrears > 0.5 || unpaidExpenses > 0.5 || Math.abs(ownerBalance) > 0.5,
  };
}

/** The sentence shown to whoever is about to delete, and stored on the approval request. */
export function closureSummary(c: BuildingClosure) {
  return `حذف المبنى «${c.name}» وكل ما يتبعه: ${c.units} وحدة · ${c.contracts} عقد · ${c.payments} دفعة · ${c.documents} مستند · ${c.expenses} مصروف`;
}

export function duesSummary(c: BuildingClosure) {
  const parts: string[] = [];
  if (c.arrears > 0.5) parts.push(`متأخرات على المستأجرين ${formatCurrency(c.arrears)}`);
  if (c.unpaidExpenses > 0.5) parts.push(`مصروفات لم تُسدَّد ${formatCurrency(c.unpaidExpenses)}`);
  if (c.ownerBalance > 0.5) parts.push(`مستحق للمالك لم يُورَّد ${formatCurrency(c.ownerBalance)}`);
  if (c.ownerBalance < -0.5) parts.push(`مستحق لنا على المالك ${formatCurrency(Math.abs(c.ownerBalance))}`);
  return parts.join(" · ");
}
