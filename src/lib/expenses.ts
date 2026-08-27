import { prisma } from "@/lib/prisma";

export const EXPENSE_CATEGORIES = [
  { value: "MAINTENANCE", label: "صيانة" },
  { value: "PLUMBING", label: "سباكة" },
  { value: "RENOVATION", label: "ترميم" },
  { value: "ELECTRICITY", label: "كهرباء" },
  { value: "WATER", label: "ماء" },
  { value: "CLEANING", label: "نظافة" },
  { value: "SECURITY", label: "أمن" },
  { value: "GOVERNMENT_FEES", label: "رسوم حكومية" },
  { value: "INSURANCE", label: "تأمين" },
  { value: "OTHER", label: "أخرى" },
] as const;

export const EXPENSE_BEARERS = [
  { value: "OWNER", label: "المالك" },
  { value: "TENANT", label: "المستأجر" },
  { value: "OPERATOR", label: "المشغل" },
] as const;

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
);

export const BEARER_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_BEARERS.map((b) => [b.value, b.label])
);

/**
 * Expenses that reduce the owner's settlement: borne by the owner, actually paid, and
 * paid within the period being settled. Anything the tenant or operator bears is tracked
 * but never deducted from the owner, and an unpaid invoice is not deducted until it is paid.
 */
export async function ownerExpensesByBuilding(
  buildingIds: string[],
  period?: { from: Date; to: Date }
): Promise<Map<string, number>> {
  if (buildingIds.length === 0) return new Map();

  const grouped = await prisma.expense.groupBy({
    by: ["buildingId"],
    where: {
      buildingId: { in: buildingIds },
      bearer: "OWNER",
      paidDate: period ? { gte: period.from, lte: period.to } : { not: null },
    },
    _sum: { amount: true },
  });

  return new Map(grouped.map((g) => [g.buildingId, g._sum.amount ?? 0]));
}

export async function ownerExpensesForBuilding(buildingId: string, period?: { from: Date; to: Date }) {
  return (await ownerExpensesByBuilding([buildingId], period)).get(buildingId) ?? 0;
}

/**
 * Expenses the operator paid out of its own pocket. They do not touch the owner's
 * settlement — they come off the operator's own commission.
 */
export async function operatorExpensesByBuilding(
  buildingIds: string[],
  period?: { from: Date; to: Date }
): Promise<Map<string, number>> {
  if (buildingIds.length === 0) return new Map();

  const grouped = await prisma.expense.groupBy({
    by: ["buildingId"],
    where: {
      buildingId: { in: buildingIds },
      bearer: "OPERATOR",
      paidDate: period ? { gte: period.from, lte: period.to } : { not: null },
    },
    _sum: { amount: true },
  });

  return new Map(grouped.map((g) => [g.buildingId, g._sum.amount ?? 0]));
}

export async function operatorExpensesForBuilding(buildingId: string, period?: { from: Date; to: Date }) {
  return (await operatorExpensesByBuilding([buildingId], period)).get(buildingId) ?? 0;
}
