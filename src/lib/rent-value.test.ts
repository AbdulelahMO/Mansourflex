import { describe, it, expect } from "vitest";
import { annualRent } from "@/lib/rent-value";

const at = (iso: string) => new Date(`${iso}T00:00:00`);

const lease = (over: Partial<Parameters<typeof annualRent>[0]> = {}) => ({
  rentAmount: 60000,
  amountType: "ANNUAL" as const,
  increasePercent: null,
  startDate: at("2026-01-01"),
  endDate: at("2026-12-31"),
  ...over,
});

describe("annualRent", () => {
  it("takes a yearly lease at its word", () => {
    expect(annualRent(lease(), at("2026-06-01")).amount).toBe(60000);
  });

  it("divides a whole-term value over the years of the term", () => {
    // 150,000 for two years is 75,000 a year — never 150,000.
    const r = annualRent(
      lease({ rentAmount: 150000, amountType: "TOTAL", endDate: at("2027-12-31") }),
      at("2026-06-01")
    );

    expect(r.termYears).toBe(2);
    expect(r.amount).toBe(75000);
  });

  it("raises a rising lease by its percentage once the second year begins", () => {
    const rising = lease({
      rentAmount: 71300,
      amountType: "INCREASING",
      increasePercent: 7.5,
      endDate: at("2028-04-21"),
      startDate: at("2026-04-22"),
    });

    expect(annualRent(rising, at("2026-09-01")).amount).toBe(71300);
    expect(annualRent(rising, at("2026-09-01")).yearIndex).toBe(1);

    const second = annualRent(rising, at("2027-06-01"));
    expect(second.yearIndex).toBe(2);
    expect(second.amount).toBe(76647.5);
  });

  it("does not step up on the day before the anniversary", () => {
    const rising = lease({
      rentAmount: 100000,
      amountType: "INCREASING",
      increasePercent: 10,
      startDate: at("2026-04-22"),
      endDate: at("2028-04-21"),
    });

    expect(annualRent(rising, at("2027-04-21")).amount).toBe(100000);
    expect(annualRent(rising, at("2027-04-22")).amount).toBe(110000);
  });

  it("keeps a statement drawn after the lease ended inside the term", () => {
    const rising = lease({
      rentAmount: 100000,
      amountType: "INCREASING",
      increasePercent: 10,
      startDate: at("2024-01-01"),
      endDate: at("2025-12-31"),
    });

    // Five years on, the lease still only ever had two years — the second is its last.
    expect(annualRent(rising, at("2030-01-01")).yearIndex).toBe(2);
    expect(annualRent(rising, at("2030-01-01")).amount).toBe(110000);
  });

  it("treats a lease shorter than a year as its own year without inflating it", () => {
    const short = lease({ rentAmount: 30000, amountType: "TOTAL", endDate: at("2026-06-30") });
    const r = annualRent(short, at("2026-03-01"));

    expect(r.termYears).toBeCloseTo(0.5, 2);
    expect(r.amount).toBe(60000); // نصف سنة بـ30,000 = 60,000 سنوياً
    expect(r.yearIndex).toBe(1);
  });
});
