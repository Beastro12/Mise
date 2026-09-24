import "server-only";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { convert, round } from "../domain/units";
import { normalizeMany } from "./vocab";

export async function listPantry() {
  const db = await getDb();
  return db.select().from(schema.pantryItems).orderBy(asc(schema.pantryItems.category), asc(schema.pantryItems.displayName));
}

type AddInput = {
  name: string;
  nameFi?: string;
  quantity?: number | null;
  unit?: string | null;
  note?: string | null;
  category?: string | null;
};

/**
 * Add to the pantry. If the item exists with a compatible unit the quantities
 * are summed; otherwise the new quantity replaces the old one.
 */
export async function addToPantry(input: AddInput) {
  const db = await getDb();
  let nameFi = input.nameFi?.trim().toLowerCase();
  let category = input.category ?? null;
  if (!nameFi) {
    const n = (await normalizeMany([input.name])).get(input.name)!;
    nameFi = n.nameFi;
    category = category ?? n.category;
  }
  const [existing] = await db.select().from(schema.pantryItems).where(eq(schema.pantryItems.nameFi, nameFi));
  const qty = input.quantity ?? null;
  const unit = qty == null ? null : (input.unit ?? null);
  if (existing) {
    let quantity = qty;
    let newUnit = unit;
    if (qty != null && existing.quantity != null) {
      const inExisting = convert(qty, unit, existing.unit);
      if (inExisting != null) {
        quantity = round(existing.quantity + inExisting, 2);
        newUnit = existing.unit;
      }
    } else if (qty == null) {
      quantity = existing.quantity;
      newUnit = existing.unit;
    }
    await db
      .update(schema.pantryItems)
      .set({ quantity, unit: newUnit, note: input.note ?? existing.note, updatedAt: new Date() })
      .where(eq(schema.pantryItems.id, existing.id));
    return existing.id;
  }
  const [row] = await db
    .insert(schema.pantryItems)
    .values({
      nameFi,
      displayName: input.name.trim() || nameFi,
      quantity: qty,
      unit,
      note: input.note ?? null,
      category: category ?? "muut",
    })
    .returning({ id: schema.pantryItems.id });
  return row.id;
}

export async function updatePantryItem(id: string, patch: { quantity: number | null; unit: string | null; note: string | null }) {
  const db = await getDb();
  await db
    .update(schema.pantryItems)
    .set({ quantity: patch.quantity, unit: patch.quantity == null ? null : patch.unit, note: patch.note, updatedAt: new Date() })
    .where(eq(schema.pantryItems.id, id));
}

/** "Used up": remove from pantry. */
export async function removePantryItem(id: string) {
  const db = await getDb();
  await db.delete(schema.pantryItems).where(eq(schema.pantryItems.id, id));
}
