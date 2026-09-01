import { round2 } from "@/lib/documents-core";

/**
 * How old the money is, not just how much.
 *
 * A hundred thousand a week late and a hundred thousand a year late are not the same debt: the
 * first is forgetfulness, the second rarely arrives without an action being taken over it. The
 * collection screen says «متأخر» and stops there, so nothing in the system answers «since when» —
 * which is the question that decides who is called first, whose contract is not renewed, and whose
 * claim goes to Najiz or comes out of the deposit.
 */
export const AGING_BUCKETS = [
  { key: "upTo30", label: "حتى 30 يوماً", maxDays: 30 },
  { key: "upTo60", label: "31 – 60 يوماً", maxDays: 60 },
  { key: "upTo90", label: "61 – 90 يوماً", maxDays: 90 },
  { key: "over90", label: "أكثر من 90 يوماً", maxDays: Infinity },
] as const;

export type BucketKey = (typeof AGING_BUCKETS)[number]["key"];

export type Buckets = Record<BucketKey, number>;

const emptyBuckets = (): Buckets => ({ upTo30: 0, upTo60: 0, upTo90: 0, over90: 0 });

/** Whole days between the day it fell due and the day the report is drawn. Due today is 0. */
export function daysOverdue(dueDate: Date, asOf: Date): number {
  const days = Math.floor((asOf.getTime() - dueDate.getTime()) / 86_400_000);
  return Math.max(0, days);
}

export function bucketFor(days: number): BucketKey {
  return (AGING_BUCKETS.find((b) => days <= b.maxDays) ?? AGING_BUCKETS[AGING_BUCKETS.length - 1]).key;
}

export type AgingItem = {
  tenantId: string;
  tenantName: string;
  /** Where the debt arose — kept so a row can name the property it came from. */
  buildingName?: string | null;
  unitNumber?: string | null;
  dueDate: Date;
  /** What the instalment is still short. */
  remaining: number;
  /** A claim already before Najiz is being pursued, and says so on its row. */
  referred?: boolean;
};

export type AgingRow = {
  tenantId: string;
  tenantName: string;
  buckets: Buckets;
  total: number;
  /** The age of this tenant's oldest unpaid instalment — what the rows are ordered by. */
  oldestDays: number;
  /** Instalments behind the total, so a row of one late payment is not read as a chronic debtor. */
  instalments: number;
  places: string[];
  referred: boolean;
};

export type Aging = { rows: AgingRow[]; totals: Buckets & { total: number; instalments: number } };

/**
 * One row per tenant, because the debt follows the tenant and not the unit: a tenant behind on two
 * units is one conversation, not two. Rows come back oldest-first — the order the calls are made
 * in, since the oldest debt is the one about to be lost.
 */
export function summarizeAging(items: readonly AgingItem[], asOf: Date = new Date()): Aging {
  const byTenant = new Map<string, AgingRow>();

  for (const item of items) {
    if (item.remaining <= 0) continue;

    const row =
      byTenant.get(item.tenantId) ??
      {
        tenantId: item.tenantId,
        tenantName: item.tenantName,
        buckets: emptyBuckets(),
        total: 0,
        oldestDays: 0,
        instalments: 0,
        places: [],
        referred: false,
      };

    const days = daysOverdue(item.dueDate, asOf);
    const key = bucketFor(days);

    row.buckets[key] = round2(row.buckets[key] + item.remaining);
    row.total = round2(row.total + item.remaining);
    row.oldestDays = Math.max(row.oldestDays, days);
    row.instalments += 1;
    row.referred = row.referred || !!item.referred;

    const place = [item.buildingName, item.unitNumber].filter(Boolean).join(" - ");
    if (place && !row.places.includes(place)) row.places.push(place);

    byTenant.set(item.tenantId, row);
  }

  const rows = [...byTenant.values()].sort((a, b) => b.oldestDays - a.oldestDays || b.total - a.total);

  const totals = { ...emptyBuckets(), total: 0, instalments: 0 };
  for (const row of rows) {
    for (const bucket of AGING_BUCKETS) {
      totals[bucket.key] = round2(totals[bucket.key] + row.buckets[bucket.key]);
    }
    totals.total = round2(totals.total + row.total);
    totals.instalments += row.instalments;
  }

  return { rows, totals };
}
