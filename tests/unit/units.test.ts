import { describe, expect, it } from "vitest";
import { convert, formatNumber, mergeKey, sumCompatible } from "@/lib/domain/units";
import { parseIngredientLine, parseIngredientLines } from "@/lib/domain/ingredient-parser";

describe("unit conversion", () => {
  it("converts between compatible metric units", () => {
    expect(convert(2, "dl", "ml")).toBe(200);
    expect(convert(1500, "g", "kg")).toBe(1.5);
    expect(convert(3, "tl", "rkl")).toBe(1);
    expect(convert(1, "l", "dl")).toBe(10);
  });

  it("refuses incompatible units", () => {
    expect(convert(1, "dl", "g")).toBeNull();
    expect(convert(1, "pkt", "g")).toBeNull();
    expect(convert(1, "tlk", "pkt")).toBeNull();
  });

  it("treats opaque units as mergeable only with themselves", () => {
    expect(mergeKey("tlk")).toBe("opaque:tlk");
    expect(mergeKey("pkt")).not.toBe(mergeKey("tlk"));
    expect(mergeKey("dl")).toBe(mergeKey("rkl"));
    expect(mergeKey(null)).toBe("count");
    expect(mergeKey("kpl")).toBe("count");
  });

  it("formats numbers Finnish style", () => {
    expect(formatNumber(1.5)).toBe("1,5");
    expect(formatNumber(2)).toBe("2");
    expect(formatNumber(0.333333)).toBe("0,33");
    expect(formatNumber(123.4)).toBe("123");
  });
});

describe("merging quantities", () => {
  it("2 dl + 100 ml cream → 3 dl", () => {
    expect(sumCompatible([{ quantity: 2, unit: "dl" }, { quantity: 100, unit: "ml" }])).toEqual({ quantity: 3, unit: "dl" });
  });

  it("keeps the unit when all lines share it", () => {
    expect(sumCompatible([{ quantity: 1, unit: "rkl" }, { quantity: 2, unit: "rkl" }])).toEqual({ quantity: 3, unit: "rkl" });
  });

  it("mixed spoons sum through ml", () => {
    expect(sumCompatible([{ quantity: 1, unit: "rkl" }, { quantity: 1, unit: "tl" }])).toEqual({ quantity: 20, unit: "ml" });
  });

  it("promotes to kg / l", () => {
    expect(sumCompatible([{ quantity: 600, unit: "g" }, { quantity: 0.5, unit: "kg" }])).toEqual({ quantity: 1.1, unit: "kg" });
    expect(sumCompatible([{ quantity: 8, unit: "dl" }, { quantity: 500, unit: "ml" }])).toEqual({ quantity: 1.3, unit: "l" });
  });

  it("throws on incompatible units instead of guessing", () => {
    expect(() => sumCompatible([{ quantity: 1, unit: "dl" }, { quantity: 1, unit: "g" }])).toThrow();
  });
});

describe("ingredient line parser", () => {
  it("parses Finnish lines", () => {
    expect(parseIngredientLine("2 dl kermaa")).toMatchObject({ quantity: 2, unit: "dl", name: "kermaa", prepNote: null });
    expect(parseIngredientLine("400 g nahatonta lohifileetä")).toMatchObject({ quantity: 400, unit: "g", name: "nahatonta lohifileetä" });
    expect(parseIngredientLine("1 sipuli hienonnettuna")).toMatchObject({ quantity: 1, unit: "kpl", name: "sipuli", prepNote: "hienonnettuna" });
    expect(parseIngredientLine("½ tl suolaa")).toMatchObject({ quantity: 0.5, unit: "tl", name: "suolaa" });
    expect(parseIngredientLine("2 kynttä valkosipulia")).toMatchObject({ quantity: 2, unit: "kynsi", name: "valkosipulia" });
    expect(parseIngredientLine("1 tlk (400 g) tomaattimurskaa")).toMatchObject({ quantity: 1, unit: "tlk", name: "tomaattimurskaa", prepNote: "400 g" });
    expect(parseIngredientLine("1-2 chiliä")).toMatchObject({ quantity: 2, unit: "kpl", name: "chiliä" });
    expect(parseIngredientLine("400g jauhelihaa")).toMatchObject({ quantity: 400, unit: "g", name: "jauhelihaa" });
  });

  it("converts imperial units to metric and keeps the original text", () => {
    const cup = parseIngredientLine("1 cup sour cream");
    expect(cup).toMatchObject({ quantity: 2.37, unit: "dl", name: "sour cream", originalText: "1 cup sour cream" });
    expect(parseIngredientLine("1 lb ground beef")).toMatchObject({ quantity: 453.6, unit: "g", name: "ground beef" });
    expect(parseIngredientLine("8 oz cheddar, grated")).toMatchObject({ quantity: 226.8, unit: "g", name: "cheddar", prepNote: "grated" });
    expect(parseIngredientLine("2 tbsp olive oil")).toMatchObject({ quantity: 2, unit: "rkl", name: "olive oil" });
    expect(parseIngredientLine("1 1/2 tsp salt")).toMatchObject({ quantity: 1.5, unit: "tl", name: "salt" });
    expect(parseIngredientLine("2 cups of flour")).toMatchObject({ quantity: 4.73, unit: "dl", name: "flour" });
  });

  it("handles lines without quantity and splits 'X ja Y'", () => {
    expect(parseIngredientLine("suolaa")).toMatchObject({ quantity: null, unit: null, name: "suolaa" });
    const lines = parseIngredientLines(["suolaa ja pippuria", "", "1 porkkana"]);
    expect(lines.map((l) => l.name)).toEqual(["suolaa", "pippuria", "porkkana"]);
  });

  it("flags optional ingredients and to-taste notes", () => {
    expect(parseIngredientLine("tuoretta tilliä (valinnainen)")).toMatchObject({ optional: true, name: "tilliä", prepNote: "tuoretta" });
    expect(parseIngredientLine("mustapippuria maun mukaan")).toMatchObject({ name: "mustapippuria", prepNote: "maun mukaan" });
  });
});

describe("display", () => {
  it("promotes g/ml at 1000 when formatting", async () => {
    const { formatQty } = await import("@/lib/domain/units");
    expect(formatQty({ quantity: 1000, unit: "g" })).toBe("1 kg");
    expect(formatQty({ quantity: 1500, unit: "ml" })).toBe("1,5 l");
    expect(formatQty({ quantity: 2.5, unit: "dl" })).toBe("2,5 dl");
    expect(formatQty({ quantity: null, unit: null })).toBe("");
  });
});
