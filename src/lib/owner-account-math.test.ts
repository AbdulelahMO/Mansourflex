import { describe, it, expect } from "vitest";
import { computeAccount } from "./owner-account-math";

const base = {
  billed: 100000,
  outstanding: 0,
  collected: 100000,
  collectedByOwner: 0,
  ownerExpenses: 0,
  commissionPercent: 10,
  remitted: 0,
};

describe("عمولة الإدارة", () => {
  it("تُحسب على المحصّل لا على المستحق", () => {
    const a = computeAccount({ ...base, billed: 200000, collected: 100000, outstanding: 100000 });
    expect(a.commission).toBe(10000);
  });

  it("تُحسب بعد خصم مصروفات المالك لا قبلها", () => {
    const a = computeAccount({ ...base, ownerExpenses: 20000 });
    expect(a.netCollected).toBe(80000);
    expect(a.commission).toBe(8000);
    expect(a.payableToOwner).toBe(72000);
  });

  it("بلا اتفاقية إدارة لا عمولة، والمحصّل كله للمالك", () => {
    const a = computeAccount({ ...base, commissionPercent: 0 });
    expect(a.commission).toBe(0);
    expect(a.payableToOwner).toBe(100000);
  });
});

describe("رصيد المالك", () => {
  it("ما قبضه المالك مباشرة يُخصم من مستحقه ولا تسقط عنه العمولة", () => {
    const a = computeAccount({ ...base, collectedByOwner: 40000 });
    expect(a.commission).toBe(10000);
    expect(a.balance).toBe(50000);
  });

  it("ما ورِّد له يُخصم أيضاً", () => {
    const a = computeAccount({ ...base, remitted: 60000 });
    expect(a.balance).toBe(30000);
  });

  it("يصير سالباً إن قبض المالك أكثر من مستحقه — فالعمولة دين عليه", () => {
    const a = computeAccount({ ...base, collectedByOwner: 100000 });
    expect(a.balance).toBe(-10000);
  });

  it("لا شيء محصّلاً فلا شيء مستحقاً", () => {
    const a = computeAccount({ ...base, collected: 0, billed: 100000, outstanding: 100000 });
    expect(a.commission).toBe(0);
    expect(a.balance).toBe(0);
  });
});

describe("التقريب", () => {
  it("لا يورث كسوراً لا تُدفع", () => {
    const a = computeAccount({ ...base, collected: 33333.33, commissionPercent: 7.5 });
    expect(a.commission).toBe(2500);
    expect(a.payableToOwner).toBe(30833.33);
    expect(a.balance).toBe(30833.33);
  });
});
