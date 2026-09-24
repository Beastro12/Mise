import { describe, expect, it } from "vitest";
import { aggregateMeals, type MealInput } from "@/lib/domain/aggregate";
import { markStaples, subtractPantry } from "@/lib/domain/pantry";
import { scaleIngredients, scaleQuantity } from "@/lib/domain/scaling";
import { buildShoppingList, groupForDisplay } from "@/lib/domain/list-builder";
import { packsNeeded } from "@/lib/domain/packs";

const ing = (nameFi: string, quantity: number | null, unit: string | null, category = "muut", optional = false) => ({
  nameFi,
  name: nameFi,
  quantity,
  unit,
  category,
  optional,
});

const lohikeitto: MealInput = {
  recipeId: "r1",
  title: "Lohikeitto",
  recipeServings: 4,
  servings: 2,
  ingredients: [
    ing("lohi", 400, "g", "liha_kala"),
    ing("peruna", 600, "g", "hedelmat_vihannekset"),
    ing("kerma", 2, "dl", "maito_juusto"),
    ing("suola", null, null, "kuivatuotteet"),
  ],
};

const kastike: MealInput = {
  recipeId: "r2",
  title: "Broilerikastike",
  recipeServings: 2,
  servings: 2,
  ingredients: [
    ing("broilerin suikale", 400, "g", "liha_kala"),
    ing("kerma", 100, "ml", "maito_juusto"),
    ing("tomaattimurska", 1, "tlk", "kuivatuotteet"),
    ing("suola", 1, "tl", "kuivatuotteet"),
  ],
};

describe("servings scaling", () => {
  it("rescales all quantities", () => {
    expect(scaleQuantity(400, 4, 2)).toBe(200);
    expect(scaleQuantity(1, 2, 3)).toBe(1.5);
    expect(scaleQuantity(null, 4, 2)).toBeNull();
    const scaled = scaleIngredients(lohikeitto.ingredients, 4, 6);
    expect(scaled.map((i) => i.quantity)).toEqual([600, 900, 3, null]);
  });

  it("guards against zero servings", () => {
    expect(scaleQuantity(100, 0, 2)).toBe(100);
  });
});

describe("list aggregation across recipes", () => {
  it("merges same ingredient with compatible units (2→1 dl + 100 ml = 2 dl)", () => {
    const lines = aggregateMeals([lohikeitto, kastike]);
    const kerma = lines.filter((l) => l.nameFi === "kerma");
    expect(kerma).toHaveLength(1);
    // lohikeitto scaled 4→2: 1 dl; + 100 ml = 200 ml → 2 dl
    expect(kerma[0]).toMatchObject({ quantity: 2, unit: "dl", section: "maito_juusto" });
    expect(kerma[0].sources.map((s) => s.title)).toEqual(["Lohikeitto", "Broilerikastike"]);
  });

  it("scales before merging", () => {
    const lines = aggregateMeals([lohikeitto]);
    expect(lines.find((l) => l.nameFi === "lohi")).toMatchObject({ quantity: 200, unit: "g" });
  });

  it("keeps incompatible units as separate lines", () => {
    const a: MealInput = { ...kastike, recipeId: "a", ingredients: [ing("tomaattimurska", 1, "tlk")] };
    const b: MealInput = { ...kastike, recipeId: "b", ingredients: [ing("tomaattimurska", 400, "g")] };
    const lines = aggregateMeals([a, b]);
    expect(lines.filter((l) => l.nameFi === "tomaattimurska").map((l) => `${l.quantity} ${l.unit}`)).toEqual(["1 tlk", "400 g"]);
  });

  it("folds unquantified lines into a quantified line of the same ingredient", () => {
    const lines = aggregateMeals([lohikeitto, kastike]);
    const suola = lines.filter((l) => l.nameFi === "suola");
    expect(suola).toHaveLength(1);
    expect(suola[0]).toMatchObject({ quantity: 1, unit: "tl" });
    expect(suola[0].notes).toContain("+ as needed");
    expect(suola[0].sources).toHaveLength(2);
  });

  it("keeps an unquantified-only ingredient as an 'as needed' line", () => {
    const lines = aggregateMeals([lohikeitto]);
    expect(lines.find((l) => l.nameFi === "suola")).toMatchObject({ quantity: null, unit: null });
  });
});

describe("pantry subtraction", () => {
  const lines = aggregateMeals([lohikeitto, kastike]);

  it("pantry item without quantity covers the line", () => {
    const out = subtractPantry(lines, [{ nameFi: "tomaattimurska", quantity: null, unit: null }]);
    expect(out.find((l) => l.nameFi === "tomaattimurska")?.state).toBe("covered");
  });

  it("subtracts compatible quantities", () => {
    const out = subtractPantry(lines, [{ nameFi: "kerma", quantity: 50, unit: "ml" }]);
    expect(out.find((l) => l.nameFi === "kerma")).toMatchObject({ quantity: 1.5, unit: "dl", state: "none" });
  });

  it("covers the line when the pantry has enough", () => {
    const out = subtractPantry(lines, [{ nameFi: "peruna", quantity: 1, unit: "kg" }]);
    expect(out.find((l) => l.nameFi === "peruna")?.state).toBe("covered");
  });

  it("keeps the line and annotates when units are incompatible", () => {
    const out = subtractPantry(lines, [{ nameFi: "lohi", quantity: 1, unit: "pkt" }]);
    const lohi = out.find((l) => l.nameFi === "lohi")!;
    expect(lohi).toMatchObject({ state: "none", quantity: 200, unit: "g" });
    expect(lohi.notes.join()).toContain("pantry has 1 pkt");
  });

  it("marks staples as 'ask' unless the pantry covers them", () => {
    const withPantry = subtractPantry(lines, []);
    const out = markStaples(withPantry, new Set(["suola"]));
    expect(out.find((l) => l.nameFi === "suola")?.state).toBe("ask");
    const covered = markStaples(subtractPantry(lines, [{ nameFi: "suola", quantity: null, unit: null }]), new Set(["suola"]));
    expect(covered.find((l) => l.nameFi === "suola")?.state).toBe("covered");
  });
});

describe("packs", () => {
  it("computes packs from pack size", () => {
    expect(packsNeeded(500, "g", 400, "g")).toBe(2);
    expect(packsNeeded(400, "g", 400, "g")).toBe(1);
    expect(packsNeeded(3, "dl", 2, "dl")).toBe(2);
    expect(packsNeeded(1.2, "kg", 500, "g")).toBe(3);
    expect(packsNeeded(2, "dl", 200, "g")).toBeNull();
    expect(packsNeeded(null, "g", 400, "g")).toBeNull();
  });
});

describe("buildShoppingList + display grouping", () => {
  it("builds, splits and orders items", () => {
    const items = buildShoppingList({
      meals: [lohikeitto, kastike],
      pantry: [],
      staples: new Set(["suola"]),
      offers: [
        {
          id: "o1",
          productName: "Kermaviili 10 % 200 g",
          nameFi: "kermaviili",
          price: 0.49,
          unitPrice: null,
          unitPriceUnit: null,
          unitText: "200 g",
          validFrom: "2026-09-21",
          validTo: "2026-09-27",
        },
        {
          id: "o2",
          productName: "Lohifilee 400 g",
          nameFi: "lohi",
          price: 5.99,
          unitPrice: 14.98,
          unitPriceUnit: "kg",
          unitText: "400 g",
          validFrom: "2026-09-21",
          validTo: "2026-09-27",
        },
      ],
      rules: new Map([["tomaattimurska", "lidl" as const]]),
      mappings: new Map([
        [
          "kerma",
          { smarket: { id: "p1", price: 1.29, unitPrice: 6.45, unitPriceUnit: "l", packSize: 2, packUnit: "dl" } },
        ],
      ]),
      today: "2026-09-24",
    });

    const byName = Object.fromEntries(items.map((i) => [i.nameFi, i]));
    expect(byName["lohi"]).toMatchObject({ storeId: "lidl", offerId: "o2", price: 5.99 });
    expect(byName["lohi"].storeReason).toBe("Lidl offer until Sun, 5,99 €");
    expect(byName["tomaattimurska"]).toMatchObject({ storeId: "lidl" });
    expect(byName["kerma"]).toMatchObject({ storeId: "smarket", productId: "p1", packs: 1, price: 1.29 });
    expect(byName["suola"].state).toBe("ask");

    const groups = groupForDisplay(items, { smarket: ["maito_juusto", "hedelmat_vihannekset"] });
    expect(groups.map((g) => g.storeId)).toEqual(["smarket", "lidl"]);
    expect(groups[0].sections.map((s) => s.key)).toEqual(["maito_juusto", "hedelmat_vihannekset", "liha_kala", "kuivatuotteet"]);
    expect(groups[1].sections.map((s) => s.key)).toEqual(["liha_kala", "kuivatuotteet"]);
  });
});
