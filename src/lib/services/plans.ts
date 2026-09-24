import "server-only";
import { and, asc, desc, eq, gte, isNotNull, lt, ne, or } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { ProposeParams } from "@/db/schema";
import { proposeWeek, swapSlot, type ProposeContext, type Slot } from "../domain/propose";
import { addDays, isActive, mondayOf, todayHelsinki } from "../domain/offers";
import { getAllRecipesWithIngredients } from "./recipes";
import { getStaples } from "./vocab";
import { listCurrentOffers } from "./offers";

export async function listPlans() {
  const db = await getDb();
  return db.select().from(schema.mealPlans).orderBy(desc(schema.mealPlans.weekStart), desc(schema.mealPlans.createdAt));
}

export async function getPlan(id: string) {
  const db = await getDb();
  const [plan] = await db.select().from(schema.mealPlans).where(eq(schema.mealPlans.id, id));
  if (!plan) return null;
  const meals = await db
    .select({ meal: schema.plannedMeals, recipe: schema.recipes })
    .from(schema.plannedMeals)
    .innerJoin(schema.recipes, eq(schema.recipes.id, schema.plannedMeals.recipeId))
    .where(eq(schema.plannedMeals.planId, id))
    .orderBy(asc(schema.plannedMeals.position));
  const [list] = await db.select().from(schema.shoppingLists).where(eq(schema.shoppingLists.planId, id));
  return { plan, meals, list: list ?? null };
}

export async function createPlan(input: { weekStart?: string; defaultServings?: number; name?: string }) {
  const db = await getDb();
  const weekStart = mondayOf(input.weekStart || todayHelsinki());
  const [row] = await db
    .insert(schema.mealPlans)
    .values({ weekStart, defaultServings: input.defaultServings ?? 2, name: input.name || null })
    .returning();
  return row;
}

export async function updatePlan(id: string, patch: { defaultServings?: number; weekStart?: string; name?: string | null }) {
  const db = await getDb();
  await db
    .update(schema.mealPlans)
    .set({
      ...(patch.defaultServings ? { defaultServings: patch.defaultServings } : {}),
      ...(patch.weekStart ? { weekStart: mondayOf(patch.weekStart) } : {}),
      ...(patch.name !== undefined ? { name: patch.name } : {}),
    })
    .where(eq(schema.mealPlans.id, id));
}

export async function deletePlan(id: string) {
  const db = await getDb();
  await db.delete(schema.mealPlans).where(eq(schema.mealPlans.id, id));
}

async function nextPosition(planId: string) {
  const db = await getDb();
  const rows = await db.select({ p: schema.plannedMeals.position }).from(schema.plannedMeals).where(eq(schema.plannedMeals.planId, planId));
  return rows.length ? Math.max(...rows.map((r) => r.p)) + 1 : 0;
}

export async function addMeal(planId: string, recipeId: string, servings?: number) {
  const db = await getDb();
  const [plan] = await db.select().from(schema.mealPlans).where(eq(schema.mealPlans.id, planId));
  if (!plan) throw new Error("Plan not found");
  const position = await nextPosition(planId);
  await db.insert(schema.plannedMeals).values({
    planId,
    recipeId,
    servings: servings ?? plan.defaultServings,
    position,
    day: addDays(plan.weekStart, position % 7),
  });
}

export async function updateMeal(mealId: string, patch: { servings?: number; day?: string | null; locked?: boolean }) {
  const db = await getDb();
  await db
    .update(schema.plannedMeals)
    .set({
      ...(patch.servings ? { servings: patch.servings } : {}),
      ...(patch.day !== undefined ? { day: patch.day } : {}),
      ...(patch.locked !== undefined ? { locked: patch.locked } : {}),
    })
    .where(eq(schema.plannedMeals.id, mealId));
}

export async function removeMeal(mealId: string) {
  const db = await getDb();
  await db.delete(schema.plannedMeals).where(eq(schema.plannedMeals.id, mealId));
}

export async function setCooked(mealId: string, cooked: boolean) {
  const db = await getDb();
  await db.update(schema.plannedMeals).set({ cookedAt: cooked ? new Date() : null }).where(eq(schema.plannedMeals.id, mealId));
}

export async function cookHistory(limit = 100) {
  const db = await getDb();
  return db
    .select({ meal: schema.plannedMeals, recipe: schema.recipes })
    .from(schema.plannedMeals)
    .innerJoin(schema.recipes, eq(schema.recipes.id, schema.plannedMeals.recipeId))
    .where(isNotNull(schema.plannedMeals.cookedAt))
    .orderBy(desc(schema.plannedMeals.cookedAt))
    .limit(limit);
}

/** Build the propose context from the catalogue, recent history, pantry and offers. */
async function buildContext(planId: string, weekStart: string, params: ProposeParams): Promise<ProposeContext> {
  const db = await getDb();
  const recipes = await getAllRecipesWithIngredients();
  const twoWeeksAgo = addDays(weekStart, -14);
  const since = new Date(`${twoWeeksAgo}T00:00:00Z`);
  const recent = await db
    .select({ recipeId: schema.plannedMeals.recipeId })
    .from(schema.plannedMeals)
    .where(
      and(
        ne(schema.plannedMeals.planId, planId),
        or(
          and(gte(schema.plannedMeals.day, twoWeeksAgo), lt(schema.plannedMeals.day, weekStart)),
          gte(schema.plannedMeals.cookedAt, since),
        ),
      ),
    );
  const pantry = await db.select({ nameFi: schema.pantryItems.nameFi }).from(schema.pantryItems);
  const offers = await listCurrentOffers();
  // Offers that are valid during the planned week (not only today).
  const weekOffers = offers.filter((o) => [0, 1, 2, 3, 4, 5, 6].some((d) => isActive(o, addDays(weekStart, d))));
  return {
    recipes: recipes.map((r) => ({
      id: r.id,
      title: r.title,
      tags: r.tags,
      totalMinutes: r.prepMinutes != null || r.cookMinutes != null ? (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) : null,
      ingredients: r.ingredients.map((i) => ({ nameFi: i.nameFi, section: i.category })),
    })),
    recentRecipeIds: new Set(recent.map((r) => r.recipeId)),
    pantry: new Set(pantry.map((p) => p.nameFi)),
    staples: await getStaples(),
    offerNames: new Set(weekOffers.map((o) => o.nameFi)),
    params,
    weekStart,
  };
}

/** Propose: keep locked meals (by slot), replace the rest. */
export async function proposeForPlan(planId: string, params: ProposeParams) {
  const db = await getDb();
  const data = await getPlan(planId);
  if (!data) throw new Error("Plan not found");
  const ctx = await buildContext(planId, data.plan.weekStart, params);
  const locked = data.meals.filter((m) => m.meal.locked).map((m) => ({ slot: m.meal.position, recipeId: m.recipe.id }));
  const slots = proposeWeek(ctx, locked);
  await db.transaction(async (tx) => {
    await tx.delete(schema.plannedMeals).where(and(eq(schema.plannedMeals.planId, planId), eq(schema.plannedMeals.locked, false)));
    // Locked meals beyond the requested count stay; locked meals get their slot's day.
    const rows = slots
      .filter((s) => s.recipeId && !s.locked)
      .map((s) => ({
        planId,
        recipeId: s.recipeId!,
        servings: data.plan.defaultServings,
        position: s.slot,
        day: s.day,
        reason: s.reason,
      }));
    if (rows.length) await tx.insert(schema.plannedMeals).values(rows);
    await tx.update(schema.mealPlans).set({ mode: "propose", proposeParams: params }).where(eq(schema.mealPlans.id, planId));
  });
  return slots;
}

/** "Give me another" for one meal. */
export async function swapMeal(planId: string, mealId: string) {
  const db = await getDb();
  const data = await getPlan(planId);
  if (!data) throw new Error("Plan not found");
  const target = data.meals.find((m) => m.meal.id === mealId);
  if (!target) throw new Error("Meal not found");
  const params: ProposeParams = data.plan.proposeParams ?? {
    meals: data.meals.length,
    weekdayMaxMinutes: null,
    includeTags: [],
    excludeTags: [],
    seed: 1,
  };
  const seed = Math.floor(Math.random() * 1e9);
  const ctx = await buildContext(planId, data.plan.weekStart, { ...params, seed });
  const current: Slot[] = data.meals.map((m) => ({
    slot: m.meal.position,
    day: m.meal.day ?? addDays(data.plan.weekStart, m.meal.position % 7),
    recipeId: m.recipe.id,
    reason: m.meal.reason ?? "",
    locked: m.meal.locked,
  }));
  const next = swapSlot(ctx, current, target.meal.position, seed);
  if (next.recipeId && next.recipeId !== target.recipe.id) {
    await db.update(schema.plannedMeals).set({ recipeId: next.recipeId, reason: next.reason }).where(eq(schema.plannedMeals.id, mealId));
    return true;
  }
  return false;
}
