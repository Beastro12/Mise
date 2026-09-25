export const SECTIONS = [
  { key: "hedelmat_vihannekset", fi: "Hedelmät ja vihannekset", en: "Fruit & vegetables" },
  { key: "leipa", fi: "Leipä", en: "Bread" },
  { key: "liha_kala", fi: "Liha ja kala", en: "Meat & fish" },
  { key: "maito_juusto", fi: "Maito ja juusto", en: "Dairy & cheese" },
  { key: "kuivatuotteet", fi: "Kuivatuotteet", en: "Dry goods" },
  { key: "pakasteet", fi: "Pakasteet", en: "Frozen" },
  { key: "juomat", fi: "Juomat", en: "Drinks" },
  { key: "muut", fi: "Muut", en: "Other" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

export const SECTION_KEYS: SectionKey[] = SECTIONS.map((s) => s.key);

export function isSectionKey(v: unknown): v is SectionKey {
  return typeof v === "string" && (SECTION_KEYS as string[]).includes(v);
}

export function toSectionKey(v: unknown): SectionKey {
  return isSectionKey(v) ? v : "muut";
}

export function sectionLabel(key: string): string {
  const s = SECTIONS.find((x) => x.key === key);
  return s ? `${s.en} · ${s.fi}` : key;
}

/**
 * Complete a stored per-store order: stored keys first (in stored order),
 * then any section missing from it in default order.
 */
export function resolveSectionOrder(stored: string[] | undefined | null): SectionKey[] {
  const out: SectionKey[] = [];
  for (const k of stored ?? []) if (isSectionKey(k) && !out.includes(k)) out.push(k);
  for (const k of SECTION_KEYS) if (!out.includes(k)) out.push(k);
  return out;
}
