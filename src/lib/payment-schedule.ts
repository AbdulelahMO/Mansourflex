export const FREQUENCY_MONTHS: Record<string, number> = {
  MONTHLY: 1,
  QUARTERLY: 3,
  SEMI_ANNUAL: 6,
  ANNUAL: 12,
  ONE_TIME: 0,
};

export type RentAmountType = "TOTAL" | "ANNUAL" | "INCREASING";

export type ScheduledPayment = {
  dueDate: Date;
  baseAmount: number;
  vatAmount: number;
  amount: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Adds whole calendar months while keeping the contract's due day.
 *
 * Plain `setMonth` overflows — 31 January plus one month becomes 3 March, and every later
 * instalment stays shifted. Anchoring on the original day and clamping to the last day of a
 * shorter month gives what a lease actually says: 31 Jan → 28 Feb → 31 Mar → 30 Apr.
 */
function addMonths(start: Date, months: number) {
  const day = start.getDate();
  const target = new Date(start);
  target.setDate(1); // ينحّي يوم الشهر مؤقتاً حتى لا تفيض الإضافة
  target.setMonth(target.getMonth() + months);

  const lastDayOfTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDayOfTarget));
  target.setHours(start.getHours(), start.getMinutes(), start.getSeconds(), start.getMilliseconds());
  return target;
}

/**
 * End date for a term entered as years/months/days, the way a lease states it: the last day
 * is inside the term, so a one-year contract starting 15 Jan 2026 ends 14 Jan 2027 — the same
 * rule Ejar applies. Month-end is clamped, so 31 Jan + 1 year ends 30 Jan, never a drifted date.
 */
export function endDateFromTerm(start: Date, years: number, months: number, days: number) {
  const totalMonths = years * 12 + months;
  const end = addMonths(start, totalMonths);
  end.setDate(end.getDate() + days - 1); // اليوم الأخير محسوب ضمن المدة
  return end;
}

/** The reverse, for an end date typed by hand: whole years, then months, then leftover days. */
export function termFromEndDate(start: Date, end: Date) {
  const inclusiveEnd = new Date(end);
  inclusiveEnd.setDate(inclusiveEnd.getDate() + 1); // نعود ليوم ما بعد النهاية لتُحسب المدة كاملة

  let months = 0;
  while (addMonths(start, months + 1) <= inclusiveEnd) months++;

  const afterMonths = addMonths(start, months);
  const days = Math.round((inclusiveEnd.getTime() - afterMonths.getTime()) / 86400000);

  return { years: Math.floor(months / 12), months: months % 12, days: Math.max(0, days) };
}

function withVat(dueDate: Date, base: number, vatRate: number): ScheduledPayment {
  const baseAmount = round2(base);
  const amount = round2(base * (1 + vatRate / 100));
  return { dueDate, baseAmount, vatAmount: round2(amount - baseAmount), amount };
}

/**
 * Builds the installment schedule from the entered amount and how it should be interpreted:
 * - TOTAL: `amount` is the whole contract value, split evenly across all installments.
 * - ANNUAL: `amount` is the yearly rent, split evenly across each year's installments.
 * - INCREASING: `amount` is the first year's rent; each subsequent contract year is
 *   escalated by `increasePercent`, then split across that year's installments.
 * VAT (`vatRate`, a percentage) is applied on top of every installment; each returned
 * row carries the pre-tax base, the VAT amount, and the total (base + VAT).
 *
 * Shared between the contract creation Server Action and the client-side schedule preview,
 * so the preview the admin sees always matches what actually gets created.
 */
export function buildPaymentSchedule(
  start: Date,
  end: Date,
  amount: number,
  frequency: string,
  amountType: RentAmountType,
  increasePercent: number,
  vatRate: number
): ScheduledPayment[] {
  if (frequency === "ONE_TIME") {
    return [withVat(start, amount, vatRate)];
  }

  const step = FREQUENCY_MONTHS[frequency] ?? 1;
  const dates: Date[] = [];
  for (let i = 0; ; i++) {
    const due = addMonths(start, i * step);
    if (due >= end) break;
    dates.push(due);
  }

  const installmentsPerYear = Math.max(1, Math.round(12 / step));

  if (amountType === "TOTAL") {
    const perInstallment = amount / dates.length;
    return dates.map((dueDate) => withVat(dueDate, perInstallment, vatRate));
  }

  if (amountType === "ANNUAL") {
    const perInstallment = amount / installmentsPerYear;
    return dates.map((dueDate) => withVat(dueDate, perInstallment, vatRate));
  }

  // INCREASING
  return dates.map((dueDate) => {
    const monthsSinceStart =
      (dueDate.getFullYear() - start.getFullYear()) * 12 + (dueDate.getMonth() - start.getMonth());
    const yearIndex = Math.floor(monthsSinceStart / 12);
    const yearlyAmount = amount * Math.pow(1 + increasePercent / 100, yearIndex);
    return withVat(dueDate, yearlyAmount / installmentsPerYear, vatRate);
  });
}
