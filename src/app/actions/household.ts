"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-server";
import { addHousehold, deleteHousehold, markBought, updateHousehold } from "@/lib/services/household";
import { parseIngredientLine } from "@/lib/domain/ingredient-parser";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function addHouseholdAction(formData: FormData) {
  await requireAuth();
  const text = str(formData, "text");
  if (!text) return;
  const p = parseIngredientLine(text);
  await addHousehold({
    name: str(formData, "name") || p.name.charAt(0).toUpperCase() + p.name.slice(1),
    nameFi: str(formData, "nameFi") || undefined,
    intervalDays: parseInt(str(formData, "interval"), 10) || 14,
    quantity: p.quantity,
    unit: p.unit,
  });
  revalidatePath("/household");
}

export async function updateHouseholdAction(formData: FormData) {
  await requireAuth();
  const interval = parseInt(str(formData, "interval"), 10);
  await updateHousehold(str(formData, "id"), { ...(interval > 0 ? { intervalDays: interval } : {}) });
  revalidatePath("/household");
}

export async function boughtTodayAction(formData: FormData) {
  await requireAuth();
  await markBought(str(formData, "id"));
  revalidatePath("/household");
}

export async function toggleHouseholdAction(formData: FormData) {
  await requireAuth();
  await updateHousehold(str(formData, "id"), { active: str(formData, "active") === "1" });
  revalidatePath("/household");
}

export async function deleteHouseholdAction(formData: FormData) {
  await requireAuth();
  await deleteHousehold(str(formData, "id"));
  revalidatePath("/household");
}
