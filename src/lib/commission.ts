import { prisma } from "@/lib/prisma";

export type CommissionTerms = {
  percent: number;
  agreementId: string;
  agreementNumber: string;
};

/** Commission is always taken from net collected — there is no second basis to choose. */
export const COMMISSION_BASIS_LABEL = "من صافي المحصّل بعد المصروفات، دون ضريبة القيمة المضافة";

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

/** The settlement clause in words, for the agreement and the screens that quote it. */
export const SETTLEMENT_FREQUENCY_LABELS: Record<string, string> = {
  PER_COLLECTION: "مع كل تحصيل",
  MONTHLY: "شهرياً",
  QUARTERLY: "ربع سنوي",
  SEMI_ANNUAL: "نصف سنوي",
  ANNUAL: "سنوياً",
  ON_DEMAND: "عند الطلب أو الاتفاق",
};

/** The same clause as a sentence a contract can carry. */
export const SETTLEMENT_FREQUENCY_SENTENCES: Record<string, string> = {
  PER_COLLECTION: "تُخصم أتعاب الإدارة من كل مبلغ يُحصَّل، ويُورَّد الصافي للطرف الثاني",
  MONTHLY: "تُسوَّى الأتعاب ويُورَّد نصيب الطرف الثاني شهرياً",
  QUARTERLY: "تُسوَّى الأتعاب ويُورَّد نصيب الطرف الثاني كل ثلاثة أشهر",
  SEMI_ANNUAL: "تُسوَّى الأتعاب ويُورَّد نصيب الطرف الثاني كل ستة أشهر",
  ANNUAL: "تُسوَّى الأتعاب ويُورَّد نصيب الطرف الثاني سنوياً",
  ON_DEMAND: "تُسوَّى الأتعاب ويُورَّد نصيب الطرف الثاني عند الطلب أو حسب ما يتفقان عليه",
};

export type CommissionAmounts = {
  /** Rent actually collected, tax included — as the money arrived. */
  collected: number;
  /**
   * Expenses deducted before the commission is taken. Zero until the expenses feature
   * exists — wire it here and every commission figure follows.
   */
  expenses?: number;
  /** The tax inside the collection: gathered for the state, and nobody's income to share. */
  vat?: number;
};

/** Collected rent minus the expenses charged against it — what is left of the property's money. */
export function netCollected(amounts: CommissionAmounts) {
  return amounts.collected - (amounts.expenses ?? 0);
}

/**
 * What the commission is actually taken from. Tax comes off as well as expenses: charging a
 * management fee on value-added tax is charging for handling the state's money, and it is the
 * owner who hands that money over.
 */
export function commissionBase(amounts: CommissionAmounts) {
  return netCollected(amounts) - (amounts.vat ?? 0);
}

export function commissionAmount(terms: CommissionTerms, amounts: CommissionAmounts) {
  return commissionBase(amounts) * (terms.percent / 100);
}

/** The tax inside a set of collections, each grossed up by its own contract's rate. */
export function vatWithin(payments: readonly { paidAmount: number | null; contract: { vatRate: number } }[]) {
  const total = payments.reduce(
    (sum, p) => sum + (p.paidAmount ?? 0) - (p.paidAmount ?? 0) / (1 + (p.contract.vatRate ?? 0) / 100),
    0
  );
  return Math.round(total * 100) / 100;
}
