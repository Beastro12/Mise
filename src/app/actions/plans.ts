"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth-server";
import {
  addMeal,
  createPlan,
  deletePlan,
  proposeForPlan,
  removeMeal,
  setCooked,
  swapMeal,
  updateMeal,
  updatePlan,
} from "@/lib/services/plans";
import { generateListForPlan } from "@/lib/services/lists";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const int = (f: FormData, k: string, d: number) => {
  const n = parseInt(str(f, k), 10);
  return Number.isFinite(n) && n > 0 ? n : d;
};
const tags = (s: string) =>
  s
    .split(",")
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

export async function createPlanAction(formData: FormData) {
  await requireAuth();
  const plan = await createPlan({ weekStart: str(formData, "weekStart") || undefined, defaultServings: int(formData, "servings", 2) });
  redirect(`/plan/${plan.id}`);
}

export async function updatePlanAction(formData: FormData) {
  await requireAuth();
  const id = str(formData, "planId");
  await updatePlan(id, { defaultServings: int(formData, "servings", 2), weekStart: str(formData, "weekStart") || undefined });
  revalidatePath(`/plan/${id}`);
}

export async function deletePlanAction(formData: FormData) {
  await requireAuth();
  await deletePlan(str(formData, "planId"));
  redirect("/plan");
}

export async function addMealAction(formData: FormData) {
  await requireAuth();
  const planId = str(formData, "planId");
  const servings = parseInt(str(formData, "servings"), 10);
  await addMeal(planId, str(formData, "recipeId"), Number.isFinite(servings) && servings > 0 ? servings : undefined);
  revalidatePath(`/plan/${planId}`);
}

export async function updateMealAction(formData: FormData) {
  await requireAuth();
  const planId = str(formData, "planId");
  const servings = parseInt(str(formData, "servings"), 10);
  const day = str(formData, "day");
  await updateMeal(str(formData, "mealId"), {
    ...(Number.isFinite(servings) && servings > 0 ? { servings } : {}),
    ...(formData.has("day") ? { day: day || null } : {}),
  });
  revalidatePath(`/plan/${planId}`);
}

export async function toggleLockAction(formData: FormData) {
  await requireAuth();
  const planId = str(formData, "planId");
  await updateMeal(str(formData, "mealId"), { locked: str(formData, "locked") === "1" });
  revalidatePath(`/plan/${planId}`);
}

export async function removeMealAction(formData: FormData) {
  await requireAuth();
  const planId = str(formData, "planId");
  await removeMeal(str(formData, "mealId"));
  revalidatePath(`/plan/${planId}`);
}

export async function cookedAction(formData: FormData) {
  await requireAuth();
  const planId = str(formData, "planId");
  await setCooked(str(formData, "mealId"), str(formData, "cooked") === "1");
  revalidatePath(`/plan/${planId}`);
  revalidatePath("/");
}

export async function proposeAction(formData: FormData) {
  await requireAuth();
  const planId = str(formData, "planId");
  const max = parseInt(str(formData, "weekdayMax"), 10);
  await proposeForPlan(planId, {
    meals: int(formData, "meals", 5),
    weekdayMaxMinutes: Number.isFinite(max) && max > 0 ? max : null,
    includeTags: tags(str(formData, "include")),
    excludeTags: tags(str(formData, "exclude")),
    seed: Math.floor(Math.random() * 1e9),
  });
  revalidatePath(`/plan/${planId}`);
}

export async function swapAction(formData: FormData) {
  await requireAuth();
  const planId = str(formData, "planId");
  await swapMeal(planId, str(formData, "mealId"));
  revalidatePath(`/plan/${planId}`);
}

export async function generateListAction(formData: FormData) {
  await requireAuth();
  const listId = await generateListForPlan(str(formData, "planId"));
  redirect(`/list/${listId}`);
}
