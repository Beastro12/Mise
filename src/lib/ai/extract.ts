import "server-only";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type Anthropic from "@anthropic-ai/sdk";
import { config } from "../env";
import { getMessages } from "./client";
import { CANONICAL_UNITS } from "../domain/units";
import { SECTIONS, SECTION_KEYS } from "../domain/sections";

// ---------------------------------------------------------------------------
// Schemas (structured outputs; no numeric/length constraints allowed)
// ---------------------------------------------------------------------------

// Enums are sent as plain strings with the allowed values in the description and
// sanitized server-side: the SDK validates enums client-side, and one odd value
// would otherwise fail the whole extraction.
const unitField = z.string().nullable().describe(`One of: ${CANONICAL_UNITS.join(", ")}; null if no quantity`);
const sectionField = z.string().describe(`One of: ${SECTION_KEYS.join(", ")}`);

const extractedIngredient = z.object({
  original_text: z.string().describe("The ingredient line exactly as written in the source"),
  quantity: z.number().nullable().describe("Metric quantity after conversion, null if none"),
  unit: unitField,
  name: z.string().describe("Ingredient name as written, without quantity/unit/prep"),
  name_fi: z.string().describe("Generic Finnish grocery name, nominative singular, lowercase"),
  prep_note: z.string().nullable(),
  category: sectionField,
  optional: z.boolean(),
});

const extractedRecipe = z.object({
  title: z.string(),
  servings: z.number().int().nullable(),
  prep_minutes: z.number().int().nullable(),
  cook_minutes: z.number().int().nullable(),
  tags: z.array(z.string()),
  ingredients: z.array(extractedIngredient),
  steps: z.array(z.string()),
  notes: z.string().nullable(),
  source_images: z.array(z.number().int()).describe("1-based indexes of the images this recipe came from; empty for text"),
});

export const recipeExtractionSchema = z.object({
  recipes: z.array(extractedRecipe),
  warnings: z.array(z.string()),
});

export type RecipeExtraction = z.infer<typeof recipeExtractionSchema>;
export type ExtractedRecipe = z.infer<typeof extractedRecipe>;

export const offersExtractionSchema = z.object({
  leaflet_valid_from: z.string().nullable().describe("YYYY-MM-DD"),
  leaflet_valid_to: z.string().nullable().describe("YYYY-MM-DD"),
  offers: z.array(
    z.object({
      product_name: z.string(),
      name_fi: z.string().describe("Generic Finnish grocery name of the product, nominative singular, lowercase"),
      price: z.number().describe("Offer price in euros"),
      regular_price: z.number().nullable(),
      unit_text: z.string().nullable().describe("Pack size as printed, e.g. '400 g'"),
      unit_price: z.number().nullable(),
      unit_price_unit: z.string().nullable().describe("kg, l or kpl"),
      valid_from: z.string().nullable().describe("YYYY-MM-DD if printed for this product"),
      valid_to: z.string().nullable().describe("YYYY-MM-DD if printed for this product"),
    }),
  ),
  warnings: z.array(z.string()),
});

export type OffersExtraction = z.infer<typeof offersExtractionSchema>;

export const normalizationSchema = z.object({
  items: z.array(z.object({ name: z.string(), name_fi: z.string(), category: sectionField })),
});

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const sectionList = SECTIONS.map((s) => `- ${s.key}: ${s.fi} (${s.en})`).join("\n");

function recipeSystemPrompt(knownNames: string[]): string {
  return `You extract recipes for a Finnish household's meal planner. The shopping happens in Finnish supermarkets, so every ingredient also gets a normalized Finnish grocery name.

Rules:
- Extract every recipe present. One recipe may continue across several images (merge them into one recipe); one image may contain several recipes (split them).
- Copy text faithfully. Do not invent ingredients, steps, times or servings that are not in the source; use null when unknown.
- Keep titles, steps and notes in the source language.
- Units must be metric. Allowed units: ${CANONICAL_UNITS.join(", ")}. Convert: 1 cup = 2.37 dl, 1 oz = 28.35 g, 1 lb = 453.6 g, 1 fl oz = 29.57 ml, tbsp → rkl, tsp → tl. Countable items with no unit use "kpl". original_text keeps the line exactly as written.
- name_fi: the generic grocery product in Finnish, nominative singular, lowercase, without brand, size, or preparation ("sour cream" → "kermaviili", "400 g nahatonta lohifileetä" → "lohi", "2 kynttä valkosipulia" → "valkosipuli"). Reuse one of these existing names whenever it fits: ${knownNames.join(", ")}.
- prep_note: preparation or size words (e.g. "hienonnettuna", "finely chopped").
- category: the store section where the product is bought:
${sectionList}
- tags: short lowercase tags such as arki, quick, vegetarian, kala, kana, nauta, possu, keitto, uuniruoka, jälkiruoka, viikonloppu. Add "vegetarian" only if there is no meat or fish.
- Add a warning for anything unreadable or ambiguous.`;
}

// ---------------------------------------------------------------------------
// Calls
// ---------------------------------------------------------------------------

export type ImageInput = { data: string; mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" };

export type RecipeSource =
  | { kind: "images"; images: ImageInput[] }
  | { kind: "pdf"; data: string; filename?: string }
  | { kind: "text"; text: string; hint?: string };

function sourceContent(src: RecipeSource): Anthropic.ContentBlockParam[] {
  if (src.kind === "images") {
    const blocks: Anthropic.ContentBlockParam[] = [];
    src.images.forEach((img, i) => {
      blocks.push({ type: "text", text: `Image ${i + 1}:` });
      blocks.push({ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } });
    });
    blocks.push({ type: "text", text: "Extract all recipes from these cookbook pages." });
    return blocks;
  }
  if (src.kind === "pdf") {
    return [
      { type: "document", source: { type: "base64", media_type: "application/pdf", data: src.data } },
      { type: "text", text: "Extract all recipes from this document." },
    ];
  }
  return [
    {
      type: "text",
      text: `${src.hint ? `${src.hint}\n\n` : ""}<source>\n${src.text}\n</source>\n\nExtract all recipes from the source text above.`,
    },
  ];
}

function checkStop(stop: string | null, what: string) {
  if (stop === "refusal") throw new Error(`Claude declined to process this ${what}.`);
  if (stop === "max_tokens") throw new Error(`The ${what} was too long for one extraction; try fewer pages at a time.`);
}

export async function extractRecipes(src: RecipeSource, knownNames: string[]): Promise<RecipeExtraction> {
  const res = await getMessages().parse({
    model: config.anthropicModel,
    max_tokens: 16000,
    system: recipeSystemPrompt(knownNames),
    messages: [{ role: "user", content: sourceContent(src) }],
    output_config: { effort: "medium", format: zodOutputFormat(recipeExtractionSchema) },
  });
  checkStop(res.stop_reason, "recipe source");
  if (!res.parsed_output) throw new Error("Claude returned no structured result.");
  return res.parsed_output;
}

export type LeafletSource = { kind: "images"; images: ImageInput[] } | { kind: "text"; text: string };

export async function extractOffers(src: LeafletSource, today: string, knownNames: string[]): Promise<OffersExtraction> {
  const content: Anthropic.ContentBlockParam[] =
    src.kind === "images"
      ? [
          ...src.images.map(
            (img): Anthropic.ContentBlockParam => ({
              type: "image",
              source: { type: "base64", media_type: img.mediaType, data: img.data },
            }),
          ),
          { type: "text", text: "Extract every food offer from these Lidl leaflet pages." },
        ]
      : [{ type: "text", text: `<leaflet>\n${src.text}\n</leaflet>\n\nExtract every food offer from this Lidl leaflet text.` }];

  const res = await getMessages().parse({
    model: config.anthropicModel,
    max_tokens: 16000,
    system: `You read Lidl Finland weekly leaflets for a household shopping list. Today is ${today} (Europe/Helsinki).
- Extract each food/grocery offer: product name as printed, the offer price in euros (Finnish prints "1,49" = 1.49), regular price if shown, pack size text, unit price if printed (€/kg, €/l or €/kpl).
- name_fi: the generic Finnish grocery name, nominative singular, lowercase (e.g. "Kermaviili 10 % 200 g" → "kermaviili", "Tuore lohifilee" → "lohi"). Reuse one of these existing names whenever it fits: ${knownNames.join(", ")}.
- Dates: output YYYY-MM-DD. Leaflet validity like "ma 22.9. – su 28.9." belongs to the current or next week relative to today. Use null if not printed.
- Skip non-food items (tools, clothes) and any price you cannot read. Add a warning for unreadable parts.`,
    messages: [{ role: "user", content }],
    output_config: { effort: "medium", format: zodOutputFormat(offersExtractionSchema) },
  });
  checkStop(res.stop_reason, "leaflet");
  if (!res.parsed_output) throw new Error("Claude returned no structured result.");
  return res.parsed_output;
}

/** Map ingredient names (any language/inflection) to normalized Finnish names. */
export async function normalizeNames(
  names: string[],
  knownNames: string[],
): Promise<Array<{ name: string; name_fi: string; category: string }>> {
  if (!names.length) return [];
  const res = await getMessages().parse({
    model: config.anthropicModel,
    max_tokens: 4000,
    system: `Map recipe ingredient names to the generic Finnish grocery product a shopper would look for: nominative singular, lowercase, no brand/size/preparation. Reuse one of these existing names whenever it fits: ${knownNames.join(", ")}.
Sections:
${sectionList}`,
    messages: [{ role: "user", content: `Ingredient names, one per line:\n${names.join("\n")}` }],
    output_config: { effort: "low", format: zodOutputFormat(normalizationSchema) },
  });
  checkStop(res.stop_reason, "ingredient list");
  return res.parsed_output?.items ?? [];
}
