"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-server";
import { addToPantry, removePantryItem, updatePantryItem } from "@/lib/services/pantry";
import { parseIngredientLine } from "@/lib/domain/ingredient-parser";

export async function addPantryAction(formData: FormData) {
  await requireAuth();
  const raw = String(formData.get("text") ?? "").trim();
  if (!raw) return;
  // Accept "2 dl kermaa" style input as well as a bare name.
  const p = parseIngredientLine(raw);
  await addToPantry({ name: p.name, quantity: p.quantity, unit: p.unit, note: String(formData.get("note") ?? "").trim() || null });
  revalidatePath("/pantry");
}

export async function updatePantryAction(formData: FormData) {
  await requireAuth();
  const q = String(formData.get("quantity") ?? "").replace(",", ".").trim();
  const quantity = q ? Number(q) : null;
  await updatePantryItem(String(formData.get("id")), {
    quantity: Number.isFinite(quantity) ? quantity : null,
    unit: String(formData.get("unit") ?? "").trim() || null,
    note: String(formData.get("note") ?? "").trim() || null,
  });
  revalidatePath("/pantry");
}

export async function usedUpAction(formData: FormData) {
  await requireAuth();
  await removePantryItem(String(formData.get("id")));
  revalidatePath("/pantry");
}
