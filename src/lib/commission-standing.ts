import { prisma } from "@/lib/prisma";
import { commissionForBuilding, commissionAmount, vatWithin } from "@/lib/commission";
import { commissionAccount, type CommissionAccount } from "@/lib/commission-account";
import { ownerExpensesForBuilding } from "@/lib/expenses";

/**
 * Where a property's management fee stands: earned, settled by keeping it, paid back by voucher,
 * and what is still owed. Gathered from the records; the reasoning lives in `commission-account`.
 *
 * Everything is counted from the start of the property's life, not over a period: a fee owed
 * since last spring is owed today, and a window that began in January would quietly forgive it.
 */
export type BuildingCommissionStanding = CommissionAccount & {
  percent: number;
  /** The agreement the rate comes from, so a screen can link to the terms it is applying. */
  agreement: { id: string; number: string } | null;
  /** Everything collected on the property, tax included. */
  collected: number;
  /** The tax inside it — outside the fee's reach, and the owner's to remit. */
  vat: number;
  /** Rent the tenant handed the owner directly. */
  collectedByOwner: number;
  /** Expenses the owner bears, already paid. */
  expenses: number;
  remitted: number;
};

export async function buildingCommissionAccount(buildingId: string): Promise<BuildingCommissionStanding> {
  const [terms, collections, expenses, remittedAgg, receiptedAgg] = await Promise.all([
    commissionForBuilding(buildingId),
    prisma.payment.findMany({
      where: { contract: { unit: { buildingId } }, paidAmount: { gt: 0 } },
      select: { paidAmount: true, recipient: true, contract: { select: { vatRate: true } } },
    }),
    ownerExpensesForBuilding(buildingId),
    prisma.ownerRemittance.aggregate({
      where: { buildingId, cancelledAt: null },
      _sum: { amount: true },
    }),
    prisma.commissionCollection.aggregate({
      where: { buildingId, cancelledAt: null },
      _sum: { amount: true },
    }),
  ]);

  const collected = collections.reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);
  const vat = vatWithin(collections);
  // Rent the owner took from the tenant himself never reached the operator, so there is nothing
  // of it to keep the fee out of — which is the whole reason this account exists.
  const collectedByOwner = collections
    .filter((p) => p.recipient === "OWNER")
    .reduce((sum, p) => sum + (p.paidAmount ?? 0), 0);

  const earned = terms ? commissionAmount(terms, { collected, expenses, vat }) : 0;

  return {
    percent: terms?.percent ?? 0,
    agreement: terms ? { id: terms.agreementId, number: terms.agreementNumber } : null,
    collected,
    vat,
    collectedByOwner,
    expenses,
    ...commissionAccount({
      earned,
      operatorCollected: collected - collectedByOwner,
      remitted: remittedAgg._sum.amount ?? 0,
      receipted: receiptedAgg._sum.amount ?? 0,
    }),
  };
}
