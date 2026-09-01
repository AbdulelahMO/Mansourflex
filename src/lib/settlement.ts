import { prisma } from "@/lib/prisma";
import { vatWithin } from "@/lib/commission";

export type SettlementPreview = {
  periodFrom: Date;
  periodTo: Date;
  collected: number;
  ownerExpenses: number;
  netCollected: number;
  /** The tax inside the collection — out of the commission's reach, and the owner's to remit. */
  collectedVat: number;
  commissionBase: number;
  commissionPercent: number;
  commission: number;
  operatorExpenses: number;
  netCommission: number;
  payableToOwner: number;
  /** Documented at settlement time but excluded from the figures — they may still resolve later. */
  pendingArrears: number;
  pendingExpenses: number;
};

/**
 * Final account for an agreement, from its start until the settlement date.
 * What the owner is owed is the collected rent, less the expenses they bear and the
 * management commission. What the operator keeps is that commission less its own expenses.
 */
export async function buildSettlement(agreementId: string, settledAt: Date): Promise<SettlementPreview | null> {
  const agreement = await prisma.managementAgreement.findUnique({
    where: { id: agreementId },
    include: { buildings: true },
  });
  const line = agreement?.buildings[0];
  if (!agreement || !line) return null;

  const periodFrom = agreement.startDate;
  // Settling early closes the account at the settlement date, never beyond the agreed end.
  const periodTo = settledAt < agreement.endDate ? settledAt : agreement.endDate;
  const buildingId = line.buildingId;

  const [collections, ownerAgg, operatorAgg, pendingExpenseAgg, duePayments] = await Promise.all([
    prisma.payment.findMany({
      where: { contract: { unit: { buildingId } }, paidDate: { gte: periodFrom, lte: periodTo } },
      select: { paidAmount: true, contract: { select: { vatRate: true } } },
    }),
    prisma.expense.aggregate({
      where: { buildingId, bearer: "OWNER", paidDate: { gte: periodFrom, lte: periodTo } },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { buildingId, bearer: "OPERATOR", paidDate: { gte: periodFrom, lte: periodTo } },
      _sum: { amount: true },
    }),
    // Pending items are scoped to the agreement's own period, like every other figure here:
    // an arrear that fell due before the mandate began was never this agreement's to collect.
    prisma.expense.aggregate({
      where: { buildingId, paidDate: null, expenseDate: { gte: periodFrom, lte: periodTo } },
      _sum: { amount: true },
    }),
    prisma.payment.findMany({
      where: {
        contract: { unit: { buildingId } },
        dueDate: { gte: periodFrom, lte: periodTo },
        status: { not: "PAID" },
      },
      select: { amount: true, paidAmount: true },
    }),
  ]);

  const collected = collections.reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
  const collectedVat = vatWithin(collections);
  const ownerExpenses = ownerAgg._sum.amount ?? 0;
  const operatorExpenses = operatorAgg._sum.amount ?? 0;
  const netCollected = collected - ownerExpenses;
  // The same rule the statement and the property page hold to: no commission on the state's tax.
  const commissionBase = netCollected - collectedVat;
  const commission = commissionBase * (line.commissionPercent / 100);

  return {
    periodFrom,
    periodTo,
    collected,
    ownerExpenses,
    netCollected,
    collectedVat,
    commissionBase,
    commissionPercent: line.commissionPercent,
    commission,
    operatorExpenses,
    netCommission: commission - operatorExpenses,
    payableToOwner: netCollected - commission,
    pendingArrears: duePayments.reduce((s, p) => s + Math.max(0, p.amount - (p.paidAmount ?? 0)), 0),
    pendingExpenses: pendingExpenseAgg._sum.amount ?? 0,
  };
}
