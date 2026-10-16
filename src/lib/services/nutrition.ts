import "server-only";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { MealSlot } from "@/db/schema";
import { config } from "@/lib/env";
import type { DailyHealth } from "@/lib/health/apple";
import { parseOura } from "@/lib/health/oura";
import { addDays, todayHelsinki } from "../domain/offers";
import { DEFAULT_PROFILE, MEALS, deficitTarget, planDeficitWeek, summarizeWeek, type FoodEntry, type HealthDay, type Profile } from "../domain/nutrition";

export type FoodRow = typeof schema.foodEntries.$inferSelect;

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export async function getProfile(): Promise<Profile & { saved: boolean }> {
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, "nutrition"));
  return { ...DEFAULT_PROFILE, ...((row?.value as Partial<Profile>) ?? {}), saved: !!row };
}

export async function setProfile(p: Profile) {
  const db = await getDb();
  await db
    .insert(schema.settings)
    .values({ key: "nutrition", value: p })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: p } });
}

// ---------------------------------------------------------------------------
// Food log
// ---------------------------------------------------------------------------

export async function listEntries(from: string, to: string): Promise<FoodRow[]> {
  const db = await getDb();
  return db
    .select()
    .from(schema.foodEntries)
    .where(and(gte(schema.foodEntries.day, from), lte(schema.foodEntries.day, to)))
    .orderBy(asc(schema.foodEntries.day), asc(schema.foodEntries.createdAt));
}

export async function addEntry(input: { day: string; meal: MealSlot; name: string; portion?: string | null; kcal: number; proteinG?: number | null; recipeId?: string | null }) {
  const name = input.name.trim();
  if (!name) throw new Error("What did you eat?");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day)) throw new Error("Invalid date.");
  if (!MEALS.includes(input.meal)) throw new Error("Invalid meal.");
  if (!Number.isFinite(input.kcal) || input.kcal < 0 || input.kcal > 10_000) throw new Error("Calories must be between 0 and 10000.");
  const db = await getDb();
  await db.insert(schema.foodEntries).values({
    day: input.day,
    meal: input.meal,
    name,
    portion: input.portion?.trim() || null,
    kcal: Math.round(input.kcal),
    proteinG: input.proteinG ?? null,
    recipeId: input.recipeId || null,
  });
}

export async function deleteEntry(id: string) {
  const db = await getDb();
  await db.delete(schema.foodEntries).where(eq(schema.foodEntries.id, id));
}

/** Foods logged before, newest first, one per name: for quick re-logging. */
export async function recentFoods(limit = 150): Promise<Array<{ name: string; portion: string | null; kcal: number; meal: MealSlot }>> {
  const db = await getDb();
  const rows = await db.select().from(schema.foodEntries).orderBy(desc(schema.foodEntries.createdAt)).limit(1000);
  const seen = new Set<string>();
  const out: Array<{ name: string; portion: string | null; kcal: number; meal: MealSlot }> = [];
  for (const r of rows) {
    const k = r.name.trim().toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({ name: r.name, portion: r.portion, kcal: r.kcal, meal: r.meal });
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Health data (Apple Health, Oura)
// ---------------------------------------------------------------------------

const intOrNull = (n: number | null | undefined) => (n == null || !Number.isFinite(n) ? null : Math.round(n));

export async function saveHealthDays(source: "apple" | "oura", days: DailyHealth[]): Promise<number> {
  const valid = days.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day));
  if (!valid.length) return 0;
  const db = await getDb();
  for (const d of valid) {
    const values = {
      activeKcal: intOrNull(d.activeKcal),
      basalKcal: intOrNull(d.basalKcal),
      totalKcal: intOrNull(d.totalKcal),
      steps: intOrNull(d.steps),
      weightKg: d.weightKg == null || !Number.isFinite(d.weightKg) ? null : d.weightKg,
      intakeKcal: intOrNull(d.intakeKcal),
      importedAt: new Date(),
    };
    await db
      .insert(schema.healthDays)
      .values({ day: d.day, source, ...values })
      .onConflictDoUpdate({ target: [schema.healthDays.day, schema.healthDays.source], set: values });
  }
  return valid.length;
}

export async function listHealth(from: string, to: string): Promise<Array<HealthDay & { intakeKcal: number | null; importedAt: Date }>> {
  const db = await getDb();
  return db
    .select()
    .from(schema.healthDays)
    .where(and(gte(schema.healthDays.day, from), lte(schema.healthDays.day, to)))
    .orderBy(desc(schema.healthDays.day), asc(schema.healthDays.source));
}

/** Latest weight from any source, for prefilling the profile. */
export async function latestWeight(): Promise<{ day: string; kg: number } | null> {
  const rows = await listHealth(addDays(todayHelsinki(), -60), todayHelsinki());
  const w = rows.find((r) => r.weightKg != null);
  return w ? { day: w.day, kg: w.weightKg! } : null;
}

export function ouraConfigured() {
  return !!config.ouraToken;
}

/**
 * Pull daily activity from the Oura API v2 (UNVERIFIED live: written from the
 * public API docs, not run against a real account).
 */
export async function syncOura(days = 30): Promise<number> {
  const token = config.ouraToken;
  if (!token) throw new Error("OURA_ACCESS_TOKEN is not set.");
  const end = todayHelsinki();
  const start = addDays(end, -days);
  const url = `https://api.ouraring.com/v2/usercollection/daily_activity?start_date=${start}&end_date=${addDays(end, 1)}`;
  let res: Response;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new Error("Could not reach Oura (network error or timeout). Check the connection and try again.");
  }
  if (res.status === 401 || res.status === 403) throw new Error("Oura rejected the token (personal access tokens may be retired). Use the file import instead.");
  if (res.status === 429) throw new Error("Oura rate limit reached; try again in a few minutes.");
  if (!res.ok) throw new Error(`Oura API error ${res.status}.`);
  return saveHealthDays("oura", parseOura(await res.text()));
}

// ---------------------------------------------------------------------------
// Week view: what you ate + next week's plan
// ---------------------------------------------------------------------------

export async function weekView(monday: string) {
  const sunday = addDays(monday, 6);
  const [profile, rows, health] = await Promise.all([getProfile(), listEntries(monday, sunday), listHealth(monday, sunday)]);
  const entries: FoodEntry[] = rows.map((r) => ({ ...r }));
  const summary = summarizeWeek(monday, entries, health, profile);
  const target = deficitTarget(summary.avgBurn, profile);
  const plan = summary.loggedDays ? planDeficitWeek({ startDay: addDays(monday, 7), entries, loggedDays: summary.loggedDays, target: target.target }) : null;
  return { profile, summary, target, plan, healthDays: health.length };
}
