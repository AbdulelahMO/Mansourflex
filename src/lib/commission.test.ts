import { describe, it, expect } from "vitest";
import { netCollected, commissionBase, commissionAmount, vatWithin } from "@/lib/commission";

const terms = { percent: 10, agreementId: "a", agreementNumber: "AG-1" };

describe("أساس العمولة", () => {
  it("يخصم المصروفات والضريبة كلتيهما", () => {
    const amounts = { collected: 115000, expenses: 15000, vat: 15000 };

    expect(netCollected(amounts)).toBe(100000);
    expect(commissionBase(amounts)).toBe(85000);
    expect(commissionAmount(terms, amounts)).toBe(8500);
  });

  it("لا يتغيّر حساب العقد غير الخاضع للضريبة", () => {
    expect(commissionAmount(terms, { collected: 100000 })).toBe(10000);
  });
});

describe("استخراج الضريبة من التحصيل", () => {
  it("يأخذ كل دفعة بنسبة عقدها هي", () => {
    // عقار واحد قد تجتمع فيه نسب مختلفة: تجاري 15%، وآخر 5%، وسكني معفى.
    const payments = [
      { paidAmount: 115, contract: { vatRate: 15 } },
      { paidAmount: 105, contract: { vatRate: 5 } },
      { paidAmount: 100, contract: { vatRate: 0 } },
    ];

    expect(vatWithin(payments)).toBe(20);
  });

  it("لا ضريبة في دفعة لم تُحصّل", () => {
    expect(vatWithin([{ paidAmount: null, contract: { vatRate: 15 } }])).toBe(0);
  });

  it("يجمع بالهللات لا بكسور ثنائية", () => {
    const payments = [
      { paidAmount: 1583.33, contract: { vatRate: 15 } },
      { paidAmount: 1583.33, contract: { vatRate: 15 } },
    ];

    expect(vatWithin(payments)).toBe(413.04);
  });
});
