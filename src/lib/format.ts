const currencyFormatter = new Intl.NumberFormat("ar-SA-u-nu-latn", {
  style: "currency",
  currency: "SAR",
  maximumFractionDigits: 0,
});

/**
 * The same currency, with its halalas kept and shown only when there are any.
 *
 * A statement is added up by the person holding it: rent split into instalments rarely lands on
 * whole riyals, and two lines of 7,187.50 rounded to riyals read as 7,188 + 7,188 = 14,375, which
 * makes a correct ledger look wrong.
 */
const preciseCurrencyFormatter = new Intl.NumberFormat("ar-SA-u-nu-latn", {
  style: "currency",
  currency: "SAR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCurrencyPrecise(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return preciseCurrencyFormatter.format(value);
}

const dateFormatter = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
  year: "numeric",
  month: "long",
  day: "numeric",
});

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return currencyFormatter.format(value);
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(new Date(value));
}

/** DD/MM/YYYY, for bilingual documents where the same numeric date is shown in both languages. */
export function formatDateNumeric(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = new Date(value);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** YYYY-MM-DD, for pre-filling a native `<input type="date">` from a stored Date/string value. */
export function toDateInputValue(value?: string | Date | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}
