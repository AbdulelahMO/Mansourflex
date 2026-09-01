import { round2 } from "@/lib/documents-core";

/**
 * Where a property's management fee stands: what it has earned, and how much of that has been
 * settled with a voucher behind it.
 *
 * The fee is settled two ways, and the agreement decides which: kept back out of a transfer to
 * the owner — the common case, and the one the frequency clause is about — or sent back by the
 * owner when the tenant paid them directly and nothing passed through the operator's hands. The
 * amount is the same in both, and so is the rule the house lives by: no riyal moves without a
 * voucher. So a deduction is documented exactly like a receipt, and what is left unsettled is
 * simply what has no voucher yet.
 *
 * It was tempting to treat the fee as settled by the mere fact that the operator is holding the
 * owner's money. That is an inference, not a record — it cannot be printed, cannot be shown to an
 * owner who disputes it, and quietly changes the moment the money moves.
 */
export type CommissionAccountInput = {
  /** Fee earned on what has been collected. */
  earned: number;
  /** Settled by voucher, whether deducted from a transfer or received back — cancelled excluded. */
  settled: number;
};

export type CommissionAccount = CommissionAccountInput & {
  /** Earned but with no voucher against it yet — what the next settlement covers. */
  unsettled: number;
};

export function commissionAccount(input: CommissionAccountInput): CommissionAccount {
  const earned = round2(input.earned);
  const settled = round2(input.settled);

  return { earned, settled, unsettled: Math.max(0, round2(earned - settled)) };
}
