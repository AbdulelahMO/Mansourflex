import { describe, it, expect } from "vitest";
import { buildStatement, type Movement } from "@/lib/tenant-statement-math";

/** Local time, so a Riyadh midnight is not pushed back a day by the timezone. */
const at = (iso: string) => new Date(`${iso}T00:00:00`);

const charge = (iso: string, amount: number, label = "قسط إيجار"): Movement => ({
  date: at(iso),
  kind: "CHARGE",
  label,
  amount,
});

const credit = (iso: string, amount: number, reference?: string): Movement => ({
  date: at(iso),
  kind: "CREDIT",
  label: "سند قبض",
  amount,
  reference,
});

describe("buildStatement", () => {
  it("runs the balance forward through charges and credits", () => {
    const s = buildStatement([charge("2026-01-01", 1000), credit("2026-01-05", 400)]);

    expect(s.lines.map((l) => l.balance)).toEqual([1000, 600]);
    expect(s.totals).toEqual({ charged: 1000, credited: 400, balance: 600 });
  });

  it("orders by date whatever order the movements arrive in", () => {
    const s = buildStatement([credit("2026-03-01", 500), charge("2026-01-01", 1000), charge("2026-02-01", 1000)]);

    expect(s.lines.map((l) => l.date.getMonth())).toEqual([0, 1, 2]);
    expect(s.totals.balance).toBe(1500);
  });

  it("charges a day before it credits it, so a settled month never reads negative", () => {
    const s = buildStatement([credit("2026-01-01", 1000), charge("2026-01-01", 1000)]);

    expect(s.lines[0].kind).toBe("CHARGE");
    expect(s.lines.map((l) => l.balance)).toEqual([1000, 0]);
  });

  it("carries what came before the period into an opening balance", () => {
    const s = buildStatement(
      [charge("2025-11-01", 1000), credit("2025-11-10", 300), charge("2026-01-01", 1000)],
      { from: at("2026-01-01") }
    );

    expect(s.opening).toBe(700);
    expect(s.lines).toHaveLength(1);
    // The debt from before the window is still owed at the close, and says so.
    expect(s.totals.balance).toBe(1700);
    expect(s.totals.charged).toBe(1000);
  });

  it("leaves out what falls after the period", () => {
    const s = buildStatement([charge("2026-01-01", 1000), charge("2026-06-01", 1000)], {
      to: at("2026-03-31"),
    });

    expect(s.lines).toHaveLength(1);
    expect(s.totals.balance).toBe(1000);
  });

  it("opens at zero when nothing precedes the period", () => {
    const s = buildStatement([charge("2026-01-01", 1000)], { from: at("2026-01-01") });

    expect(s.opening).toBe(0);
  });

  it("settles to zero in halalas rather than leaving a binary remainder", () => {
    // 1583.33 × 3 paid back in three receipts must close the account exactly.
    const s = buildStatement([
      charge("2026-01-01", 1583.33),
      charge("2026-02-01", 1583.33),
      charge("2026-03-01", 1583.34),
      credit("2026-03-05", 4750),
    ]);

    expect(s.totals.balance).toBe(0);
    expect(s.lines[3].balance).toBe(0);
  });

  it("credits the tenant with money in ahead of the rent it will cover", () => {
    const s = buildStatement([charge("2026-01-01", 1000), credit("2026-01-02", 3000)]);

    // Paid in advance: the account is in the tenant's favour until the next instalment falls due.
    expect(s.lines[1].balance).toBe(-2000);
    expect(s.totals.balance).toBe(-2000);
  });

  it("keeps an unvouched collection on the ledger and marked", () => {
    const s = buildStatement([
      charge("2026-01-01", 1000),
      { date: at("2026-01-03"), kind: "CREDIT", label: "تحصيل بلا سند", amount: 250, unvouched: true },
    ]);

    expect(s.lines[1].unvouched).toBe(true);
    expect(s.totals.balance).toBe(750);
  });

  it("returns an empty statement rather than failing on a contract with no movement", () => {
    const s = buildStatement([]);

    expect(s.lines).toEqual([]);
    expect(s.totals).toEqual({ charged: 0, credited: 0, balance: 0 });
  });
});
