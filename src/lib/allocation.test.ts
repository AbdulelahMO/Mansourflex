import { describe, it, expect } from "vitest";
import { allocate, remainingOn } from "./allocation";

const slot = (amount: number, paid: number | null = null) => ({ amount, paidAmount: paid });
const added = (r: ReturnType<typeof allocate>) => r.allocations.map((a) => a.add);

describe("ما تبقّى على القسط", () => {
  it("لا ينزل تحت الصفر مهما زاد المدفوع", () => {
    expect(remainingOn(slot(1000, 1200))).toBe(0);
  });

  it("يُقرَّب إلى الهللة فلا يمنع كسرٌ ثنائي سداداً تاماً", () => {
    expect(remainingOn(slot(1583.33, 934))).toBe(649.33);
  });
});

describe("ترحيل الفائض", () => {
  it("يملأ القسط الأول ثم ما بعده بالترتيب", () => {
    const r = allocate(2500, [slot(1000), slot(1000), slot(1000)]);
    expect(added(r)).toEqual([1000, 1000, 500]);
    expect(r.left).toBe(0);
  });

  it("لا يضع في قسط أكثر مما ينقصه", () => {
    const r = allocate(5000, [slot(1000, 700)]);
    expect(added(r)).toEqual([300]);
    expect(r.left).toBe(4700);
  });

  it("يتخطّى المسدَّد ولا يتوقف عنده", () => {
    const r = allocate(1500, [slot(1000, 1000), slot(1000), slot(1000)]);
    expect(added(r)).toEqual([1000, 500]);
    expect(r.allocations.map((a) => a.index)).toEqual([1, 2]);
  });

  it("يقول ما لم يجد له موضعاً بدل أن يضعه حيث لا يصح", () => {
    const r = allocate(3000, [slot(1000)]);
    expect(r.left).toBe(2000);
  });

  it("المتبقي المعروض على الشاشة يُقبل تماماً ولا يُردّ كتجاوز", () => {
    const r = allocate(649.33, [slot(1583.33, 934)]);
    expect(added(r)).toEqual([649.33]);
    expect(r.left).toBe(0);
  });

  it("لا يوزّع شيئاً من صفر", () => {
    expect(allocate(0, [slot(1000)]).allocations).toHaveLength(0);
  });
});

describe("خصم التأمين يوزَّع كما يوزَّع الفائض", () => {
  it("تأمين أقل من المتأخر يسدّ أقدمه ويبقي الباقي ديناً", () => {
    const r = allocate(3900, [slot(11213, 3613), slot(11213, 3812)]);
    expect(added(r)).toEqual([3900]);
    expect(r.left).toBe(0);
  });

  it("تأمين أكبر من المتأخر يسدّه كله ويبقى منه فائض", () => {
    const r = allocate(5000, [slot(1000, 500), slot(1000)]);
    expect(added(r)).toEqual([500, 1000]);
    expect(r.left).toBe(3500);
  });
});
