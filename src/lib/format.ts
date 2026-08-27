const currencyFormatter = new Intl.NumberFormat("ar-SA-u-nu-latn", {
  style: "currency",
  currency: "SAR",
  maximumFractionDigits: 0,
});

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
