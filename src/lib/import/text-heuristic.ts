/**
 * Local (no-AI) recipe splitter for plain text / Markdown / extracted PDF or
 * DOCX text. Used when ANTHROPIC_API_KEY is not configured. Best effort only;
 * the review screen is where you fix what it got wrong.
 */

export type TextRecipe = {
  title: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredientLines: string[];
  steps: string[];
  notes: string | null;
};

const ING_HEADER = /^(?:#+\s*)?(?:\*\*)?(ainekset|aineosat|ainesosat|raaka-?aineet|tarvitset|ingredients?)(?:\*\*)?\s*:?\s*$/i;
const STEP_HEADER =
  /^(?:#+\s*)?(?:\*\*)?(ohje|ohjeet|valmistus|valmistusohje|tee näin|näin teet|instructions?|method|directions|steps|preparation)(?:\*\*)?\s*:?\s*$/i;
const NOTE_HEADER = /^(?:#+\s*)?(?:\*\*)?(vinkki|vinkit|huom|notes?|tips?)(?:\*\*)?\s*:?\s*$/i;

function isSectionHeader(line: string): boolean {
  return ING_HEADER.test(line) || STEP_HEADER.test(line) || NOTE_HEADER.test(line);
}

function parseServings(text: string): number | null {
  const m =
    text.match(/(\d+)\s*(?:annosta|annokselle|hengelle|henkilölle|servings|portions|people)/i) ??
    text.match(/(?:serves|annokset|annoksia|servings|yields?)\s*:?\s*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

function parseMinutes(text: string, re: RegExp): number | null {
  const m = text.match(re);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return /^(h|t|tunti|tuntia|hour|hours)/i.test(m[2]) ? Math.round(n * 60) : Math.round(n);
}

const TIME_UNIT = String.raw`(min|minuuttia|minutes|mins|h|t|tunti|tuntia|hour|hours)`;
const PREP_RE = new RegExp(String.raw`(?:esivalmistelu|valmisteluaika|prep(?:aration)? time|prep)\s*:?\s*(\d+(?:[.,]\d+)?)\s*${TIME_UNIT}`, "i");
const COOK_RE = new RegExp(String.raw`(?:kypsennysaika|paistoaika|keittoaika|cook(?:ing)? time|cook)\s*:?\s*(\d+(?:[.,]\d+)?)\s*${TIME_UNIT}`, "i");
const TOTAL_RE = new RegExp(String.raw`(?:valmistusaika|kokonaisaika|total time|aika)\s*:?\s*(\d+(?:[.,]\d+)?)\s*${TIME_UNIT}`, "i");

function looksLikeIngredient(line: string): boolean {
  const l = line.replace(/^[-*•–]\s*/, "");
  if (/^\d/.test(l) || /^[½¼¾⅓⅔]/.test(l)) return l.length < 80;
  return /^[-*•–]/.test(line) && l.length < 60 && !/[.!?]$/.test(l);
}

function splitBlocks(text: string): string[][] {
  const lines = text.replace(/\r/g, "").split("\n").map((l) => l.trim());
  // Markdown headings (# / ##) that are not section headers start a new recipe.
  const headingIdx = lines
    .map((l, i) => (/^#{1,2}\s+\S/.test(l) && !isSectionHeader(l) ? i : -1))
    .filter((i) => i >= 0);
  if (headingIdx.length > 1 || (headingIdx.length === 1 && headingIdx[0] > 0 && lines.slice(0, headingIdx[0]).some(Boolean))) {
    const blocks: string[][] = [];
    const starts = headingIdx[0] > 0 && lines.slice(0, headingIdx[0]).some(Boolean) ? [0, ...headingIdx] : headingIdx;
    starts.forEach((s, k) => blocks.push(lines.slice(s, starts[k + 1] ?? lines.length)));
    return blocks.filter((b) => b.some((l) => ING_HEADER.test(l) || b.filter(looksLikeIngredient).length >= 2));
  }
  // Plain text: a title line followed (within 4 lines) by an ingredients header starts a recipe.
  const ingIdx = lines.map((l, i) => (ING_HEADER.test(l) ? i : -1)).filter((i) => i >= 0);
  if (ingIdx.length > 1) {
    const starts = ingIdx.map((i) => {
      let s = i - 1;
      while (s > 0 && !lines[s]) s--;
      // walk back over metadata lines (servings/time) to the title
      let t = s;
      for (let k = 0; k < 4 && t > 0; k++) {
        if (lines[t - 1] && !looksLikeIngredient(lines[t - 1]) && lines[t - 1].length < 80) t--;
        else break;
      }
      return Math.max(0, t);
    });
    return starts.map((s, k) => lines.slice(s, starts[k + 1] ?? lines.length));
  }
  return [lines];
}

function parseBlock(block: string[]): TextRecipe | null {
  const lines = block.filter((l, i) => l || i > 0);
  const titleLine = lines.find((l) => l && !isSectionHeader(l)) ?? "Untitled recipe";
  const title = titleLine.replace(/^#+\s*/, "").replace(/\*\*/g, "").trim();
  const body = lines.slice(lines.indexOf(titleLine) + 1);
  const joined = body.join("\n");

  const ingredientLines: string[] = [];
  const steps: string[] = [];
  const notes: string[] = [];
  let mode: "auto" | "ing" | "steps" | "notes" = "auto";

  for (const raw of body) {
    const line = raw.trim();
    if (!line) continue;
    if (ING_HEADER.test(line)) {
      mode = "ing";
      continue;
    }
    if (STEP_HEADER.test(line)) {
      mode = "steps";
      continue;
    }
    if (NOTE_HEADER.test(line)) {
      mode = "notes";
      continue;
    }
    if (/^#{3,}\s/.test(line)) continue; // sub-headings inside a section
    if (PREP_RE.test(line) || COOK_RE.test(line) || TOTAL_RE.test(line) || (parseServings(line) && line.length < 60)) continue;
    const clean = line.replace(/^[-*•–]\s*/, "").replace(/^\d+[.)]\s+(?=\D)/, "");
    if (mode === "ing" || (mode === "auto" && looksLikeIngredient(line))) ingredientLines.push(line.replace(/^[-*•–]\s*/, ""));
    else if (mode === "notes") notes.push(clean);
    else steps.push(clean);
  }
  if (!ingredientLines.length && !steps.length) return null;

  const total = parseMinutes(joined, TOTAL_RE);
  const prep = parseMinutes(joined, PREP_RE);
  const cook = parseMinutes(joined, COOK_RE);
  return {
    title,
    servings: parseServings(joined),
    prepMinutes: prep ?? (cook == null ? total : null),
    cookMinutes: cook ?? (prep != null && total != null && total > prep ? total - prep : null),
    ingredientLines,
    steps,
    notes: notes.length ? notes.join("\n") : null,
  };
}

export function splitRecipesFromText(text: string): TextRecipe[] {
  return splitBlocks(text)
    .map(parseBlock)
    .filter((r): r is TextRecipe => !!r);
}
