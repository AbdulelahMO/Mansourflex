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
  /** The tax inside that collection — passed to the state, and no part of anyone's income. */
  collectedVat: number;
  /** The part the owner collected directly — already in their hands. */
  collectedByOwner: number;
  ownerExpenses: number;
  netCollected: number;
  /** What the commission is taken from: the collection less its tax and the owner's expenses. */
  commissionBase: number;
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

  const [unitCount, occupiedCount, billedAgg, dueShort, collections, expenseAgg, remittanceAgg] = await Promise.all([
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
    // Read row by row rather than summed: the tax rate lives on each payment's contract, and the
    // tax inside a collection cannot be recovered from a total that has already swallowed it.
    prisma.payment.findMany({
      where: { contract: { unit: { buildingId } }, paidDate: window },
      select: { paidAmount: true, recipient: true, contract: { select: { vatRate: true } } },
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
  let collected = 0;
  let collectedVat = 0;
  let collectedByOwner = 0;
  for (const p of collections) {
    const paid = p.paidAmount ?? 0;
    collected += paid;
    // The instalment was stored tax-inclusive, so the tax is the part above the rent it grossed up.
    collectedVat += paid - paid / (1 + (p.contract.vatRate ?? 0) / 100);
    if (p.recipient === "OWNER") collectedByOwner += paid;
  }
  const ownerExpenses = expenseAgg._sum.amount ?? 0;
  const remitted = remittanceAgg._sum.amount ?? 0;

  return {
    buildingId,
    buildingName,
    units: unitCount,
    occupiedUnits: occupiedCount,
    ...computeAccount({
      billed,
      outstanding,
      collected,
      collectedVat: Math.round(collectedVat * 100) / 100,
      collectedByOwner,
      ownerExpenses,
      commissionPercent,
      remitted,
    }),
  };
}

/**
 * The same account for every building an owner holds, plus the totals across them — or for one
 * of them when asked. A settlement is made for a property, not for a portfolio: the commission
 * is agreed per property and the transfer is issued against it, so the statement must be able to
 * speak about one and only one when that is what is being settled.
 */
export async function ownerAccount(ownerId: string, period: Period, buildingId?: string) {
  const buildings = await prisma.building.findMany({
    where: { ownerId, ...(buildingId ? { id: buildingId } : {}) },
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
      collectedVat: acc.collectedVat + l.collectedVat,
      collectedByOwner: acc.collectedByOwner + l.collectedByOwner,
      ownerExpenses: acc.ownerExpenses + l.ownerExpenses,
      netCollected: acc.netCollected + l.netCollected,
      commissionBase: acc.commissionBase + l.commissionBase,
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
      collectedVat: 0,
      collectedByOwner: 0,
      ownerExpenses: 0,
      netCollected: 0,
      commissionBase: 0,
      commission: 0,
      payableToOwner: 0,
      remitted: 0,
      balance: 0,
    }
  );

  return { lines, totals };
}
