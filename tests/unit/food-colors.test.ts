import { describe, expect, it } from "vitest";
import { accentFor, foodColor, plateFor } from "@/lib/domain/food-colors";

describe("food colours", () => {
  it("maps ingredients to colours with section fallback", () => {
    expect(foodColor("lohi")).toBe("#f08a5d");
    expect(foodColor("tuntematon", "pakasteet")).toBe("#9cc0cf");
  });
  it("uses a coloured sauce as the plate base and tints cream by the main ingredient", () => {
    const curry = plateFor([{ nameFi: "kikherne", category: "kuivatuotteet" }, { nameFi: "currytahna", category: "kuivatuotteet" }]);
    expect(curry.base).toBe(foodColor("currytahna"));
    const soup = plateFor([{ nameFi: "lohi", category: "liha_kala" }, { nameFi: "kerma", category: "maito_juusto" }, { nameFi: "tilli", category: "hedelmat_vihannekset" }]);
    expect(soup.base).not.toBe(foodColor("kerma"));
    expect(soup.herbs).toEqual([foodColor("tilli")]);
    expect(soup.pieces).toEqual([foodColor("lohi")]);
  });
  it("skips seasonings and picks meat/fish as the accent", () => {
    expect(plateFor([{ nameFi: "suola", category: "kuivatuotteet" }]).pieces).toEqual([]);
    expect(accentFor([{ nameFi: "sipuli", category: "hedelmat_vihannekset" }, { nameFi: "jauheliha", category: "liha_kala" }])).toBe(foodColor("jauheliha"));
  });
});
