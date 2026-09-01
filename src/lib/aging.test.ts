import { describe, it, expect } from "vitest";
import { summarizeAging, daysOverdue, bucketFor, type AgingItem } from "@/lib/aging";

const at = (iso: string) => new Date(`${iso}T00:00:00`);
const asOf = at("2026-09-01");

const item = (over: Partial<AgingItem> & { dueDate: Date; remaining: number }): AgingItem => ({
  tenantId: "t1",
  tenantName: "خالد",
  ...over,
});

describe("daysOverdue / bucketFor", () => {
  it("counts an instalment due today as nothing overdue yet", () => {
    expect(daysOverdue(asOf, asOf)).toBe(0);
    expect(bucketFor(0)).toBe("upTo30");
  });

  it("never reports a negative age for an instalment not yet due", () => {
    expect(daysOverdue(at("2026-12-01"), asOf)).toBe(0);
  });

  it("puts each boundary in the bucket it is named for", () => {
    expect(bucketFor(30)).toBe("upTo30");
    expect(bucketFor(31)).toBe("upTo60");
    expect(bucketFor(60)).toBe("upTo60");
    expect(bucketFor(61)).toBe("upTo90");
    expect(bucketFor(90)).toBe("upTo90");
    expect(bucketFor(91)).toBe("over90");
    expect(bucketFor(900)).toBe("over90");
  });
});

describe("summarizeAging", () => {
  it("splits one tenant's debts across the buckets by age", () => {
    const { rows, totals } = summarizeAging(
      [
        item({ dueDate: at("2026-08-20"), remaining: 1000 }), // 12 يوماً
        item({ dueDate: at("2026-07-15"), remaining: 2000 }), // 48 يوماً
        item({ dueDate: at("2026-01-01"), remaining: 3000 }), // أكثر من 90
      ],
      asOf
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].buckets).toEqual({ upTo30: 1000, upTo60: 2000, upTo90: 0, over90: 3000 });
    expect(rows[0].total).toBe(6000);
    expect(rows[0].instalments).toBe(3);
    expect(totals.total).toBe(6000);
  });

  it("keeps a tenant's two units on one row — the debt follows the tenant", () => {
    const { rows } = summarizeAging(
      [
        item({ dueDate: at("2026-08-01"), remaining: 500, buildingName: "برج الواحة", unitNumber: "201" }),
        item({ dueDate: at("2026-08-01"), remaining: 700, buildingName: "برج الواحة", unitNumber: "305" }),
      ],
      asOf
    );

    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(1200);
    expect(rows[0].places).toEqual(["برج الواحة - 201", "برج الواحة - 305"]);
  });

  it("orders the oldest debt first, whatever its size", () => {
    const { rows } = summarizeAging(
      [
        item({ tenantId: "big", tenantName: "كبير", dueDate: at("2026-08-25"), remaining: 90000 }),
        item({ tenantId: "old", tenantName: "قديم", dueDate: at("2025-02-01"), remaining: 400 }),
      ],
      asOf
    );

    expect(rows.map((r) => r.tenantId)).toEqual(["old", "big"]);
    expect(rows[0].oldestDays).toBeGreaterThan(500);
  });

  it("carries the Najiz referral onto the row so a pursued claim is not chased twice", () => {
    const { rows } = summarizeAging(
      [
        item({ dueDate: at("2026-01-01"), remaining: 1000, referred: true }),
        item({ dueDate: at("2026-08-01"), remaining: 500 }),
      ],
      asOf
    );

    expect(rows[0].referred).toBe(true);
  });

  it("leaves out an instalment that is short by nothing", () => {
    const { rows, totals } = summarizeAging([item({ dueDate: at("2026-01-01"), remaining: 0 })], asOf);

    expect(rows).toEqual([]);
    expect(totals.total).toBe(0);
  });

  it("adds up in halalas rather than leaving a binary tail", () => {
    const { totals } = summarizeAging(
      [
        item({ dueDate: at("2026-08-20"), remaining: 1583.33 }),
        item({ dueDate: at("2026-08-21"), remaining: 1583.33 }),
        item({ dueDate: at("2026-08-22"), remaining: 1583.34 }),
      ],
      asOf
    );

    expect(totals.upTo30).toBe(4750);
    expect(totals.total).toBe(4750);
  });

  it("totals every tenant's buckets, not only the first", () => {
    const { totals } = summarizeAging(
      [
        item({ tenantId: "a", dueDate: at("2026-08-25"), remaining: 100 }),
        item({ tenantId: "b", dueDate: at("2026-05-01"), remaining: 250 }),
      ],
      asOf
    );

    expect(totals.upTo30).toBe(100);
    expect(totals.over90).toBe(250);
    expect(totals.total).toBe(350);
    expect(totals.instalments).toBe(2);
  });
});
