import { describe, it, expect } from "vitest";
import { buildUnitNumbers, MAX_BULK_UNITS } from "./unit-numbering";

const numbers = (input: Parameters<typeof buildUnitNumbers>[0]) =>
  buildUnitNumbers(input).map((u) => u.unitNumber);

describe("الترقيم بالطوابق", () => {
  it("يرقّم كما تُرقَّم الأبواب: الطابق ثم الوحدة", () => {
    expect(numbers({ mode: "floors", floors: 3, perFloor: 4, firstFloor: 1 })).toEqual([
      "101", "102", "103", "104",
      "201", "202", "203", "204",
      "301", "302", "303", "304",
    ]);
  });

  it("الدور الأرضي يبدأ من صفر", () => {
    expect(numbers({ mode: "floors", floors: 2, perFloor: 2, firstFloor: 0 })).toEqual([
      "001", "002", "101", "102",
    ]);
  });

  it("يحمل كل وحدة طابقها", () => {
    const units = buildUnitNumbers({ mode: "floors", floors: 2, perFloor: 1, firstFloor: 5 });
    expect(units.map((u) => u.floor)).toEqual(["5", "6"]);
  });
});

describe("الترقيم المتسلسل", () => {
  it("يبدأ من الرقم المطلوب", () => {
    expect(numbers({ mode: "sequential", count: 3, startFrom: 7 })).toEqual(["7", "8", "9"]);
  });

  it("الحرف يسبق الرقم، وقد يكون عربياً", () => {
    expect(numbers({ mode: "sequential", count: 2, startFrom: 1, prefix: "M" })).toEqual(["M1", "M2"]);
    expect(numbers({ mode: "sequential", count: 2, startFrom: 1, prefix: "محل " })).toEqual(["محل 1", "محل 2"]);
  });

  it("لا طابق للمتسلسل، فليس مشتقاً من مبنى مطابق", () => {
    expect(buildUnitNumbers({ mode: "sequential", count: 1 })[0].floor).toBeNull();
  });
});

describe("الحدود", () => {
  it("لا يُنتج شيئاً من إدخال فارغ", () => {
    expect(numbers({ mode: "floors", floors: 0, perFloor: 4 })).toEqual([]);
    expect(numbers({ mode: "sequential", count: 0 })).toEqual([]);
  });

  it("لا يتجاوز السقف مهما طُلب — فخطأٌ في رقم لا يكتب آلافاً", () => {
    expect(numbers({ mode: "floors", floors: 300, perFloor: 4 })).toHaveLength(MAX_BULK_UNITS);
    expect(numbers({ mode: "sequential", count: 5000 })).toHaveLength(MAX_BULK_UNITS);
  });
});
