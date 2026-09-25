import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { isDue } from "../domain/household";
import { todayHelsinki } from "../domain/offers";
import { toSectionKey } from "../domain/sections";
import { normalizeMany } from "./vocab";

export type HouseholdRow = typeof schema.householdItems.$inferSelect;

export async function listHousehold(): Promise<HouseholdRow[]> {
  const db = await getDb();
  return db.select().from(schema.householdItems).orderBy(asc(schema.householdItems.name));
}

export async function addHousehold(input: { name: string; nameFi?: string; intervalDays: number; quantity: number | null; unit: string | null }) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  let nameFi = input.nameFi?.trim().toLowerCase();
  let section = "muut";
  if (!nameFi) {
    const n = (await normalizeMany([name])).get(name)!;
    nameFi = n.nameFi;
    section = n.category;
  }
  const db = await getDb();
  await db.insert(schema.householdItems).values({
    name,
    nameFi,
    intervalDays: Math.max(1, Math.round(input.intervalDays || 14)),
    quantity: input.quantity,
    unit: input.quantity == null ? null : (input.unit ?? "kpl"),
    section: toSectionKey(section),
  });
}

export async function updateHousehold(id: string, patch: { intervalDays?: number; active?: boolean; lastBoughtOn?: string | null }) {
  const db = await getDb();
  await db
    .update(schema.householdItems)
    .set({
      ...(patch.intervalDays ? { intervalDays: Math.max(1, Math.round(patch.intervalDays)) } : {}),
      ...(patch.active !== undefined ? { active: patch.active } : {}),
      ...(patch.lastBoughtOn !== undefined ? { lastBoughtOn: patch.lastBoughtOn } : {}),
    })
    .where(eq(schema.householdItems.id, id));
}

export async function markBought(id: string, on = todayHelsinki()) {
  await updateHousehold(id, { lastBoughtOn: on });
}

export async function deleteHousehold(id: string) {
  const db = await getDb();
  await db.delete(schema.householdItems).where(eq(schema.householdItems.id, id));
}

export async function dueHousehold(today = todayHelsinki()): Promise<HouseholdRow[]> {
  return (await listHousehold()).filter((h) => isDue(h, today));
}
