const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة"];
const TEENS = [
  "عشرة",
  "أحد عشر",
  "اثنا عشر",
  "ثلاثة عشر",
  "أربعة عشر",
  "خمسة عشر",
  "ستة عشر",
  "سبعة عشر",
  "ثمانية عشر",
  "تسعة عشر",
];
const TENS = ["", "", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مئتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

const SCALES = [
  { singular: "", dual: "", plural: "", accusative: "" },
  { singular: "ألف", dual: "ألفان", plural: "آلاف", accusative: "ألفا" },
  { singular: "مليون", dual: "مليونان", plural: "ملايين", accusative: "مليونا" },
  { singular: "مليار", dual: "ملياران", plural: "مليارات", accusative: "مليارا" },
];

function twoDigitsWords(n: number): string {
  if (n === 0) return "";
  if (n < 10) return ONES[n];
  if (n < 20) return TEENS[n - 10];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o === 0 ? TENS[t] : `${ONES[o]} و${TENS[t]}`;
}

function threeDigitsWords(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h > 0) parts.push(HUNDREDS[h]);
  const restWords = twoDigitsWords(rest);
  if (restWords) parts.push(restWords);
  return parts.join(" و");
}

function scaleWord(n: number, scaleIndex: number): string {
  const forms = SCALES[scaleIndex];
  const last2 = n % 100;
  if (last2 >= 3 && last2 <= 10) return forms.plural;
  if (last2 >= 11 && last2 <= 99) return forms.accusative;
  if (last2 === 2) return forms.dual;
  return forms.singular; // last2 is 0 or 1
}

/** Converts a non-negative integer into Arabic words (تفقيط), e.g. 17500 -> "سبعة عشر ألفا وخمسمائة". */
export function numberToArabicWords(value: number): string {
  const n = Math.round(Math.abs(value));
  if (n === 0) return "صفر";
  if (n >= 1_000_000_000_000) return String(n); // out of supported range

  const groups: number[] = [];
  let rem = n;
  while (rem > 0) {
    groups.unshift(rem % 1000);
    rem = Math.floor(rem / 1000);
  }

  const parts: string[] = [];
  groups.forEach((g, i) => {
    if (g === 0) return;
    const scaleIndex = groups.length - 1 - i;
    const last2 = g % 100;
    const skipOnesWord = scaleIndex > 0 && (last2 === 1 || last2 === 2);
    const groupWords = skipOnesWord
      ? Math.floor(g / 100) > 0
        ? HUNDREDS[Math.floor(g / 100)]
        : ""
      : threeDigitsWords(g);
    const scale = scaleIndex > 0 ? scaleWord(g, scaleIndex) : "";
    const combined = [groupWords, scale].filter(Boolean).join(" ");
    parts.push(combined);
  });

  return parts.join(" و");
}

/** Converts a SAR amount into a full Arabic sentence, e.g. 17500 -> "سبعة عشر ألفا وخمسمائة ريال سعودي". */
export function amountToArabicWords(value: number): string {
  return `${numberToArabicWords(value)} ريال سعودي`;
}
