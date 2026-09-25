/**
 * Metric unit model.
 *
 * Canonical units are Finnish recipe units. Volume and mass convert through a base
 * unit (ml, g). "Opaque" units (tlk, pkt, nippu, …) only merge with themselves.
 */

export type Dimension = "mass" | "volume" | "count" | "opaque";

type UnitDef = { dim: Dimension; toBase: number };

export const UNITS: Record<string, UnitDef> = {
  g: { dim: "mass", toBase: 1 },
  kg: { dim: "mass", toBase: 1000 },
  ml: { dim: "volume", toBase: 1 },
  cl: { dim: "volume", toBase: 10 },
  dl: { dim: "volume", toBase: 100 },
  l: { dim: "volume", toBase: 1000 },
  rkl: { dim: "volume", toBase: 15 },
  tl: { dim: "volume", toBase: 5 },
  mausteml: { dim: "volume", toBase: 1 },
  kpl: { dim: "count", toBase: 1 },
  // opaque
  tlk: { dim: "opaque", toBase: 1 },
  pkt: { dim: "opaque", toBase: 1 },
  prk: { dim: "opaque", toBase: 1 },
  pss: { dim: "opaque", toBase: 1 },
  rs: { dim: "opaque", toBase: 1 },
  pullo: { dim: "opaque", toBase: 1 },
  nippu: { dim: "opaque", toBase: 1 },
  ruukku: { dim: "opaque", toBase: 1 },
  kynsi: { dim: "opaque", toBase: 1 },
  oksa: { dim: "opaque", toBase: 1 },
  viipale: { dim: "opaque", toBase: 1 },
  levy: { dim: "opaque", toBase: 1 },
  ripaus: { dim: "opaque", toBase: 1 },
  annos: { dim: "opaque", toBase: 1 },
};

export const CANONICAL_UNITS = Object.keys(UNITS);

/**
 * Words/abbreviations that may appear in a recipe → canonical unit and a factor
 * applied to the quantity. Imperial units are converted to metric here.
 */
const ALIASES: Array<[string[], string, number]> = [
  [["g", "gr", "gramma", "grammaa", "gram", "grams", "gramme", "grammes"], "g", 1],
  [["kg", "kilo", "kiloa", "kilogramma", "kilogrammaa", "kilogram", "kilograms"], "kg", 1],
  [["ml", "millilitra", "millilitraa", "milliliter", "milliliters", "millilitre", "millilitres"], "ml", 1],
  [["cl", "senttilitra", "senttilitraa"], "cl", 1],
  [["dl", "desilitra", "desilitraa", "deciliter", "decilitre"], "dl", 1],
  [["l", "litra", "litraa", "liter", "liters", "litre", "litres"], "l", 1],
  [["rkl", "rk", "ruokalusikka", "ruokalusikkaa", "ruokalusikallinen", "ruokalusikallista"], "rkl", 1],
  [["tbsp", "tbs", "tablespoon", "tablespoons", "tblsp"], "rkl", 1],
  [["tl", "teelusikka", "teelusikkaa", "teelusikallinen", "teelusikallista"], "tl", 1],
  [["tsp", "teaspoon", "teaspoons"], "tl", 1],
  [["mausteml", "maustemitta", "maustemittaa"], "mausteml", 1],
  // Imperial → metric
  [["cup", "cups"], "dl", 2.366],
  [["oz", "ounce", "ounces"], "g", 28.35],
  [["lb", "lbs", "pound", "pounds"], "g", 453.6],
  [["fl oz", "fl. oz", "fluid ounce", "fluid ounces"], "ml", 29.57],
  [["pint", "pints"], "ml", 473.2],
  [["quart", "quarts", "qt"], "ml", 946.4],
  // Counts
  [["kpl", "kappale", "kappaletta", "pcs", "pc", "piece", "pieces"], "kpl", 1],
  // Opaque
  [["tlk", "tölkki", "tölkkiä", "can", "cans", "tin", "tins"], "tlk", 1],
  [["pkt", "paketti", "pakettia", "pack", "packs", "package", "packages", "packet", "packets"], "pkt", 1],
  [["prk", "purkki", "purkkia", "jar", "jars", "tub", "tubs"], "prk", 1],
  [["pss", "pussi", "pussia", "bag", "bags"], "pss", 1],
  [["rs", "rasia", "rasiaa", "box", "boxes", "punnet"], "rs", 1],
  [["pullo", "pulloa", "bottle", "bottles"], "pullo", 1],
  [["nippu", "nippua", "bunch", "bunches"], "nippu", 1],
  [["ruukku", "ruukkua", "pot"], "ruukku", 1],
  [["kynsi", "kynttä", "clove", "cloves"], "kynsi", 1],
  [["oksa", "oksaa", "sprig", "sprigs"], "oksa", 1],
  [["viipale", "viipaletta", "slice", "slices"], "viipale", 1],
  [["levy", "levyä"], "levy", 1],
  [["ripaus", "ripausta", "pinch", "pinches"], "ripaus", 1],
  [["annos", "annosta"], "annos", 1],
];

const ALIAS_MAP = new Map<string, { unit: string; factor: number }>();
for (const [words, unit, factor] of ALIASES) {
  for (const w of words) ALIAS_MAP.set(w, { unit, factor });
}

/** Longest aliases first, so "fl oz" is tried before "oz". */
export const UNIT_ALIAS_WORDS = [...ALIAS_MAP.keys()].sort((a, b) => b.length - a.length);

export function resolveUnitAlias(word: string): { unit: string; factor: number } | null {
  const w = word.toLowerCase().replace(/\.$/, "");
  return ALIAS_MAP.get(w) ?? ALIAS_MAP.get(word.toLowerCase()) ?? null;
}

export function unitDef(unit: string | null | undefined): UnitDef | null {
  if (!unit) return null;
  return UNITS[unit] ?? null;
}

/** Key that decides which quantities may be summed together. */
export function mergeKey(unit: string | null | undefined): string {
  if (!unit) return "count";
  const def = UNITS[unit];
  if (!def) return `opaque:${unit}`;
  if (def.dim === "opaque") return `opaque:${unit}`;
  return def.dim;
}

export function toBase(quantity: number, unit: string | null | undefined): number {
  const def = unitDef(unit ?? "kpl");
  return quantity * (def ? def.toBase : 1);
}

export function areCompatible(a: string | null | undefined, b: string | null | undefined): boolean {
  return mergeKey(a) === mergeKey(b);
}

/** Convert a quantity between two compatible units. Returns null if incompatible. */
export function convert(quantity: number, from: string | null, to: string | null): number | null {
  if (!areCompatible(from, to)) return null;
  const f = unitDef(from ?? "kpl")?.toBase ?? 1;
  const t = unitDef(to ?? "kpl")?.toBase ?? 1;
  return (quantity * f) / t;
}

/** Pick a readable unit for a base-unit amount. */
export function bestDisplayUnit(baseValue: number, dim: Dimension): { quantity: number; unit: string } {
  if (dim === "volume") {
    if (baseValue >= 1000) return { quantity: round(baseValue / 1000), unit: "l" };
    if (baseValue >= 100) return { quantity: round(baseValue / 100), unit: "dl" };
    return { quantity: round(baseValue), unit: "ml" };
  }
  if (dim === "mass") {
    if (baseValue >= 1000) return { quantity: round(baseValue / 1000), unit: "kg" };
    return { quantity: round(baseValue), unit: "g" };
  }
  return { quantity: round(baseValue), unit: "kpl" };
}

export type Qty = { quantity: number | null; unit: string | null };

/**
 * Sum quantities that share a merge key. If all share the same unit, keep it;
 * otherwise sum in the base unit and choose a display unit.
 */
export function sumCompatible(items: Array<{ quantity: number; unit: string | null }>): {
  quantity: number;
  unit: string | null;
} {
  if (items.length === 0) throw new Error("sumCompatible: empty");
  const key = mergeKey(items[0].unit);
  for (const it of items) {
    if (mergeKey(it.unit) !== key) throw new Error(`sumCompatible: incompatible units ${items[0].unit} / ${it.unit}`);
  }
  const units = new Set(items.map((i) => i.unit ?? "kpl"));
  if (units.size === 1) {
    return { quantity: round(items.reduce((s, i) => s + i.quantity, 0)), unit: items[0].unit };
  }
  const base = items.reduce((s, i) => s + toBase(i.quantity, i.unit), 0);
  const dim = unitDef(items[0].unit ?? "kpl")?.dim ?? "count";
  return bestDisplayUnit(base, dim);
}

export function round(n: number, decimals = 2): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Finnish-style number: 1.5 → "1,5", 2 → "2". */
export function formatNumber(n: number): string {
  const r = n >= 100 ? Math.round(n) : n >= 10 ? round(n, 1) : round(n, 2);
  return String(r).replace(".", ",");
}

/** Promote g → kg and ml → l at 1000 for display (other units untouched). */
export function humanize(q: Qty): Qty {
  if (q.quantity == null) return q;
  if (q.unit === "g" && q.quantity >= 1000) return { quantity: round(q.quantity / 1000, 3), unit: "kg" };
  if (q.unit === "ml" && q.quantity >= 1000) return { quantity: round(q.quantity / 1000, 3), unit: "l" };
  return q;
}

export function formatQty(q: Qty): string {
  if (q.quantity == null) return "";
  const h = humanize(q);
  return h.unit ? `${formatNumber(h.quantity!)} ${h.unit}` : formatNumber(h.quantity!);
}
