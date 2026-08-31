import { round2 } from "@/lib/documents-core";

/**
 * The owner's account for one property, worked out from what was gathered — kept apart from the
 * gathering so the arithmetic can be stated and checked on its own.
 *
 * Rent the owner took directly is counted as collected and then deducted from what is owed: the
 * operator keeps its commission on it, and the owner is not paid the same money twice. Expenses
 * the owner bears come off before the commission, so the operator does not earn a share of money
 * that was spent on the property rather than earned from it.
 */
export type AccountInputs = {
  /** Rent the contracts called for in the period, collected or not. */
  billed: number;
  /** Of that, what has fallen due and is still short. */
  outstanding: number;
  /** Everything collected in the period, whoever received it. */
  collected: number;
  /** The part the owner collected directly — already in their hands. */
  collectedByOwner: number;
  ownerExpenses: number;
  commissionPercent: number;
  /** Transfers already made to the owner within the period. */
  remitted: number;
};

export type AccountFigures = AccountInputs & {
  netCollected: number;
  commission: number;
  payableToOwner: number;
  /** What is still owed to the owner — negative means the owner owes the operator. */
  balance: number;
};

export function computeAccount(input: AccountInputs): AccountFigures {
  const netCollected = round2(input.collected - input.ownerExpenses);
  const commission = round2(netCollected * (input.commissionPercent / 100));
  const payableToOwner = round2(netCollected - commission);

  return {
    ...input,
    netCollected,
    commission,
    payableToOwner,
    balance: round2(payableToOwner - input.collectedByOwner - input.remitted),
  };
}
