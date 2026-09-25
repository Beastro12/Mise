import type { SectionKey } from "./sections";

export type SynonymIndex = Map<string, { nameFi: string; category: SectionKey | null }>;

export function buildSynonymIndex(
  rows: Array<{ term: string; nameFi: string; category: string | null }>,
): SynonymIndex {
  const m: SynonymIndex = new Map();
  for (const r of rows) {
    m.set(r.term.toLowerCase().trim(), { nameFi: r.nameFi, category: (r.category as SectionKey) ?? null });
  }
  return m;
}

/** Nominative words that the partitive heuristic would otherwise mangle. */
const NOMINATIVE_EXCEPTIONS = new Set(["feta", "pita", "salsa", "pasta", "tortilla", "mozzarella", "ricotta", "polenta", "quinoa", "papaija", "tapioka", "kaakao", "chia"]);

/**
 * Best-effort Finnish partitive → nominative for a single word.
 * "kermaa" → "kerma", "perunoita" → "peruna", "tomaatteja" → "tomaatti".
 * Only a fallback; the synonym table is the source of truth.
 */
export function departitiveWord(word: string): string {
  const w = word.toLowerCase();
  if (w.length < 4 || NOMINATIVE_EXCEPTIONS.has(w)) return w;
  const rules: Array<[RegExp, string]> = [
    [/(ai|ei)sta$/, "$1nen"], // punaista → punainen
    [/tonta$/, "ton"], // maustamatonta → maustamaton
    [/töntä$/, "tön"],
    [/^(.{3,})oita$/, "$1a"], // perunoita → peruna (but not voita)
    [/^(.{3,})öitä$/, "$1ä"],
    [/tteja$/, "tti"], // tomaatteja → tomaatti
    [/ttejä$/, "tti"],
    [/eitä$/, "e"], // herneitä → herne
    [/eita$/, "e"],
    [/uja$/, "u"], // papuja → papu
    [/yjä$/, "y"],
    [/oja$/, "o"], // jauhoja → jauho
    [/öjä$/, "ö"],
    [/ia$/, "i"], // sipulia → sipuli
    [/iä$/, "i"], // kermaviiliä → kermaviili
    [/aa$/, "a"], // kermaa → kerma
    [/ää$/, "ä"],
    [/oa$/, "o"], // maitoa → maito
    [/öä$/, "ö"],
    [/ua$/, "u"], // kurkkua → kurkku
    [/yä$/, "y"],
    [/ya$/, "y"], // currya → curry
    [/([aeiouyäö])ta$/, "$1"], // voita → voi, liemikuutiota → liemikuutio
    [/([aeiouyäö])tä$/, "$1"], // lohifileetä → lohifilee
  ];
  for (const [re, rep] of rules) {
    if (re.test(w)) return w.replace(re, rep);
  }
  return w;
}

export function departitive(phrase: string): string {
  return phrase
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(departitiveWord)
    .join(" ");
}

/** Descriptor words we may drop when looking for a known base ingredient. */
const DESCRIPTORS = new Set([
  "jauhettu", "jauhettua", "kuivattu", "kuivattua", "tuore", "tuoretta", "luomu", "laktoositon", "laktoositonta",
  "kevyt", "kevyttä", "iso", "pieni", "ground", "dried", "fresh", "organic", "large", "small", "medium", "chopped",
]);

export type NormalizeResult = { nameFi: string; category: SectionKey | null; matched: boolean };

function cleanup(name: string): string {
  return name
    .toLowerCase()
    .replace(/\d+\s*%/g, "") // "10 %"
    .replace(/[“”"']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Map an ingredient name as written to a normalized Finnish name via the
 * synonym index. Falls back to a partitive→nominative heuristic (matched=false).
 */
export function normalizeName(name: string, index: SynonymIndex): NormalizeResult {
  const key = cleanup(name);
  if (!key) return { nameFi: "", category: null, matched: false };
  const tries = [key, departitive(key)];
  const words = key.split(" ");
  if (words.length > 1) {
    const kept = words.filter((w) => !DESCRIPTORS.has(w));
    if (kept.length && kept.length < words.length) {
      const k = kept.join(" ");
      tries.push(k, departitive(k));
    }
  }
  for (const t of tries) {
    const hit = index.get(t);
    if (hit) return { nameFi: hit.nameFi, category: hit.category, matched: true };
  }
  return { nameFi: departitive(key), category: null, matched: false };
}
