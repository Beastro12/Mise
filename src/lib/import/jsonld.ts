import * as cheerio from "cheerio";

export type LdRecipe = {
  title: string;
  servings: number | null;
  prepMinutes: number | null;
  cookMinutes: number | null;
  ingredients: string[];
  steps: string[];
  tags: string[];
  imageUrl: string | null;
  description: string | null;
};

type Json = null | string | number | boolean | Json[] | { [k: string]: Json };

function decodeEntities(s: string): string {
  if (!/[&<]/.test(s)) return s.trim();
  return cheerio.load(`<div>${s}</div>`)("div").text().replace(/\s+/g, " ").trim();
}

function asArray(v: Json | undefined): Json[] {
  if (v == null) return [];
  return Array.isArray(v) ? v : [v];
}

function str(v: Json | undefined): string | null {
  if (typeof v === "string") return decodeEntities(v);
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return str(v[0]);
  if (v && typeof v === "object" && "@value" in v) return str(v["@value"]);
  return null;
}

/** ISO 8601 duration ("PT1H30M", "P0DT45M") → minutes. */
export function isoDurationToMinutes(v: string | null): number | null {
  if (!v) return null;
  const m = v.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
  if (!m) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  const [, d, h, min, s] = m;
  const total = Number(d ?? 0) * 1440 + Number(h ?? 0) * 60 + Number(min ?? 0) + Number(s ?? 0) / 60;
  return total > 0 ? Math.round(total) : null;
}

function parseYield(v: Json | undefined): number | null {
  for (const y of asArray(v)) {
    const s = str(y);
    const m = s?.match(/\d+/);
    if (m) return parseInt(m[0], 10);
  }
  return null;
}

function flattenInstructions(v: Json | undefined): string[] {
  const out: string[] = [];
  const visit = (node: Json | undefined) => {
    if (node == null) return;
    if (typeof node === "string") {
      const t = decodeEntities(node);
      // Some sites put all steps in one string separated by newlines.
      for (const part of t.split(/\n+/)) if (part.trim()) out.push(part.trim());
      return;
    }
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node === "object") {
      const type = asArray(node["@type"]).map(String);
      if (type.includes("HowToSection")) return visit(node.itemListElement);
      const text = str(node.text) ?? str(node.name);
      if (text) out.push(text);
      else if (node.itemListElement) visit(node.itemListElement);
    }
  };
  visit(v);
  return out.map((s) => s.replace(/^\d+[.)]\s*/, ""));
}

function splitKeywords(v: Json | undefined): string[] {
  const out: string[] = [];
  for (const k of asArray(v)) {
    const s = str(k);
    if (s) out.push(...s.split(/[,;]/).map((t) => t.trim().toLowerCase()).filter(Boolean));
  }
  return out;
}

function isRecipe(node: Json): node is { [k: string]: Json } {
  if (!node || typeof node !== "object" || Array.isArray(node)) return false;
  return asArray(node["@type"]).some((t) => String(t).toLowerCase() === "recipe");
}

function collectRecipes(node: Json, out: Array<{ [k: string]: Json }>, depth = 0) {
  if (depth > 6 || node == null || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach((n) => collectRecipes(n, out, depth + 1));
  if (isRecipe(node)) out.push(node);
  for (const key of ["@graph", "mainEntity", "mainEntityOfPage", "hasPart", "itemListElement"]) {
    if (key in node) collectRecipes(node[key], out, depth + 1);
  }
}

function parseJsonLoose(text: string): Json | null {
  const cleaned = text
    .replace(/^\s*<!--/, "")
    .replace(/-->\s*$/, "")
    // Raw control characters inside strings break JSON.parse on some sites.
    .replace(/[\u0000-\u0019]+/g, " ");
  try {
    return JSON.parse(cleaned) as Json;
  } catch {
    return null;
  }
}

/** Extract schema.org Recipe objects from JSON-LD script tags. */
export function extractJsonLdRecipes(html: string, baseUrl?: string): LdRecipe[] {
  const $ = cheerio.load(html);
  const found: Array<{ [k: string]: Json }> = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    const json = parseJsonLoose($(el).text());
    if (json) collectRecipes(json, found);
  });

  return found.map((r) => {
    let imageUrl: string | null = null;
    for (const img of asArray(r.image)) {
      const u = typeof img === "string" ? img : img && typeof img === "object" && !Array.isArray(img) ? str(img.url) : null;
      if (u) {
        try {
          imageUrl = new URL(u, baseUrl).toString();
        } catch {
          imageUrl = u;
        }
        break;
      }
    }
    const tags = [
      ...splitKeywords(r.recipeCategory),
      ...splitKeywords(r.recipeCuisine),
      ...splitKeywords(r.keywords),
    ].filter((t) => t.length <= 30);
    const total = isoDurationToMinutes(str(r.totalTime));
    const prep = isoDurationToMinutes(str(r.prepTime));
    let cook = isoDurationToMinutes(str(r.cookTime));
    if (cook == null && total != null && prep != null && total > prep) cook = total - prep;
    return {
      title: str(r.name) ?? "Untitled recipe",
      servings: parseYield(r.recipeYield),
      prepMinutes: prep ?? (cook == null ? total : null),
      cookMinutes: cook,
      ingredients: asArray(r.recipeIngredient ?? r.ingredients)
        .map((i) => str(i))
        .filter((s): s is string => !!s),
      steps: flattenInstructions(r.recipeInstructions),
      tags: [...new Set(tags)].slice(0, 12),
      imageUrl,
      description: str(r.description),
    };
  });
}

/** Readable text of a page for the Claude fallback (scripts, nav and footers removed). */
export function pageText(html: string, maxChars = 60_000): { title: string; text: string } {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  $("script, style, noscript, nav, footer, header, aside, form, iframe, svg").remove();
  const root = $("article").first().length ? $("article").first() : $("main").first().length ? $("main").first() : $("body");
  const blocks: string[] = [];
  root.find("h1, h2, h3, h4, p, li, td, th, dt, dd, pre").each((_, el) => {
    const t = $(el).text().replace(/\s+/g, " ").trim();
    if (t) blocks.push(el.tagName === "li" ? `- ${t}` : t);
  });
  let text = blocks.join("\n");
  if (!text) text = root.text().replace(/\s+/g, " ").trim();
  return { title, text: text.slice(0, maxChars) };
}
