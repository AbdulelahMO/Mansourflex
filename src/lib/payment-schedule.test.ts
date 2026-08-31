import { describe, it, expect } from "vitest";
import { buildPaymentSchedule, endDateFromTerm, termFromEndDate } from "./payment-schedule";

const d = (s: string) => new Date(s + "T00:00:00");
// Local, not UTC: toISOString would shift a Riyadh midnight back a day and make the test lie.
const iso = (x: Date) =>
  `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
const sum = (ns: number[]) => Math.round(ns.reduce((a, b) => a + b, 0) * 100) / 100;

describe("مدة العقد", () => {
  it("تنتهي السنة في اليوم السابق لتاريخ بدايتها — كما تحسبها إيجار", () => {
    expect(iso(endDateFromTerm(d("2026-01-01"), 1, 0, 0))).toBe("2026-12-31");
  });

  it("لا تنزلق نهاية الشهر: 31 يناير + شهر = 28 فبراير لا 3 مارس", () => {
    expect(iso(endDateFromTerm(d("2026-01-31"), 0, 1, 0))).toBe("2026-02-27");
  });

  it("المدة والتاريخ وجهان لحساب واحد", () => {
    const end = endDateFromTerm(d("2026-03-15"), 2, 6, 0);
    expect(termFromEndDate(d("2026-03-15"), end)).toEqual({ years: 2, months: 6, days: 0 });
  });
});

describe("توليد الأقساط", () => {
  it("السنوي على أربعة أرباع: قسط لكل ثلاثة أشهر", () => {
    const s = buildPaymentSchedule(d("2026-01-01"), d("2027-01-01"), 120000, "QUARTERLY", "ANNUAL", 0, 0);
    expect(s).toHaveLength(4);
    expect(s.map((p) => p.amount)).toEqual([30000, 30000, 30000, 30000]);
    expect(s.map((p) => iso(p.dueDate))).toEqual(["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"]);
  });

  it("الإجمالي يُقسَّم على عدد الأقساط مهما طالت المدة", () => {
    const s = buildPaymentSchedule(d("2026-01-01"), d("2028-01-01"), 240000, "ANNUAL", "TOTAL", 0, 0);
    expect(s).toHaveLength(2);
    expect(sum(s.map((p) => p.amount))).toBe(240000);
  });

  it("المتزايد يرفع الإيجار سنوياً لا شهرياً", () => {
    const s = buildPaymentSchedule(d("2026-01-01"), d("2028-01-01"), 100000, "ANNUAL", "INCREASING", 10, 0);
    expect(s.map((p) => p.amount)).toEqual([100000, 110000]);
  });

  it("لا يُولَّد قسط في تاريخ النهاية نفسه", () => {
    const s = buildPaymentSchedule(d("2026-01-01"), d("2027-01-01"), 12000, "MONTHLY", "ANNUAL", 0, 0);
    expect(s).toHaveLength(12);
    expect(iso(s[11].dueDate)).toBe("2026-12-01");
  });

  it("أقساط الشهري تلتزم بيوم الشهر ولا تنزلق عبر فبراير", () => {
    const s = buildPaymentSchedule(d("2026-01-31"), d("2026-06-01"), 50000, "MONTHLY", "ANNUAL", 0, 0);
    expect(s.map((p) => iso(p.dueDate))).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
      "2026-04-30",
      "2026-05-31",
    ]);
  });
});

describe("ضريبة القيمة المضافة", () => {
  it("تُضاف فوق الإيجار ويُفصَّل أصلها في كل قسط", () => {
    const s = buildPaymentSchedule(d("2026-01-01"), d("2027-01-01"), 100000, "ANNUAL", "ANNUAL", 0, 15);
    expect(s[0].baseAmount).toBe(100000);
    expect(s[0].vatAmount).toBe(15000);
    expect(s[0].amount).toBe(115000);
  });

  it("بلا ضريبة لا يزيد المبلغ عن أصله", () => {
    const s = buildPaymentSchedule(d("2026-01-01"), d("2027-01-01"), 100000, "ANNUAL", "ANNUAL", 0, 0);
    expect(s[0].vatAmount).toBe(0);
    expect(s[0].amount).toBe(s[0].baseAmount);
  });

  it("المبالغ مقرَّبة إلى الهللة، فلا كسور لا تُدفع", () => {
    const s = buildPaymentSchedule(d("2026-01-01"), d("2027-01-01"), 100000, "MONTHLY", "ANNUAL", 0, 15);
    for (const p of s) expect(p.amount).toBe(Math.round(p.amount * 100) / 100);
  });
});

describe("الدفعة الواحدة", () => {
  it("قسط واحد في تاريخ البداية بكامل المبلغ", () => {
    const s = buildPaymentSchedule(d("2026-05-10"), d("2027-05-09"), 60000, "ONE_TIME", "TOTAL", 0, 0);
    expect(s).toHaveLength(1);
    expect(s[0].amount).toBe(60000);
    expect(iso(s[0].dueDate)).toBe("2026-05-10");
  });
});
