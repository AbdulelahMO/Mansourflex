import { round2 } from "@/lib/documents-core";

/**
 * A tenant's account, stated as a ledger rather than a set of totals.
 *
 * The owner's statement answers «what is my property producing»; the tenant's answers «what do I
 * owe, and when did it become owed» — a question only a chronology can settle. So each instalment
 * that fell due is a debit on its due date, each receipt a credit on the day it was issued, and
 * the balance after every line is what the tenant owed at that moment. Handed across a counter,
 * it is the paper a disputed figure is traced through, line by line.
 *
 * The arithmetic lives apart from the gathering so it can be stated and checked on its own.
 */
export type MovementKind = "CHARGE" | "CREDIT";

export type Movement = {
  date: Date;
  kind: MovementKind;
  /** What the line is: «قسط إيجار», «سند قبض», «خصم من التأمين». */
  label: string;
  /** Always positive — which side it falls on is `kind`, not the sign. */
  amount: number;
  /** The document that evidences it, when one exists. */
  reference?: string | null;
  note?: string | null;
  /** Money taken in without a receipt behind it — shown, and marked, never hidden. */
  unvouched?: boolean;
};

export type StatementLine = Movement & {
  /** What was owed once this line had happened. */
  balance: number;
};

export type Statement = {
  /** What the tenant owed the instant before the period began. */
  opening: number;
  lines: StatementLine[];
  totals: {
    /** Charges within the period. */
    charged: number;
    /** Credits within the period. */
    credited: number;
    /** Opening plus charges less credits — what is owed at the close. */
    balance: number;
  };
};

export type Period = { from?: Date; to?: Date };

/**
 * A charge and a payment landing on the same day are not simultaneous: the instalment falls due,
 * and then it is paid. Ordering the debit first keeps the running balance from dipping below zero
 * on a day that was settled in full — a negative figure on a paid month reads as an error.
 */
function compare(a: Movement, b: Movement) {
  const byDate = a.date.getTime() - b.date.getTime();
  if (byDate !== 0) return byDate;
  if (a.kind === b.kind) return 0;
  return a.kind === "CHARGE" ? -1 : 1;
}

const signed = (m: Movement) => (m.kind === "CHARGE" ? m.amount : -m.amount);

export function buildStatement(movements: readonly Movement[], period: Period = {}): Statement {
  const ordered = [...movements].sort(compare);

  const from = period.from;
  const to = period.to;

  // Everything before the window is not dropped but summed into one opening figure: a statement
  // that starts a debt at zero because the period does tells the tenant they owe nothing.
  const before = from ? ordered.filter((m) => m.date < from) : [];
  const within = ordered.filter((m) => (!from || m.date >= from) && (!to || m.date <= to));

  const opening = round2(before.reduce((sum, m) => sum + signed(m), 0));

  let balance = opening;
  const lines: StatementLine[] = within.map((m) => {
    balance = round2(balance + signed(m));
    return { ...m, balance };
  });

  const charged = round2(within.filter((m) => m.kind === "CHARGE").reduce((s, m) => s + m.amount, 0));
  const credited = round2(within.filter((m) => m.kind === "CREDIT").reduce((s, m) => s + m.amount, 0));

  return { opening, lines, totals: { charged, credited, balance } };
}
