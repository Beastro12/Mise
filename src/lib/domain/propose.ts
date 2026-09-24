import { addDays } from "./offers";

export type ProposeRecipe = {
  id: string;
  title: string;
  tags: string[];
  totalMinutes: number | null;
  /** Normalized Finnish ingredient names with their shopping section. */
  ingredients: Array<{ nameFi: string; section: string }>;
};

export type ProposeParams = {
  meals: number;
  weekdayMaxMinutes: number | null;
  includeTags: string[];
  excludeTags: string[];
  seed: number;
};

export type ProposeContext = {
  recipes: ProposeRecipe[];
  /** Recipes cooked or planned within the last 14 days (excluding this plan). */
  recentRecipeIds: Set<string>;
  pantry: Set<string>;
  staples: Set<string>;
  /** nameFi values with an active Lidl offer. */
  offerNames: Set<string>;
  params: ProposeParams;
  weekStart: string; // Monday, YYYY-MM-DD
};

export type Slot = { slot: number; day: string; recipeId: string | null; reason: string; locked: boolean };

const PROTEIN_RULES: Array<[string, RegExp]> = [
  ["fish", /(^|\b)(kala|fish|lohi|salmon|turska|seiti|katkarapu|tonnikala|äyriäi|seafood)/i],
  ["chicken", /(^|\b)(kana|broiler|chicken|kalkkuna)/i],
  ["beef", /(^|\b)(nauta|jauheliha|beef|härkä)/i],
  ["pork", /(^|\b)(possu|porsa|sika|pork|pekoni|kinkku|makkara|kassler)/i],
];
const VEG_TAGS = /^(vegetarian|vegan|kasvis|kasvisruoka|vegaani)$/i;

export function proteinOf(r: ProposeRecipe): string {
  if (r.tags.some((t) => VEG_TAGS.test(t))) return "vegetarian";
  for (const [p, re] of PROTEIN_RULES) if (r.tags.some((t) => re.test(t))) return p;
  const protein = r.ingredients.filter((i) => i.section === "liha_kala").map((i) => i.nameFi);
  for (const [p, re] of PROTEIN_RULES) if (protein.some((n) => re.test(n))) return p;
  return protein.length ? "other meat" : "vegetarian";
}

/** Deterministic PRNG so "give me another" is reproducible per seed. */
export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function slotDay(weekStart: string, slot: number): string {
  return addDays(weekStart, slot % 7);
}

export function isWeekdaySlot(slot: number): boolean {
  return slot % 7 < 5;
}

function passesFilters(r: ProposeRecipe, ctx: ProposeContext, slot: number): boolean {
  const tags = r.tags.map((t) => t.toLowerCase());
  const inc = ctx.params.includeTags.map((t) => t.toLowerCase());
  const exc = ctx.params.excludeTags.map((t) => t.toLowerCase());
  if (inc.length && !inc.some((t) => tags.includes(t))) return false;
  if (exc.some((t) => tags.includes(t))) return false;
  if (ctx.recentRecipeIds.has(r.id)) return false;
  if (isWeekdaySlot(slot) && ctx.params.weekdayMaxMinutes != null && r.totalMinutes != null) {
    if (r.totalMinutes > ctx.params.weekdayMaxMinutes) return false;
  }
  return true;
}

type Scored = { recipe: ProposeRecipe; score: number; reason: string };

function score(r: ProposeRecipe, ctx: ProposeContext, chosenProteins: string[], slot: number, seed: number): Scored {
  const rand = mulberry32(seed ^ hash(r.id) ^ (slot * 7919));
  const main = r.ingredients.filter((i) => !ctx.staples.has(i.nameFi));
  const onOffer = main.filter((i) => ctx.offerNames.has(i.nameFi));
  const fromPantry = main.filter((i) => ctx.pantry.has(i.nameFi));
  const protein = proteinOf(r);
  const repeatsProtein = chosenProteins.includes(protein);

  let s = 0;
  for (const i of onOffer) s += i.section === "liha_kala" ? 4 : 2;
  s += Math.min(3, fromPantry.length);
  if (repeatsProtein) s -= 4;
  s += rand() * 1.5;

  const parts: string[] = [];
  if (onOffer.length) parts.push(`Lidl offer: ${onOffer.map((i) => i.nameFi).slice(0, 2).join(", ")}`);
  if (fromPantry.length) parts.push(`uses pantry ${fromPantry.map((i) => i.nameFi).slice(0, 2).join(", ")}`);
  if (!repeatsProtein) parts.push(`variety (${protein})`);
  if (r.totalMinutes != null) parts.push(`${r.totalMinutes} min`);
  else if (isWeekdaySlot(slot) && ctx.params.weekdayMaxMinutes != null) parts.push("time unknown");
  return { recipe: r, score: s, reason: parts.join(" · ") || "Fits your filters" };
}

/**
 * Fill every non-locked slot greedily with the best-scoring recipe.
 * Locked slots are kept as they are.
 */
export function proposeWeek(ctx: ProposeContext, locked: Array<{ slot: number; recipeId: string }> = []): Slot[] {
  const n = Math.max(1, Math.min(14, ctx.params.meals));
  const byId = new Map(ctx.recipes.map((r) => [r.id, r]));
  const slots: Slot[] = [];
  const chosen = new Set<string>();
  const proteins: string[] = [];

  const lockedBySlot = new Map(locked.filter((l) => l.slot < n).map((l) => [l.slot, l.recipeId]));
  for (const [, id] of lockedBySlot) {
    chosen.add(id);
    const r = byId.get(id);
    if (r) proteins.push(proteinOf(r));
  }

  for (let slot = 0; slot < n; slot++) {
    const day = slotDay(ctx.weekStart, slot);
    const lockedId = lockedBySlot.get(slot);
    if (lockedId) {
      slots.push({ slot, day, recipeId: lockedId, reason: "Locked", locked: true });
      continue;
    }
    const pick = pickFor(ctx, slot, chosen, proteins, ctx.params.seed);
    if (pick) {
      chosen.add(pick.recipe.id);
      proteins.push(proteinOf(pick.recipe));
      slots.push({ slot, day, recipeId: pick.recipe.id, reason: pick.reason, locked: false });
    } else {
      slots.push({ slot, day, recipeId: null, reason: "No recipe fits the filters (or all were cooked in the last 2 weeks)", locked: false });
    }
  }
  return slots;
}

function pickFor(ctx: ProposeContext, slot: number, chosen: Set<string>, proteins: string[], seed: number): Scored | null {
  const candidates = ctx.recipes.filter((r) => !chosen.has(r.id) && passesFilters(r, ctx, slot));
  if (!candidates.length) return null;
  const scored = candidates.map((r) => score(r, ctx, proteins, slot, seed));
  scored.sort((a, b) => b.score - a.score || a.recipe.title.localeCompare(b.recipe.title));
  return scored[0];
}

/** "Give me another": replace one slot, keeping every other slot fixed. */
export function swapSlot(ctx: ProposeContext, current: Slot[], slotIndex: number, seed: number): Slot {
  const target = current.find((s) => s.slot === slotIndex);
  const others = current.filter((s) => s.slot !== slotIndex && s.recipeId);
  const chosen = new Set(others.map((s) => s.recipeId!));
  if (target?.recipeId) chosen.add(target.recipeId); // must differ from the current pick
  const byId = new Map(ctx.recipes.map((r) => [r.id, r]));
  const proteins = others.map((s) => byId.get(s.recipeId!)).filter(Boolean).map((r) => proteinOf(r!));
  const pick = pickFor(ctx, slotIndex, chosen, proteins, seed);
  const day = slotDay(ctx.weekStart, slotIndex);
  if (!pick) {
    return { slot: slotIndex, day, recipeId: target?.recipeId ?? null, reason: "No other recipe fits", locked: false };
  }
  return { slot: slotIndex, day, recipeId: pick.recipe.id, reason: pick.reason, locked: false };
}
