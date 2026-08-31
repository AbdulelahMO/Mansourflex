import { round2 } from "@/lib/documents-core";

/**
 * Spreading a sum of money across instalments, oldest first.
 *
 * Two acts need it and must agree: rent handed over that exceeds the instalment it was meant for
 * rolls onto the ones after it, and a security deposit settles what the tenant left owing. Both
 * fill one instalment before touching the next, neither may put more into an instalment than it
 * is short, and both work in halalas — 1583.33 minus 934 is 649.3299999999999 in binary, and a
 * remainder paid exactly as the screen shows it must not be refused as an overpayment.
 */
export type Fillable = { amount: number; paidAmount: number | null };

/** What an instalment is still short, to the halala and never below zero. */
export function remainingOn(p: Fillable): number {
  return Math.max(0, round2(p.amount - (p.paidAmount ?? 0)));
}

export type Allocation<T> = { target: T; add: number; index: number };

/**
 * Fills the slots in the order given and reports what would not fit. Nothing is written here:
 * the caller settles the whole plan before touching a record, so an amount that cannot be placed
 * is refused without leaving half of it applied.
 */
export function allocate<T extends Fillable>(
  amount: number,
  slots: readonly T[]
): { allocations: Allocation<T>[], left: number } {
  const allocations: Allocation<T>[] = [];
  let left = round2(amount);

  slots.forEach((target, index) => {
    if (left <= 0) return;
    const room = remainingOn(target);
    if (room <= 0) return;

    const add = round2(Math.min(left, room));
    allocations.push({ target, add, index });
    left = round2(left - add);
  });

  return { allocations, left };
}
