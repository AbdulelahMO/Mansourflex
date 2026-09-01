import { round2 } from "@/lib/documents-core";

/**
 * How the management fee actually gets paid, which is two different things wearing one name.
 *
 * The money sits in the operator's account, so most of the time the fee is never transferred at
 * all: the owner's share is sent on and the fee simply stays behind. But when a tenant hands the
 * rent to the owner directly, nothing of that money ever passes through the operator — and the
 * fee on it becomes a debt the owner has to send back. The first case needs no record because the
 * transfer itself is the record; the second needs a voucher, or there is nothing to show for it.
 *
 * So the fee is treated as settled to the extent the operator is holding that owner's money, and
 * what is left over is what the owner owes.
 */
export type CommissionAccountInput = {
  /** Fee earned on what has been collected — before asking how it was settled. */
  earned: number;
  /** Rent that passed through the operator's hands: everything collected but what the owner took. */
  operatorCollected: number;
  /** Of that, what has already been sent on to the owner. */
  remitted: number;
  /** Fee the owner has paid back by voucher, cancelled ones excluded. */
  receipted: number;
};

export type CommissionAccount = CommissionAccountInput & {
  /** Money of this owner's still in the operator's hands. */
  held: number;
  /** The part of the fee covered by simply keeping it. */
  deducted: number;
  /** What the owner must still send — nearly always rent they collected themselves. */
  dueFromOwner: number;
};

export function commissionAccount(input: CommissionAccountInput): CommissionAccount {
  const earned = round2(input.earned);
  // Over-remitting leaves nothing behind to keep the fee out of, so it never reads as negative.
  const held = Math.max(0, round2(input.operatorCollected - input.remitted));
  const receipted = round2(input.receipted);

  // A voucher settles first: it is money that actually moved, and what is merely held may yet be
  // sent on. Counting it the other way round would show a fee as owed after it had been paid.
  const outstandingAfterReceipts = Math.max(0, round2(earned - receipted));
  const deducted = Math.min(outstandingAfterReceipts, held);

  return {
    ...input,
    earned,
    receipted,
    held,
    deducted: round2(deducted),
    dueFromOwner: round2(outstandingAfterReceipts - deducted),
  };
}
