import { round2 } from "@/lib/documents-core";

/**
 * The owner's account for one property, worked out from what was gathered — kept apart from the
 * gathering so the arithmetic can be stated and checked on its own.
 *
 * Rent the owner took directly is counted as collected and then deducted from what is owed: the
 * operator keeps its commission on it, and the owner is not paid the same money twice. Expenses
 * the owner bears come off before the commission, so the operator does not earn a share of money
 * that was spent on the property rather than earned from it — and neither does it earn a share of
 * the tax, which was never income to begin with.
 */
export type AccountInputs = {
  /** Rent the contracts called for in the period, collected or not. */
  billed: number;
  /** Of that, what has fallen due and is still short. */
  outstanding: number;
  /** Everything collected in the period, whoever received it — tax included, as it arrived. */
  collected: number;
  /** The tax inside that collection. It passes through to the state and is nobody's income. */
  collectedVat: number;
  /** The part the owner collected directly — already in their hands. */
  collectedByOwner: number;
  ownerExpenses: number;
  commissionPercent: number;
  /** Transfers already made to the owner within the period. */
  remitted: number;
};

export type AccountFigures = AccountInputs & {
  netCollected: number;
  /** What the commission is taken from: collection less its tax, less the owner's expenses. */
  commissionBase: number;
  commission: number;
  payableToOwner: number;
  /** What is still owed to the owner — negative means the owner owes the operator. */
  balance: number;
};

export function computeAccount(input: AccountInputs): AccountFigures {
  const netCollected = round2(input.collected - input.ownerExpenses);
  // Value-added tax is collected on the state's behalf and remitted to it. Charging a management
  // commission on it would be charging for handling somebody else's money — so the commission is
  // taken from the rent alone, while what is owed to the owner still carries the tax they will
  // hand over themselves.
  const commissionBase = round2(netCollected - input.collectedVat);
  const commission = round2(commissionBase * (input.commissionPercent / 100));
  const payableToOwner = round2(netCollected - commission);

  return {
    ...input,
    netCollected,
    commissionBase,
    commission,
    payableToOwner,
    balance: round2(payableToOwner - input.collectedByOwner - input.remitted),
  };
}
