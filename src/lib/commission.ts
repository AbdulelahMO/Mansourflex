import { prisma } from "@/lib/prisma";

export type CommissionTerms = {
  percent: number;
  agreementId: string;
  agreementNumber: string;
};

/** Commission is always taken from net collected — there is no second basis to choose. */
export const COMMISSION_BASIS_LABEL = "من صافي المحصّل بعد المصروفات";

/**
 * Commission terms for buildings, taken from whichever management agreement is ACTIVE.
 * A building is allowed under only one active agreement, so the lookup is unambiguous;
 * a building with no active agreement simply has no agreed commission yet.
 */
export async function commissionByBuilding(buildingIds: string[]): Promise<Map<string, CommissionTerms>> {
  if (buildingIds.length === 0) return new Map();

  const lines = await prisma.agreementBuilding.findMany({
    where: { buildingId: { in: buildingIds }, agreement: { status: "ACTIVE" } },
    include: { agreement: { select: { id: true, agreementNumber: true } } },
  });

  return new Map(
    lines.map((l) => [
      l.buildingId,
      {
        percent: l.commissionPercent,
        agreementId: l.agreement.id,
        agreementNumber: l.agreement.agreementNumber,
      },
    ])
  );
}

export async function commissionForBuilding(buildingId: string): Promise<CommissionTerms | null> {
  return (await commissionByBuilding([buildingId])).get(buildingId) ?? null;
}

export type CommissionAmounts = {
  /** Rent actually collected. */
  collected: number;
  /**
   * Expenses deducted before the commission is taken. Zero until the expenses feature
   * exists — wire it here and every commission figure follows.
   */
  expenses?: number;
};

/** Collected rent minus the expenses charged against it — what the commission is taken from. */
export function netCollected(amounts: CommissionAmounts) {
  return amounts.collected - (amounts.expenses ?? 0);
}

export function commissionAmount(terms: CommissionTerms, amounts: CommissionAmounts) {
  return netCollected(amounts) * (terms.percent / 100);
}
