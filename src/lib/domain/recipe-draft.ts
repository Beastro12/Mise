import { z } from "zod";
import { parseIngredientLines } from "./ingredient-parser";
import { normalizeName, type SynonymIndex } from "./normalize";
import { CANONICAL_UNITS } from "./units";
import { SECTION_KEYS, toSectionKey } from "./sections";

export const ingredientDraftSchema = z.object({
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  originalText: z.string(),
  name: z.string().min(1),
  nameFi: z.string().min(1),
  prepNote: z.string().nullable(),
  category: z.enum(SECTION_KEYS as [string, ...string[]]),
  optional: z.boolean(),
});

export type IngredientDraft = z.infer<typeof ingredientDraftSchema>;

export const recipeDraftSchema = z.object({
  title: z.string().min(1),
  sourceType: z.enum(["photo", "url", "file", "manual", "seed"]),
  sourceUrl: z.string().nullable(),
  sourceNote: z.string().nullable(),
  servings: z.number().int().positive(),
  prepMinutes: z.number().int().nonnegative().nullable(),
  cookMinutes: z.number().int().nonnegative().nullable(),
  tags: z.array(z.string()),
  ingredients: z.array(ingredientDraftSchema),
  steps: z.array(z.string()),
  notes: z.string().nullable(),
  originalIds: z.array(z.string()),
  warnings: z.array(z.string()).optional(),
});

export type RecipeDraft = z.infer<typeof recipeDraftSchema>;

export function emptyDraft(sourceType: RecipeDraft["sourceType"] = "manual"): RecipeDraft {
  return {
    title: "",
    sourceType,
    sourceUrl: null,
    sourceNote: null,
    servings: 2,
    prepMinutes: null,
    cookMinutes: null,
    tags: [],
    ingredients: [],
    steps: [],
    notes: null,
    originalIds: [],
    warnings: [],
  };
}

/** Parse free-text ingredient lines into drafts using the local parser + synonym table. */
export function draftsFromLines(lines: string[], index: SynonymIndex): IngredientDraft[] {
  return parseIngredientLines(lines).map((p) => {
    const norm = normalizeName(p.name, index);
    return {
      quantity: p.quantity,
      unit: p.unit,
      originalText: p.originalText,
      name: p.name,
      nameFi: norm.nameFi || p.name.toLowerCase(),
      prepNote: p.prepNote,
      category: toSectionKey(norm.category),
      optional: p.optional,
    };
  });
}

/** Keep units canonical: anything unknown becomes null (quantity kept). */
export function sanitizeUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const u = unit.trim().toLowerCase();
  return CANONICAL_UNITS.includes(u) ? u : null;
}

/** Normalize tags: lowercase, trimmed, unique. */
export function cleanTags(tags: string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().toLowerCase()).filter(Boolean))];
}
