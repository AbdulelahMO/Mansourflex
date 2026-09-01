import { describe, it, expect } from "vitest";
import { commissionAccount } from "@/lib/commission-account";

describe("حساب أتعاب الإدارة", () => {
  it("ما لم يُسوَّ بسند يبقى مستحقاً", () => {
    const a = commissionAccount({ earned: 10000, settled: 0 });

    expect(a.unsettled).toBe(10000);
  });

  it("السند يُسقط ما يقابله سواء خُصم من توريد أو قُبض من المالك", () => {
    const a = commissionAccount({ earned: 10000, settled: 4000 });

    expect(a.unsettled).toBe(6000);
  });

  it("التسوية الكاملة تُصفّر المستحق", () => {
    expect(commissionAccount({ earned: 9728, settled: 9728 }).unsettled).toBe(0);
  });

  it("تسويةٌ تتجاوز المستحق لا تقلبه إلى دين على المشغل", () => {
    // يقع هذا حين يُلغى تحصيل بعد أن سُوّيت أتعابه — والمعالجة أن يُلغى سند الأتعاب أيضاً.
    expect(commissionAccount({ earned: 5000, settled: 6000 }).unsettled).toBe(0);
  });

  it("لا اتفاقية فلا أتعاب ولا مستحق", () => {
    expect(commissionAccount({ earned: 0, settled: 0 }).unsettled).toBe(0);
  });

  it("يحسب بالهللات لا بكسور ثنائية", () => {
    const a = commissionAccount({ earned: 1583.33, settled: 1000.1 });

    expect(a.unsettled).toBe(583.23);
  });
});
