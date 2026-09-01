import { termFromEndDate, type RentAmountType } from "@/lib/payment-schedule";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * What the lease costs in a year — a figure the contract does not actually store.
 *
 * `rentAmount` is three different things depending on how it was entered: a year's rent, the
 * whole term's, or the first year of a rising one. Printing it as «الإيجار السنوي» would double
 * a two-year total and understate an escalating lease in its later years, so it is worked out
 * rather than copied. It is always pre-tax, which is how a lease states rent and why the figure
 * must be labelled: the instalments in the ledger carry VAT on top and will not add up to it.
 */
export type RentInput = {
  rentAmount: number;
  amountType: RentAmountType;
  increasePercent: number | null;
  startDate: Date;
  endDate: Date;
};

export type AnnualRent = {
  /** The year's rent, before VAT. */
  amount: number;
  /** Which contract year this is — 1-based, for a rising lease that has no single yearly rent. */
  yearIndex: number;
  /** Years in the term, fractional when the lease is not a whole number of years. */
  termYears: number;
};

/** Whole months between two dates, counting only months completed. */
function monthsBetween(from: Date, to: Date) {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  return to.getDate() >= from.getDate() ? months : months - 1;
}

export function annualRent(contract: RentInput, asOf: Date = new Date()): AnnualRent {
  const term = termFromEndDate(contract.startDate, contract.endDate);
  const termYears = round2(term.years + term.months / 12 + term.days / 365);

  // The year of the lease the report is standing in, clamped inside the term: a statement drawn
  // after the lease ended still speaks of its last year, not of one that never ran.
  const elapsedYears = Math.floor(Math.max(0, monthsBetween(contract.startDate, asOf)) / 12);
  const lastYearIndex = Math.max(0, Math.ceil(termYears) - 1);
  const yearIndex = Math.min(elapsedYears, lastYearIndex);

  if (contract.amountType === "ANNUAL") {
    return { amount: round2(contract.rentAmount), yearIndex: yearIndex + 1, termYears };
  }

  if (contract.amountType === "TOTAL") {
    // Spread evenly over the term, which is what a total-value lease means by a year's rent.
    const years = termYears > 0 ? termYears : 1;
    return { amount: round2(contract.rentAmount / years), yearIndex: yearIndex + 1, termYears };
  }

  // INCREASING: the entered amount is the first year, each later year raised by the percentage.
  const rate = (contract.increasePercent ?? 0) / 100;
  return {
    amount: round2(contract.rentAmount * Math.pow(1 + rate, yearIndex)),
    yearIndex: yearIndex + 1,
    termYears,
  };
}
