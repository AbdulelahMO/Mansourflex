import { describe, it, expect } from "vitest";
import { round2, issueReceiptForPayment, type DocumentKind } from "./documents-core";

/**
 * A stand-in for the database that records what was written.
 *
 * The receipt rules are the ones that must never drift — what a receipt is worth, and whether an
 * invoice stands behind it — and they are decided in this function, not in the database. Passing
 * a stub in place of the client exercises the decision itself, and lets a test say plainly what
 * a rule is: three collections of 200, 300 and 500 leave three receipts, not one of a thousand.
 */
function stubDb(opts: {
  amount: number;
  paidAmount: number | null;
  vatRate?: number;
  taxNumber?: string | null;
  receipts?: number[];
  invoice?: boolean;
}) {
  const written: { type: DocumentKind; amount: number; hasTax: boolean }[] = [];
  const receipts = (opts.receipts ?? []).map((amount) => ({ amount }));

  const db = {
    payment: {
      findUnique: async () => ({
        id: "p1",
        amount: opts.amount,
        paidAmount: opts.paidAmount,
        contract: {
          id: "c1",
          vatRate: opts.vatRate ?? 0,
          unit: { building: { owner: { taxNumber: opts.taxNumber ?? null } } },
        },
      }),
    },
    financialDocument: {
      // Two callers share this method: the numbering scan asks for issued numbers, and the
      // unreceipted-balance sum asks for receipt amounts. Telling them apart keeps the stub
      // honest about what each one actually reads.
      findMany: async ({ where }: { where: { documentNumber?: unknown } }) =>
        where?.documentNumber ? [] : receipts,
      findFirst: async () => (opts.invoice ? { documentNumber: "INV-2026-0001" } : null),
      create: async ({ data }: { data: { type: DocumentKind; amount: number; hasTax: boolean } }) => {
        written.push({ type: data.type, amount: data.amount, hasTax: data.hasTax });
        return { ...data, documentNumber: `${data.type}-${written.length}` };
      },
    },
  };

  return { db, written };
}

const issue = (db: unknown, amount: number) =>
  issueReceiptForPayment("p1", { amount, db: db as never });

describe("تقريب المبالغ", () => {
  it("يمنع الكسر الثنائي من أن يقرّر ريالاً", () => {
    expect(round2(1583.33 - 934)).toBe(649.33);
    expect(1583.33 - 934).not.toBe(649.33);
  });
});

describe("سند القبض بمبلغ التحصيل وحده", () => {
  it("ثلاث تحصيلات تترك ثلاثة سندات بمبالغها لا سنداً بمجموعها", async () => {
    for (const [collected, sofar, expected] of [
      [200, [], 200],
      [300, [200], 300],
      [500, [200, 300], 500],
    ] as const) {
      const paid = (sofar as readonly number[]).reduce((a, b) => a + b, 0) + collected;
      const { db, written } = stubDb({ amount: 1000, paidAmount: paid, receipts: [...sofar], invoice: true });
      const res = await issue(db, collected);
      expect(res.ok).toBe(true);
      expect(written.filter((d) => d.type === "RECEIPT")[0].amount).toBe(expected);
    }
  });

  it("لا يُقرّ بأكثر مما حُصِّل ولم يُقرَّ به", async () => {
    // حُصِّل 1000 وصدرت سندات بـ900، فلا يبقى إلا 100 مهما طُلب
    const { db, written } = stubDb({ amount: 1000, paidAmount: 1000, receipts: [900], invoice: true });
    const res = await issue(db, 500);
    expect(res.ok).toBe(true);
    expect(written.find((d) => d.type === "RECEIPT")!.amount).toBe(100);
  });

  it("يُرفض إن أُقرَّ بكامل المحصّل", async () => {
    const { db } = stubDb({ amount: 1000, paidAmount: 500, receipts: [500], invoice: true });
    const res = await issue(db, 100);
    expect(res.ok).toBe(false);
  });

  it("يُرفض قبل أن يُسجَّل تحصيل", async () => {
    const { db } = stubDb({ amount: 1000, paidAmount: null });
    const res = await issue(db, 100);
    expect(res.ok).toBe(false);
  });
});

describe("الفاتورة تسبق السند", () => {
  it("تُستحدث بكامل القسط حين لا تكون صدرت", async () => {
    const { db, written } = stubDb({ amount: 1000, paidAmount: 200, invoice: false });
    const res = await issue(db, 200);
    expect(res.ok && res.invoiceNumber).toBeTruthy();
    expect(written.find((d) => d.type === "INVOICE")!.amount).toBe(1000);
    expect(written.find((d) => d.type === "RECEIPT")!.amount).toBe(200);
  });

  it("لا تتكرّر إن كانت صادرة", async () => {
    const { db, written } = stubDb({ amount: 1000, paidAmount: 200, invoice: true });
    const res = await issue(db, 200);
    expect(res.ok && res.invoiceNumber).toBeUndefined();
    expect(written.filter((d) => d.type === "INVOICE")).toHaveLength(0);
  });
});

describe("الوسم الضريبي", () => {
  it("من نسبة العقد لا من الرقم الضريبي للمالك", async () => {
    const withVat = stubDb({ amount: 1000, paidAmount: 200, vatRate: 15, taxNumber: null, invoice: false });
    await issue(withVat.db, 200);
    expect(withVat.written.every((d) => d.hasTax)).toBe(true);

    const noVat = stubDb({ amount: 1000, paidAmount: 200, vatRate: 0, taxNumber: "3001234567", invoice: false });
    await issue(noVat.db, 200);
    expect(noVat.written.every((d) => d.hasTax)).toBe(false);
  });
});
