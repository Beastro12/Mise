import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { StoreId } from "@/db/schema";
import { resolveSectionOrder } from "../domain/sections";

export async function listStores() {
  const db = await getDb();
  return db.select().from(schema.stores).orderBy(asc(schema.stores.id));
}

export async function updateSMarket(name: string, externalId: string | null) {
  const db = await getDb();
  await db
    .update(schema.stores)
    .set({ name: name.trim() || "S-market", externalId: externalId?.trim() || null })
    .where(eq(schema.stores.id, "smarket"));
}

export async function getSectionOrder(storeId: StoreId) {
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.storeSections)
    .where(eq(schema.storeSections.storeId, storeId))
    .orderBy(asc(schema.storeSections.position));
  return resolveSectionOrder(rows.map((r) => r.sectionKey));
}

export async function setSectionOrder(storeId: StoreId, order: string[]) {
  const resolved = resolveSectionOrder(order);
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.delete(schema.storeSections).where(eq(schema.storeSections.storeId, storeId));
    await tx.insert(schema.storeSections).values(resolved.map((sectionKey, position) => ({ storeId, sectionKey, position })));
  });
}

export async function moveSection(storeId: StoreId, sectionKey: string, dir: -1 | 1) {
  const order = await getSectionOrder(storeId);
  const i = order.indexOf(sectionKey as (typeof order)[number]);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  [order[i], order[j]] = [order[j], order[i]];
  await setSectionOrder(storeId, order);
}

export async function listStaples() {
  const db = await getDb();
  return (await db.select().from(schema.staples).orderBy(asc(schema.staples.nameFi))).map((r) => r.nameFi);
}

export async function addStaple(nameFi: string) {
  const n = nameFi.trim().toLowerCase();
  if (!n) return;
  const db = await getDb();
  await db.insert(schema.staples).values({ nameFi: n }).onConflictDoNothing();
}

export async function removeStaple(nameFi: string) {
  const db = await getDb();
  await db.delete(schema.staples).where(eq(schema.staples.nameFi, nameFi));
}

export async function listRules() {
  const db = await getDb();
  return db.select().from(schema.storeRules).orderBy(asc(schema.storeRules.nameFi));
}

export async function setRule(nameFi: string, storeId: StoreId) {
  const db = await getDb();
  await db
    .insert(schema.storeRules)
    .values({ nameFi: nameFi.trim().toLowerCase(), storeId })
    .onConflictDoUpdate({ target: schema.storeRules.nameFi, set: { storeId } });
}

export async function removeRule(nameFi: string) {
  const db = await getDb();
  await db.delete(schema.storeRules).where(and(eq(schema.storeRules.nameFi, nameFi)));
}
