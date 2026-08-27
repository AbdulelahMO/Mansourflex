export const HIJRI_MONTHS = [
  "محرم",
  "صفر",
  "ربيع الأول",
  "ربيع الآخر",
  "جمادى الأولى",
  "جمادى الآخرة",
  "رجب",
  "شعبان",
  "رمضان",
  "شوال",
  "ذو القعدة",
  "ذو الحجة",
];

export type HijriDate = { year: number; month: number; day: number };

/**
 * Umm al-Qura — the calendar Saudi official documents (deeds, contracts) are dated by.
 * Used instead of the arithmetic/tabular Hijri calendar, which drifts a day either way.
 */
const umAlQura = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", {
  day: "numeric",
  month: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Noon UTC keeps the conversion clear of timezone edges on either side of midnight. */
function atNoonUTC(date: Date) {
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12));
}

export function gregorianToHijri(date: Date): HijriDate {
  const parts = umAlQura.formatToParts(atNoonUTC(date));
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return { year: get("year"), month: get("month"), day: get("day") };
}

const DAY_MS = 86_400_000;

/**
 * Inverse of {@link gregorianToHijri}. Intl converts one way only, so this estimates the
 * Gregorian date from the mean Hijri year length, then scans nearby days for an exact match.
 * Returns null when the date does not exist (e.g. day 30 of a 29-day month).
 */
export function hijriToGregorian(year: number, month: number, day: number): Date | null {
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 30) return null;

  // Mean Hijri year ≈ 354.367 days, counted from the epoch (1 Muharram 1 AH).
  const estimateMs = Date.UTC(622, 6, 16, 12) + ((year - 1) * 354.367 + (month - 1) * 29.53 + (day - 1)) * DAY_MS;
  const estimate = new Date(estimateMs);
  const base = new Date(estimate.getUTCFullYear(), estimate.getUTCMonth(), estimate.getUTCDate());

  // The estimate lands within a few days; the window absorbs its drift comfortably.
  for (let offset = -60; offset <= 60; offset++) {
    const candidate = new Date(base.getFullYear(), base.getMonth(), base.getDate() + offset);
    const h = gregorianToHijri(candidate);
    if (h.year === year && h.month === month && h.day === day) return candidate;
  }
  return null;
}

/** Number of days in a Umm al-Qura month, probed through the conversion itself. */
export function hijriMonthLength(year: number, month: number): number {
  return hijriToGregorian(year, month, 30) ? 30 : 29;
}

export function formatHijri(date: Date): string {
  const { year, month, day } = gregorianToHijri(date);
  return `${day} ${HIJRI_MONTHS[month - 1] ?? ""} ${year} هـ`;
}
