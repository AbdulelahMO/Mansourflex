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
  const cursor = new Date(start);
  while (cursor < end) {
    dates.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + step);
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
