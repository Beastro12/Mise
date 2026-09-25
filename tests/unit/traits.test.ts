import { describe, expect, it } from "vitest";
import { recipeTraits } from "@/lib/domain/traits";

const r = (over: Partial<Parameters<typeof recipeTraits>[0]>) => ({
  id: "x", title: "X", tags: [], prepMinutes: null, cookMinutes: null, steps: [], ingredients: [], ...over,
});

describe("recipe traits", () => {
  it("detects protein from ingredients", () => {
    expect(recipeTraits(r({ ingredients: [{ nameFi: "lohi", category: "liha_kala" }] })).protein).toBe("fish");
    expect(recipeTraits(r({ ingredients: [{ nameFi: "broilerin suikale", category: "liha_kala" }] })).protein).toBe("chicken");
    expect(recipeTraits(r({ ingredients: [{ nameFi: "jauheliha", category: "liha_kala" }] })).protein).toBe("meat");
    expect(recipeTraits(r({ ingredients: [{ nameFi: "makkara", category: "liha_kala" }] })).protein).toBe("meat");
  });
  it("splits vegetarian and vegan by dairy/eggs", () => {
    expect(recipeTraits(r({ ingredients: [{ nameFi: "kikherne", category: "kuivatuotteet" }, { nameFi: "kookosmaito", category: "kuivatuotteet" }] })).protein).toBe("vegan");
    expect(recipeTraits(r({ ingredients: [{ nameFi: "pinaatti", category: "hedelmat_vihannekset" }, { nameFi: "kerma", category: "maito_juusto" }] })).protein).toBe("vegetarian");
    expect(recipeTraits(r({ tags: ["vegetarian"], ingredients: [{ nameFi: "kananmuna", category: "maito_juusto" }] })).protein).toBe("vegetarian");
  });
  it("derives time and style", () => {
    expect(recipeTraits(r({ prepMinutes: 10, cookMinutes: 15 })).effort).toContain("quick");
    expect(recipeTraits(r({ prepMinutes: 30, cookMinutes: 90 })).effort).toContain("slow");
    expect(recipeTraits(r({ title: "Lohikeitto" })).effort).toContain("soup");
    expect(recipeTraits(r({ steps: ["Paista 200 asteessa 45 min."] })).effort).toContain("oven");
  });
});

import { inSeason, seasonalRecipes } from "@/lib/domain/season";
describe("in season", () => {
  it("lists September produce and finds recipes using it", () => {
    expect(inSeason(8)).toContain("puolukka");
    const r = seasonalRecipes([{ id: "a", ingredients: [{ nameFi: "lanttu" }, { nameFi: "porkkana" }] }, { id: "b", ingredients: [{ nameFi: "lohi" }] }], inSeason(8));
    expect(r.map((x) => x.recipe.id)).toEqual(["a"]);
    expect(r[0].uses).toEqual(["lanttu", "porkkana"]);
  });
});
