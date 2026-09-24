import { UNIT_ALIAS_WORDS, resolveUnitAlias, round } from "./units";

export type ParsedIngredient = {
  originalText: string;
  quantity: number | null;
  unit: string | null;
  name: string;
  prepNote: string | null;
  optional: boolean;
};

const UNICODE_FRACTIONS: Record<string, string> = {
  "½": "1/2",
  "⅓": "1/3",
  "⅔": "2/3",
  "¼": "1/4",
  "¾": "3/4",
  "⅕": "1/5",
  "⅛": "1/8",
  "⅜": "3/8",
  "⅝": "5/8",
  "⅞": "7/8",
  "⅙": "1/6",
};

/** Words that describe preparation or size rather than the product to buy. */
const PREP_WORDS = new Set(
  [
    // Finnish
    "hienonnettu", "hienonnettuna", "hienonnettuja", "hienoksi", "silputtu", "silputtuna", "kuutioitu",
    "kuutioituna", "kuutioina", "raastettu", "raastettuna", "pilkottu", "pilkottuna", "pilkottuja",
    "viipaloitu", "viipaloituna", "viipaleina", "suikaloitu", "suikaloituna", "suikaleina", "murskattu",
    "murskattuna", "kuorittu", "kuorittuna", "kuorittuja", "keitetty", "keitettynä", "keitettyjä",
    "keitettyinä", "sulatettu", "sulatettuna", "paahdettu", "paahdettuna", "lohkottu", "lohkoina",
    "paloiteltu", "paloiteltuna", "paloina", "puolitettu", "puolitettuna", "huoneenlämpöinen",
    "huuhdeltu", "valutettu", "iso", "isoa", "isot", "pieni", "pientä", "pienet", "keskikokoinen",
    "keskikokoista", "tuore", "tuoretta", "n.", "noin",
    // English
    "chopped", "finely", "roughly", "coarsely", "diced", "minced", "sliced", "thinly", "grated", "crushed",
    "peeled", "cubed", "shredded", "melted", "softened", "halved", "quartered", "rinsed", "drained",
    "large", "small", "medium", "fresh", "about", "approx", "approx.", "trimmed", "cut",
  ].map((w) => w.toLowerCase()),
);

const OPTIONAL_RE = /\b(valinnainen|valinnaisesti|halutessasi|optional|if desired)\b/i;
const TO_TASTE_RE = /\b(maun mukaan|to taste)\b/i;

function replaceUnicodeFractions(s: string): string {
  return s.replace(/(\d)?([½⅓⅔¼¾⅕⅛⅜⅝⅞⅙])/g, (_, d: string | undefined, f: string) =>
    d ? `${d} ${UNICODE_FRACTIONS[f]}` : UNICODE_FRACTIONS[f],
  );
}

function parseNumberToken(tok: string): number | null {
  const t = tok.replace(",", ".");
  if (/^\d+\/\d+$/.test(t)) {
    const [a, b] = t.split("/").map(Number);
    return b ? a / b : null;
  }
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  return null;
}

const NUM = String.raw`\d+(?:[.,]\d+)?(?:\/\d+)?`;
// mixed number ("1 1/2"), range ("1-2", "1–2"), or single number
const QTY_RE = new RegExp(String.raw`^(${NUM})(?:\s+(\d+\/\d+))?(?:\s*[-–]\s*(${NUM}))?`);

function stripBullet(s: string): string {
  return s.replace(/^\s*(?:[-*•–·]|\d+[.)](?=\s))\s*/, "").trim();
}

export function parseIngredientLine(line: string): ParsedIngredient {
  const originalText = line.trim();
  let rest = replaceUnicodeFractions(stripBullet(originalText));
  let optional = false;
  const notes: string[] = [];

  if (OPTIONAL_RE.test(rest)) {
    optional = true;
    rest = rest.replace(OPTIONAL_RE, "").trim();
  }
  if (TO_TASTE_RE.test(rest)) {
    notes.push(rest.match(TO_TASTE_RE)![0].toLowerCase());
    rest = rest.replace(TO_TASTE_RE, "").trim();
  }

  // "n. 400 g", "noin 2 dl", "about 1 cup"
  rest = rest.replace(/^(n\.|noin|about|approx\.?|ca\.?)\s+/i, "");

  // Glued number+unit like "400g" / "2dl"
  rest = rest.replace(/^(\d+(?:[.,]\d+)?)([a-zA-ZäöÄÖ]+)\b/, (m, n: string, u: string) =>
    resolveUnitAlias(u) ? `${n} ${u}` : m,
  );

  let quantity: number | null = null;
  const qm = rest.match(QTY_RE);
  if (qm) {
    const first = parseNumberToken(qm[1]);
    const frac = qm[2] ? parseNumberToken(qm[2]) : null;
    const upper = qm[3] ? parseNumberToken(qm[3]) : null;
    if (first != null) {
      quantity = first + (frac ?? 0);
      // Ranges: buy for the upper bound.
      if (upper != null) quantity = Math.max(quantity, upper);
      rest = rest.slice(qm[0].length).trim();
    }
  }

  let unit: string | null = null;
  if (rest) {
    const lower = rest.toLowerCase();
    for (const alias of UNIT_ALIAS_WORDS) {
      if (lower.startsWith(alias)) {
        const next = lower.charAt(alias.length);
        if (next === "" || /[\s.,)(]/.test(next)) {
          const res = resolveUnitAlias(alias)!;
          unit = res.unit;
          if (quantity != null) quantity = round(quantity * res.factor, 2);
          rest = rest.slice(alias.length).replace(/^\.\s*/, "").trim();
          break;
        }
      }
    }
  }
  if (quantity != null && unit == null) unit = "kpl";
  // English "of": "2 cups of flour"
  rest = rest.replace(/^of\s+/i, "");

  // Parenthesised notes
  rest = rest.replace(/\(([^)]*)\)/g, (_, inner: string) => {
    if (inner.trim()) notes.push(inner.trim());
    return " ";
  });

  // Everything after the first comma is a note
  const comma = rest.indexOf(",");
  if (comma >= 0) {
    const tail = rest.slice(comma + 1).trim();
    if (tail) notes.push(tail);
    rest = rest.slice(0, comma);
  }

  // Leading/trailing prep words
  const words = rest.split(/\s+/).filter(Boolean);
  const lead: string[] = [];
  while (words.length > 1 && PREP_WORDS.has(words[0].toLowerCase())) lead.push(words.shift()!);
  const trail: string[] = [];
  while (words.length > 1 && PREP_WORDS.has(words[words.length - 1].toLowerCase())) trail.unshift(words.pop()!);
  const prepParts = [...lead, ...trail].join(" ").trim();
  if (prepParts) notes.unshift(prepParts);

  const name = words.join(" ").replace(/\s+/g, " ").replace(/[.;:]+$/, "").trim();

  return {
    originalText,
    quantity: quantity != null ? round(quantity, 3) : null,
    unit,
    name: name || originalText,
    prepNote: notes.length ? notes.join(", ") : null,
    optional,
  };
}

/**
 * Parse many lines. A quantity-less "X ja Y" / "X and Y" line of two single words
 * ("suolaa ja pippuria") becomes two ingredients.
 */
export function parseIngredientLines(lines: string[]): ParsedIngredient[] {
  const out: ParsedIngredient[] = [];
  for (const raw of lines) {
    if (!raw || !raw.trim()) continue;
    const p = parseIngredientLine(raw);
    const m = p.quantity == null ? p.name.match(/^(\S+)\s+(?:ja|and|&)\s+(\S+)$/i) : null;
    if (m) {
      out.push({ ...p, name: m[1] });
      out.push({ ...p, name: m[2] });
    } else {
      out.push(p);
    }
  }
  return out;
}
