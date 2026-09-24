import { mergeKey, sumCompatible } from "./units";
import { scaleIngredients } from "./scaling";
import { toSectionKey, type SectionKey } from "./sections";
import { NEVER_BUY } from "./vocabulary";

export type IngredientLine = {
  nameFi: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: string;
  optional?: boolean;
};

export type MealInput = {
  recipeId: string;
  title: string;
  recipeServings: number;
  servings: number;
  ingredients: IngredientLine[];
};

export type LineSource = { recipeId: string; title: string; quantity: number | null; unit: string | null };

export type AggregatedLine = {
  nameFi: string;
  displayName: string;
  quantity: number | null;
  unit: string | null;
  section: SectionKey;
  sources: LineSource[];
  notes: string[];
};

type Entry = { line: IngredientLine; source: LineSource };

/**
 * Scale each meal's ingredients to its planned servings, then merge the same
 * ingredient across recipes when units are compatible. Incompatible units stay
 * as separate lines.
 */
export function aggregateMeals(meals: MealInput[]): AggregatedLine[] {
  const groups = new Map<string, Entry[]>();
  const order: string[] = [];

  for (const meal of meals) {
    const scaled = scaleIngredients(meal.ingredients, meal.recipeServings, meal.servings);
    for (const line of scaled) {
      if (!line.nameFi || NEVER_BUY.has(line.nameFi)) continue;
      const key = `${line.nameFi}|${line.quantity == null ? "none" : mergeKey(line.unit)}`;
      if (!groups.has(key)) {
        groups.set(key, []);
        order.push(key);
      }
      groups.get(key)!.push({
        line,
        source: { recipeId: meal.recipeId, title: meal.title, quantity: line.quantity, unit: line.unit },
      });
    }
  }

  const result: AggregatedLine[] = [];
  const byName = new Map<string, AggregatedLine[]>();
  const pendingNone: Array<[string, Entry[]]> = [];

  for (const key of order) {
    const entries = groups.get(key)!;
    const first = entries[0].line;
    if (key.endsWith("|none")) {
      pendingNone.push([first.nameFi, entries]);
      continue;
    }
    const summed = sumCompatible(entries.map((e) => ({ quantity: e.line.quantity!, unit: e.line.unit })));
    const agg: AggregatedLine = {
      nameFi: first.nameFi,
      displayName: first.nameFi,
      quantity: summed.quantity,
      unit: summed.unit,
      section: toSectionKey(first.category),
      sources: entries.map((e) => e.source),
      notes: entries.every((e) => e.line.optional) ? ["optional"] : [],
    };
    result.push(agg);
    if (!byName.has(agg.nameFi)) byName.set(agg.nameFi, []);
    byName.get(agg.nameFi)!.push(agg);
  }

  // Unquantified lines ("suolaa") fold into a quantified line of the same
  // ingredient if one exists; otherwise they become an "as needed" line.
  for (const [nameFi, entries] of pendingNone) {
    const target = byName.get(nameFi)?.[0];
    if (target) {
      target.sources.push(...entries.map((e) => e.source));
      if (!target.notes.includes("+ as needed")) target.notes.push("+ as needed");
    } else {
      const first = entries[0].line;
      result.push({
        nameFi,
        displayName: nameFi,
        quantity: null,
        unit: null,
        section: toSectionKey(first.category),
        sources: entries.map((e) => e.source),
        notes: entries.every((e) => e.line.optional) ? ["optional"] : [],
      });
    }
  }

  return result;
}
