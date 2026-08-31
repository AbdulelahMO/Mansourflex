import { prisma } from "@/lib/prisma";
import { commissionByBuilding } from "@/lib/commission";
import { computeAccount } from "@/lib/owner-account-math";

export type Period = { from: Date; to: Date };

export type BuildingAccount = {
  buildingId: string;
  buildingName: string;
  /** Units in the property, and how many are let — occupancy as a fact, not a projection. */
  units: number;
  occupiedUnits: number;
  /** Rent the contracts call for in this period — what the property should produce. */
  billed: number;
  /** Of that, what has fallen due and is still short. */
  outstanding: number;
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

  const [unitCount, occupiedCount, billedAgg, dueShort, allAgg, ownerAgg, expenseAgg, remittanceAgg] = await Promise.all([
    prisma.unit.count({ where: { buildingId } }),
    prisma.unit.count({ where: { buildingId, status: "OCCUPIED" } }),
    // Billed by the contracts for this period, collected or not.
    prisma.payment.aggregate({
      where: { contract: { unit: { buildingId } }, dueDate: window },
      _sum: { amount: true },
    }),
    // Instalments already due within the period and not settled in full.
    prisma.payment.findMany({
      where: {
        contract: { unit: { buildingId } },
        dueDate: { gte: period.from, lte: new Date(Math.min(period.to.getTime(), Date.now())) },
        status: { not: "PAID" },
      },
      select: { amount: true, paidAmount: true },
    }),
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
      // A cancelled transfer never reached the owner, so it does not settle anything.
      where: { buildingId, remittedAt: window, cancelledAt: null },
      _sum: { amount: true },
    }),
  ]);

  const billed = billedAgg._sum.amount ?? 0;
  const outstanding = dueShort.reduce((s, p) => s + Math.max(0, p.amount - (p.paidAmount ?? 0)), 0);
  const collected = allAgg._sum.paidAmount ?? 0;
  const collectedByOwner = ownerAgg._sum.paidAmount ?? 0;
  const ownerExpenses = expenseAgg._sum.amount ?? 0;
  const remitted = remittanceAgg._sum.amount ?? 0;

  return {
    buildingId,
    buildingName,
    units: unitCount,
    occupiedUnits: occupiedCount,
    ...computeAccount({ billed, outstanding, collected, collectedByOwner, ownerExpenses, commissionPercent, remitted }),
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
      units: acc.units + l.units,
      occupiedUnits: acc.occupiedUnits + l.occupiedUnits,
      billed: acc.billed + l.billed,
      outstanding: acc.outstanding + l.outstanding,
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
      units: 0,
      occupiedUnits: 0,
      billed: 0,
      outstanding: 0,
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
