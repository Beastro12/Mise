import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { buildSynonymIndex, normalizeName, type SynonymIndex } from "../domain/normalize";
import { toSectionKey, type SectionKey } from "../domain/sections";
import { aiAvailable } from "../ai/client";
import { normalizeNames } from "../ai/extract";

let cached: { index: SynonymIndex; names: string[] } | null = null;

export function invalidateVocab() {
  cached = null;
}

export async function getVocab(): Promise<{ index: SynonymIndex; names: string[] }> {
  if (cached) return cached;
  const db = await getDb();
  const rows = await db.select().from(schema.synonyms);
  const index = buildSynonymIndex(rows);
  const names = [...new Set(rows.map((r) => r.nameFi))].sort();
  cached = { index, names };
  return cached;
}

export async function getStaples(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.select().from(schema.staples);
  return new Set(rows.map((r) => r.nameFi));
}

export type Normalized = { nameFi: string; category: SectionKey };

/**
 * Normalize ingredient names: synonym table first; unknown names go to Claude
 * (if configured) and the answers are remembered as synonyms (source "claude").
 */
export async function normalizeMany(names: string[]): Promise<Map<string, Normalized>> {
  const { index, names: known } = await getVocab();
  const out = new Map<string, Normalized>();
  const unknown: string[] = [];
  for (const n of names) {
    const r = normalizeName(n, index);
    if (r.matched) out.set(n, { nameFi: r.nameFi, category: toSectionKey(r.category) });
    else {
      out.set(n, { nameFi: r.nameFi || n.toLowerCase(), category: "muut" });
      unknown.push(n);
    }
  }
  if (unknown.length && aiAvailable()) {
    try {
      const res = await normalizeNames([...new Set(unknown)], known);
      const learned: Array<{ term: string; nameFi: string; category: string }> = [];
      for (const item of res) {
        const nameFi = item.name_fi.trim().toLowerCase();
        if (!nameFi) continue;
        const category = toSectionKey(index.get(nameFi)?.category ?? item.category);
        out.set(item.name, { nameFi, category });
        learned.push({ term: item.name.toLowerCase().trim(), nameFi, category });
      }
      await rememberSynonyms(learned, "claude");
    } catch (e) {
      console.warn("[vocab] Claude normalization failed, using local fallback:", (e as Error).message);
    }
  }
  return out;
}

export async function rememberSynonyms(
  rows: Array<{ term: string; nameFi: string; category: string | null }>,
  source: "user" | "claude",
) {
  const clean = rows.filter((r) => r.term && r.nameFi);
  if (!clean.length) return;
  const db = await getDb();
  await db
    .insert(schema.synonyms)
    .values(clean.map((r) => ({ term: r.term.toLowerCase().trim(), nameFi: r.nameFi, category: r.category, source })))
    .onConflictDoNothing();
  invalidateVocab();
}

export async function listSynonyms(filter?: string) {
  const db = await getDb();
  const rows = await db.select().from(schema.synonyms).orderBy(asc(schema.synonyms.nameFi), asc(schema.synonyms.term));
  const f = filter?.trim().toLowerCase();
  return f ? rows.filter((r) => r.term.includes(f) || r.nameFi.includes(f)) : rows;
}

export async function upsertSynonym(term: string, nameFi: string, category: string | null) {
  const db = await getDb();
  const t = term.toLowerCase().trim();
  const n = nameFi.toLowerCase().trim();
  if (!t || !n) throw new Error("Both the term and the Finnish name are required.");
  await db
    .insert(schema.synonyms)
    .values({ term: t, nameFi: n, category: category ? toSectionKey(category) : null, source: "user" })
    .onConflictDoUpdate({
      target: schema.synonyms.term,
      set: { nameFi: n, category: category ? toSectionKey(category) : null, source: "user" },
    });
  invalidateVocab();
}

export async function deleteSynonym(id: string) {
  const db = await getDb();
  await db.delete(schema.synonyms).where(eq(schema.synonyms.id, id));
  invalidateVocab();
}
