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

/** Add a refill, or update the existing one for the same ingredient (one per ingredient). */
export async function addHousehold(input: { name: string; nameFi?: string; intervalDays: number; quantity: number | null; unit: string | null }) {
  const name = input.name.trim();
  if (!name) throw new Error("Name is required.");
  const given = input.nameFi?.trim().toLowerCase();
  const n = (await normalizeMany([given || name])).get(given || name)!;
  const nameFi = given || n.nameFi;
  const values = {
    name,
    nameFi,
    intervalDays: Math.max(1, Math.round(input.intervalDays || 14)),
    quantity: input.quantity,
    unit: input.quantity == null ? null : (input.unit ?? "kpl"),
    section: toSectionKey(n.category),
  };
  const db = await getDb();
  const [existing] = await db.select().from(schema.householdItems).where(eq(schema.householdItems.nameFi, nameFi));
  if (existing) {
    await db.update(schema.householdItems).set({ ...values, active: true }).where(eq(schema.householdItems.id, existing.id));
  } else {
    await db.insert(schema.householdItems).values(values);
  }
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

/** Undo a "bought today" (an item checked off by mistake): back to due. */
export async function unmarkBoughtToday(id: string, today = todayHelsinki()) {
  const db = await getDb();
  const [row] = await db.select().from(schema.householdItems).where(eq(schema.householdItems.id, id));
  if (row?.lastBoughtOn === today) await updateHousehold(id, { lastBoughtOn: null });
}

export async function deleteHousehold(id: string) {
  const db = await getDb();
  await db.delete(schema.householdItems).where(eq(schema.householdItems.id, id));
}

export async function dueHousehold(today = todayHelsinki()): Promise<HouseholdRow[]> {
  return (await listHousehold()).filter((h) => isDue(h, today));
}
