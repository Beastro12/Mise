import type { ExtractedRecipe } from "../ai/extract";
import { normalizeName, type SynonymIndex } from "../domain/normalize";
import { cleanTags, sanitizeUnit, type RecipeDraft } from "../domain/recipe-draft";
import { toSectionKey } from "../domain/sections";
import { round } from "../domain/units";

export type LearnedSynonym = { term: string; nameFi: string; category: string };

/**
 * Convert Claude's extraction into a reviewable draft. Your own synonym table
 * wins over Claude's normalization; Claude's new mappings are returned so they
 * can be remembered.
 */
export function draftFromExtraction(
  r: ExtractedRecipe,
  opts: {
    index: SynonymIndex;
    sourceType: RecipeDraft["sourceType"];
    sourceUrl?: string | null;
    sourceNote?: string | null;
    originalIds: string[];
    warnings?: string[];
  },
): { draft: RecipeDraft; learned: LearnedSynonym[] } {
  const learned: LearnedSynonym[] = [];
  const ingredients = r.ingredients.map((i) => {
    const local = normalizeName(i.name, opts.index);
    const claudeName = i.name_fi.trim().toLowerCase();
    // Claude's name may itself be a known alias ("kermaa" → "kerma").
    const viaIndex = claudeName ? opts.index.get(claudeName) : undefined;
    const nameFi = local.matched ? local.nameFi : (viaIndex?.nameFi ?? (claudeName || local.nameFi));
    const category = toSectionKey(local.matched ? (local.category ?? i.category) : (viaIndex?.category ?? i.category));
    if (!local.matched && claudeName && i.name.trim()) {
      learned.push({ term: i.name.trim().toLowerCase(), nameFi, category });
    }
    return {
      quantity: i.quantity == null ? null : round(i.quantity, 3),
      unit: i.quantity == null ? null : (sanitizeUnit(i.unit) ?? "kpl"),
      originalText: i.original_text || i.name,
      name: i.name || i.original_text,
      nameFi,
      prepNote: i.prep_note,
      category,
      optional: i.optional,
    };
  });

  return {
    draft: {
      title: r.title.trim() || "Untitled recipe",
      sourceType: opts.sourceType,
      sourceUrl: opts.sourceUrl ?? null,
      sourceNote: opts.sourceNote ?? null,
      servings: r.servings && r.servings > 0 ? r.servings : 2,
      prepMinutes: r.prep_minutes,
      cookMinutes: r.cook_minutes,
      tags: cleanTags(r.tags),
      ingredients,
      steps: r.steps.map((s) => s.trim()).filter(Boolean),
      notes: r.notes,
      originalIds: opts.originalIds,
      warnings: [...(opts.warnings ?? []), ...(r.servings ? [] : ["Servings were not in the source; defaulted to 2."])],
    },
    learned,
  };
}
