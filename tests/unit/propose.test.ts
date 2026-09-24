import { describe, expect, it } from "vitest";
import { proposeWeek, proteinOf, swapSlot, type ProposeContext, type ProposeRecipe } from "@/lib/domain/propose";

const r = (id: string, tags: string[], totalMinutes: number | null, ingredients: Array<[string, string]>): ProposeRecipe => ({
  id,
  title: id,
  tags,
  totalMinutes,
  ingredients: ingredients.map(([nameFi, section]) => ({ nameFi, section })),
});

const recipes = [
  r("lohikeitto", ["kala", "arki"], 40, [["lohi", "liha_kala"], ["peruna", "hedelmat_vihannekset"], ["kerma", "maito_juusto"]]),
  r("uunilohi", ["kala"], 30, [["lohi", "liha_kala"], ["sitruuna", "hedelmat_vihannekset"]]),
  r("jauhelihakastike", ["arki"], 35, [["jauheliha", "liha_kala"], ["peruna", "hedelmat_vihannekset"]]),
  r("broilerikastike", ["arki", "quick"], 25, [["broilerin suikale", "liha_kala"], ["kerma", "maito_juusto"]]),
  r("kasviscurry", ["vegetarian", "quick"], 30, [["kikherne", "kuivatuotteet"], ["kookosmaito", "kuivatuotteet"]]),
  r("lasagne", ["viikonloppu"], 120, [["jauheliha", "liha_kala"], ["pasta", "kuivatuotteet"]]),
];

const ctx = (over: Partial<ProposeContext> = {}): ProposeContext => ({
  recipes,
  recentRecipeIds: new Set(),
  pantry: new Set(),
  staples: new Set(["suola"]),
  offerNames: new Set(),
  params: { meals: 3, weekdayMaxMinutes: 45, includeTags: [], excludeTags: [], seed: 1 },
  weekStart: "2026-09-28",
  ...over,
});

describe("propose mode", () => {
  it("derives protein from tags or ingredients", () => {
    expect(proteinOf(recipes[0])).toBe("fish");
    expect(proteinOf(recipes[2])).toBe("beef");
    expect(proteinOf(recipes[3])).toBe("chicken");
    expect(proteinOf(recipes[4])).toBe("vegetarian");
  });

  it("proposes distinct recipes with reasons and days", () => {
    const week = proposeWeek(ctx());
    expect(week).toHaveLength(3);
    expect(new Set(week.map((s) => s.recipeId)).size).toBe(3);
    expect(week.map((s) => s.day)).toEqual(["2026-09-28", "2026-09-29", "2026-09-30"]);
    for (const s of week) expect(s.reason.length).toBeGreaterThan(0);
  });

  it("respects the weekday time limit", () => {
    const week = proposeWeek(ctx({ params: { meals: 5, weekdayMaxMinutes: 45, includeTags: [], excludeTags: [], seed: 3 } }));
    expect(week.map((s) => s.recipeId)).not.toContain("lasagne");
  });

  it("does not repeat recipes from the last 2 weeks", () => {
    const week = proposeWeek(ctx({ recentRecipeIds: new Set(["lohikeitto", "uunilohi"]) }));
    expect(week.map((s) => s.recipeId)).not.toContain("lohikeitto");
    expect(week.map((s) => s.recipeId)).not.toContain("uunilohi");
  });

  it("applies include/exclude tags", () => {
    const inc = proposeWeek(ctx({ params: { meals: 2, weekdayMaxMinutes: null, includeTags: ["quick"], excludeTags: [], seed: 1 } }));
    expect(inc.map((s) => s.recipeId).sort()).toEqual(["broilerikastike", "kasviscurry"]);
    const exc = proposeWeek(ctx({ params: { meals: 3, weekdayMaxMinutes: null, includeTags: [], excludeTags: ["kala"], seed: 1 } }));
    expect(exc.map((s) => s.recipeId)).not.toContain("lohikeitto");
  });

  it("prefers variety across proteins", () => {
    const week = proposeWeek(ctx({ params: { meals: 3, weekdayMaxMinutes: 45, includeTags: [], excludeTags: [], seed: 7 } }));
    const proteins = week.map((s) => proteinOf(recipes.find((x) => x.id === s.recipeId)!));
    expect(new Set(proteins).size).toBe(3);
  });

  it("prefers recipes using Lidl offers and pantry items, and says so", () => {
    const week = proposeWeek(ctx({ offerNames: new Set(["jauheliha"]), pantry: new Set(["peruna"]) }));
    expect(week[0].recipeId).toBe("jauhelihakastike");
    expect(week[0].reason).toContain("Lidl offer: jauheliha");
    expect(week[0].reason).toContain("uses pantry peruna");
  });

  it("keeps locked meals and fills the rest", () => {
    const week = proposeWeek(ctx(), [{ slot: 1, recipeId: "kasviscurry" }]);
    expect(week[1]).toMatchObject({ recipeId: "kasviscurry", locked: true });
    expect(week.filter((s) => s.recipeId === "kasviscurry")).toHaveLength(1);
  });

  it("swaps a single meal for a different one", () => {
    const c = ctx();
    const week = proposeWeek(c);
    const swapped = swapSlot(c, week, 0, 99);
    expect(swapped.recipeId).not.toBe(week[0].recipeId);
    expect(week.slice(1).map((s) => s.recipeId)).not.toContain(swapped.recipeId);
  });

  it("leaves a slot empty rather than breaking the 2-week rule", () => {
    const week = proposeWeek(ctx({ recipes: recipes.slice(0, 1), params: { meals: 2, weekdayMaxMinutes: null, includeTags: [], excludeTags: [], seed: 1 } }));
    expect(week[1].recipeId).toBeNull();
  });
});
