import { describe, it, expect } from "vitest";
import { commissionAccount } from "@/lib/commission-account";

const base = { earned: 10000, operatorCollected: 100000, remitted: 0, receipted: 0 };

describe("حساب أتعاب الإدارة", () => {
  it("تُعدّ مخصومة ما دام مال المالك في يد المشغل", () => {
    const a = commissionAccount(base);

    expect(a.deducted).toBe(10000);
    expect(a.dueFromOwner).toBe(0);
  });

  it("تصير ديناً على المالك إذا قبض الإيجار بنفسه فلم يمرّ بالمشغل شيء", () => {
    const a = commissionAccount({ ...base, operatorCollected: 0 });

    expect(a.held).toBe(0);
    expect(a.deducted).toBe(0);
    expect(a.dueFromOwner).toBe(10000);
  });

  it("تُقسم حين يمسك المشغل بعض المال لا كله", () => {
    // 4,000 باقية في يد المشغل من مال المالك، والباقي قبضه المالك بنفسه.
    const a = commissionAccount({ ...base, operatorCollected: 30000, remitted: 26000 });

    expect(a.held).toBe(4000);
    expect(a.deducted).toBe(4000);
    expect(a.dueFromOwner).toBe(6000);
  });

  it("سند القبض يُسقط الدين ولو بقي المال في يد المشغل", () => {
    const a = commissionAccount({ ...base, operatorCollected: 0, receipted: 10000 });

    expect(a.dueFromOwner).toBe(0);
  });

  it("لا يُحتسب التوريد الزائد رصيداً بالسالب", () => {
    const a = commissionAccount({ ...base, operatorCollected: 5000, remitted: 9000 });

    expect(a.held).toBe(0);
    expect(a.dueFromOwner).toBe(10000);
  });

  it("قبضٌ يتجاوز العمولة لا يترك ديناً ولا يقلبه", () => {
    const a = commissionAccount({ ...base, operatorCollected: 0, receipted: 12000 });

    expect(a.dueFromOwner).toBe(0);
    expect(a.deducted).toBe(0);
  });

  it("لا عمولة ولا دين حين لا اتفاقية", () => {
    const a = commissionAccount({ earned: 0, operatorCollected: 50000, remitted: 0, receipted: 0 });

    expect(a.deducted).toBe(0);
    expect(a.dueFromOwner).toBe(0);
  });

  it("يجمع بالهللات لا بكسور ثنائية", () => {
    const a = commissionAccount({ earned: 1583.33, operatorCollected: 1000.1, remitted: 0.1, receipted: 0 });

    expect(a.held).toBe(1000);
    expect(a.deducted).toBe(1000);
    expect(a.dueFromOwner).toBe(583.33);
  });
});
