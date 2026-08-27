import { prisma } from "@/lib/prisma";
import { commissionByBuilding } from "@/lib/commission";

export type Period = { from: Date; to: Date };

export type BuildingAccount = {
  buildingId: string;
  buildingName: string;
  /** Everything collected in the period, whoever received it. */
  collected: number;
  /** The part the owner collected directly — already in their hands. */
  collectedByOwner: number;
  ownerExpenses: number;
  netCollected: number;
  commissionPercent: number;
  commission: number;
  /** Owner's share of the period before anything is settled against it. */
  payableToOwner: number;
  /** Transfers already made to the owner within the period. */
  remitted: number;
  /** What is still owed to the owner — negative means the owner owes the operator. */
  balance: number;
};

/**
 * The owner's running account for one building over a period.
 *
 * Rent collected directly by the owner counts as already delivered: it is included in the
 * collection the commission is taken from, then deducted from what is owed, so the operator
 * keeps its commission on it and the owner is not paid the same money twice.
 */
export async function buildingAccount(
  buildingId: string,
  buildingName: string,
  period: Period,
  commissionPercent: number
): Promise<BuildingAccount> {
  const window = { gte: period.from, lte: period.to };

  const [allAgg, ownerAgg, expenseAgg, remittanceAgg] = await Promise.all([
    prisma.payment.aggregate({
      where: { contract: { unit: { buildingId } }, paidDate: window },
      _sum: { paidAmount: true },
    }),
    prisma.payment.aggregate({
      where: { contract: { unit: { buildingId } }, paidDate: window, recipient: "OWNER" },
      _sum: { paidAmount: true },
    }),
    prisma.expense.aggregate({
      where: { buildingId, bearer: "OWNER", paidDate: window },
      _sum: { amount: true },
    }),
    prisma.ownerRemittance.aggregate({
      where: { buildingId, remittedAt: window },
      _sum: { amount: true },
    }),
  ]);

  const collected = allAgg._sum.paidAmount ?? 0;
  const collectedByOwner = ownerAgg._sum.paidAmount ?? 0;
  const ownerExpenses = expenseAgg._sum.amount ?? 0;
  const remitted = remittanceAgg._sum.amount ?? 0;

  const netCollected = collected - ownerExpenses;
  const commission = netCollected * (commissionPercent / 100);
  const payableToOwner = netCollected - commission;

  return {
    buildingId,
    buildingName,
    collected,
    collectedByOwner,
    ownerExpenses,
    netCollected,
    commissionPercent,
    commission,
    payableToOwner,
    remitted,
    balance: payableToOwner - collectedByOwner - remitted,
  };
}

/** The same account for every building an owner holds, plus the totals across them. */
export async function ownerAccount(ownerId: string, period: Period) {
  const buildings = await prisma.building.findMany({
    where: { ownerId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const terms = await commissionByBuilding(buildings.map((b) => b.id));

  const lines = await Promise.all(
    buildings.map((b) => buildingAccount(b.id, b.name, period, terms.get(b.id)?.percent ?? 0))
  );

  const totals = lines.reduce(
    (acc, l) => ({
      collected: acc.collected + l.collected,
      collectedByOwner: acc.collectedByOwner + l.collectedByOwner,
      ownerExpenses: acc.ownerExpenses + l.ownerExpenses,
      netCollected: acc.netCollected + l.netCollected,
      commission: acc.commission + l.commission,
      payableToOwner: acc.payableToOwner + l.payableToOwner,
      remitted: acc.remitted + l.remitted,
      balance: acc.balance + l.balance,
    }),
    {
      collected: 0,
      collectedByOwner: 0,
      ownerExpenses: 0,
      netCollected: 0,
      commission: 0,
      payableToOwner: 0,
      remitted: 0,
      balance: 0,
    }
  );

  return { lines, totals };
}
