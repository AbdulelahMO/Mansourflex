import "server-only";
import { prisma } from "@/lib/prisma";
import { commissionByBuilding } from "@/lib/commission";
import { buildingAccount, type Period } from "@/lib/owner-account";

/**
 * Everything the owner portal shows, gathered for one owner and one period.
 *
 * Two things are deliberately left out: tenants' personal contact details, which the owner
 * has no need for and which we would be holding on their behalf, and expenses the operator
 * bears — those come off the management commission, not the owner's income.
 */
export async function ownerPortalData(ownerId: string, period: Period) {
  const buildings = await prisma.building.findMany({
    where: { ownerId },
    select: { id: true, name: true, city: true, district: true, archivedAt: true },
    orderBy: { name: "asc" },
  });
  const buildingIds = buildings.map((b) => b.id);
  const terms = await commissionByBuilding(buildingIds);

  const window = { gte: period.from, lte: period.to };

  const [units, contracts, expenses, remittances, agreements] = await Promise.all([
    prisma.unit.findMany({
      where: { buildingId: { in: buildingIds } },
      select: { id: true, unitNumber: true, unitType: true, status: true, buildingId: true, rentAmount: true },
      orderBy: { unitNumber: "asc" },
    }),
    prisma.contract.findMany({
      where: { unit: { buildingId: { in: buildingIds } } },
      select: {
        id: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        rentAmount: true,
        status: true,
        tenant: { select: { name: true } },
        unit: { select: { unitNumber: true, buildingId: true } },
        payments: { select: { amount: true, paidAmount: true, dueDate: true, status: true } },
      },
      orderBy: { startDate: "desc" },
    }),
    prisma.expense.findMany({
      where: { buildingId: { in: buildingIds }, bearer: "OWNER", expenseDate: window },
      select: {
        id: true,
        expenseDate: true,
        paidDate: true,
        category: true,
        description: true,
        vendor: true,
        amount: true,
        fileUrl: true,
        buildingId: true,
        unit: { select: { unitNumber: true } },
      },
      orderBy: { expenseDate: "desc" },
    }),
    prisma.ownerRemittance.findMany({
      where: { ownerId, remittedAt: window },
      select: {
        id: true,
        remittedAt: true,
        amount: true,
        method: true,
        reference: true,
        cancelledAt: true,
        building: { select: { name: true } },
        documents: { select: { id: true, documentNumber: true, status: true } },
      },
      orderBy: { remittedAt: "desc" },
    }),
    prisma.managementAgreement.findMany({
      where: { ownerId },
      select: {
        id: true,
        agreementNumber: true,
        startDate: true,
        endDate: true,
        status: true,
        fileUrl: true,
        settlement: { select: { id: true, settledAt: true, payableToOwner: true } },
        buildings: { select: { commissionPercent: true, building: { select: { name: true } } } },
      },
      orderBy: { startDate: "desc" },
    }),
  ]);

  const accounts = await Promise.all(
    buildings.map((b) => buildingAccount(b.id, b.name, period, terms.get(b.id)?.percent ?? 0))
  );

  const totals = accounts.reduce(
    (acc, a) => ({
      collected: acc.collected + a.collected,
      ownerExpenses: acc.ownerExpenses + a.ownerExpenses,
      commission: acc.commission + a.commission,
      payableToOwner: acc.payableToOwner + a.payableToOwner,
      remitted: acc.remitted + a.remitted,
      balance: acc.balance + a.balance,
    }),
    { collected: 0, ownerExpenses: 0, commission: 0, payableToOwner: 0, remitted: 0, balance: 0 }
  );

  const now = new Date();
  const arrearsTotal = contracts
    .flatMap((c) => c.payments.filter((p) => p.status !== "PAID" && p.dueDate <= now))
    .reduce((s, p) => s + Math.max(0, p.amount - (p.paidAmount ?? 0)), 0);

  return {
    buildings,
    units,
    contracts,
    expenses,
    remittances,
    agreements,
    accounts,
    totals,
    arrearsTotal,
    occupancy: {
      total: units.length,
      occupied: units.filter((u) => u.status === "OCCUPIED").length,
      vacant: units.filter((u) => u.status === "VACANT").length,
      maintenance: units.filter((u) => u.status === "MAINTENANCE").length,
    },
  };
}
