import { afterEach, describe, expect, it } from "vitest";
import { __setMessagesForTests, type MessagesParser } from "@/lib/ai/client";
import { extractOffers, extractRecipes, type ExtractedRecipe } from "@/lib/ai/extract";
import { draftFromExtraction } from "@/lib/import/claude-map";
import { buildSynonymIndex } from "@/lib/domain/normalize";
import { seedSynonymPairs } from "@/lib/domain/vocabulary";

type Captured = { params: Record<string, unknown> | null };

function stub(parsed: unknown, stop = "end_turn"): { fake: MessagesParser; cap: Captured } {
  const cap: Captured = { params: null };
  const fake = {
    parse: async (params: Record<string, unknown>) => {
      cap.params = params;
      return { stop_reason: stop, parsed_output: parsed, content: [] };
    },
  } as unknown as MessagesParser;
  return { fake, cap };
}

afterEach(() => __setMessagesForTests(null));

const recipe: ExtractedRecipe = {
  title: "Sour cream chicken",
  servings: 4,
  prep_minutes: 10,
  cook_minutes: 30,
  tags: ["Arki", "kana"],
  ingredients: [
    { original_text: "1 cup sour cream", quantity: 2.37, unit: "dl", name: "sour cream", name_fi: "smetana", prep_note: null, category: "maito_juusto", optional: false },
    { original_text: "2 chicken breasts", quantity: 2, unit: "kpl", name: "chicken breasts", name_fi: "broilerin rintafilee", prep_note: null, category: "liha_kala", optional: false },
    { original_text: "1 tsp smoked sea salt", quantity: 1, unit: "tl", name: "smoked sea salt", name_fi: "savusuola", prep_note: null, category: "kuivatuotteet", optional: false },
    { original_text: "a pinch of chili flakes", quantity: 1, unit: "handful", name: "chili flakes", name_fi: "chilihiutale", prep_note: null, category: "kuivatuotteet", optional: true },
  ],
  steps: ["Mix.", " ", "Bake."],
  notes: null,
  source_images: [2],
};

describe("Claude recipe extraction (stubbed client)", () => {
  it("sends images with structured output format and the configured model", async () => {
    const { fake, cap } = stub({ recipes: [recipe], warnings: [] });
    __setMessagesForTests(fake);
    const res = await extractRecipes(
      { kind: "images", images: [{ data: "AAA", mediaType: "image/jpeg" }, { data: "BBB", mediaType: "image/png" }] },
      ["kerma", "lohi"],
    );
    expect(res.recipes).toHaveLength(1);
    const p = cap.params!;
    expect(p.model).toBe(process.env.ANTHROPIC_MODEL || "claude-sonnet-5");
    expect((p.output_config as { format: { type: string } }).format.type).toBe("json_schema");
    const content = (p.messages as Array<{ content: Array<{ type: string }> }>)[0].content;
    expect(content.filter((c) => c.type === "image")).toHaveLength(2);
    expect(String(p.system)).toContain("kerma, lohi");
  });

  it("surfaces refusals and truncation as errors", async () => {
    __setMessagesForTests(stub(null, "refusal").fake);
    await expect(extractRecipes({ kind: "text", text: "x" }, [])).rejects.toThrow(/declined/);
    __setMessagesForTests(stub(null, "max_tokens").fake);
    await expect(extractRecipes({ kind: "text", text: "x" }, [])).rejects.toThrow(/too long/);
  });

  it("sends PDFs as document blocks", async () => {
    const { fake, cap } = stub({ recipes: [], warnings: [] });
    __setMessagesForTests(fake);
    await extractRecipes({ kind: "pdf", data: "JVBER" }, []);
    const content = (cap.params!.messages as Array<{ content: Array<{ type: string }> }>)[0].content;
    expect(content[0].type).toBe("document");
  });

  it("extracts leaflet offers with today's date in the prompt", async () => {
    const { fake, cap } = stub({ leaflet_valid_from: "2026-09-21", leaflet_valid_to: "2026-09-27", offers: [], warnings: [] });
    __setMessagesForTests(fake);
    await extractOffers({ kind: "text", text: "Kermaviili 0,49" }, "2026-09-24", []);
    expect(String(cap.params!.system)).toContain("Today is 2026-09-24");
  });
});

describe("mapping Claude output to a review draft", () => {
  const index = buildSynonymIndex(seedSynonymPairs());

  it("lets the local synonym table win and learns new names", () => {
    const { draft, learned } = draftFromExtraction(recipe, { index, sourceType: "photo", originalIds: ["o1"] });
    const byName = Object.fromEntries(draft.ingredients.map((i) => [i.name, i]));
    // "sour cream" is in the local table as kermaviili; Claude said smetana → local wins
    expect(byName["sour cream"].nameFi).toBe("kermaviili");
    // "chicken breasts" is local too
    expect(byName["chicken breasts"].nameFi).toBe("broilerinfilee");
    // unknown → Claude's name, remembered
    expect(byName["smoked sea salt"].nameFi).toBe("savusuola");
    expect(learned.map((l) => l.term)).toEqual(["smoked sea salt", "chili flakes"]);
  });

  it("sanitizes units, tags and steps", () => {
    const { draft } = draftFromExtraction(recipe, { index, sourceType: "photo", originalIds: [] });
    expect(draft.ingredients[3]).toMatchObject({ unit: "kpl", optional: true });
    expect(draft.tags).toEqual(["arki", "kana"]);
    expect(draft.steps).toEqual(["Mix.", "Bake."]);
    expect(draft.servings).toBe(4);
  });

  it("defaults missing servings to 2 with a warning", () => {
    const { draft } = draftFromExtraction({ ...recipe, servings: null }, { index, sourceType: "photo", originalIds: [] });
    expect(draft.servings).toBe(2);
    expect(draft.warnings?.join()).toContain("defaulted to 2");
  });
});
