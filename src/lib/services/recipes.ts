import "server-only";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { recipeDraftSchema, type RecipeDraft } from "../domain/recipe-draft";
import { rememberSynonyms } from "./vocab";

export type RecipeWithIngredients = typeof schema.recipes.$inferSelect & {
  ingredients: Array<typeof schema.recipeIngredients.$inferSelect>;
};

export async function listRecipes(opts: { q?: string; tag?: string } = {}) {
  const db = await getDb();
  const rows = await db.select().from(schema.recipes).orderBy(asc(schema.recipes.title));
  const q = opts.q?.trim().toLowerCase();
  return rows.filter(
    (r) =>
      (!q || r.title.toLowerCase().includes(q) || r.tags.some((t) => t.includes(q))) &&
      (!opts.tag || r.tags.includes(opts.tag.toLowerCase())),
  );
}

export async function allTags(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select({ tags: schema.recipes.tags }).from(schema.recipes);
  return [...new Set(rows.flatMap((r) => r.tags))].sort();
}

export async function getRecipes(ids: string[]): Promise<RecipeWithIngredients[]> {
  if (!ids.length) return [];
  const db = await getDb();
  const recipes = await db.select().from(schema.recipes).where(inArray(schema.recipes.id, ids));
  const ings = await db
    .select()
    .from(schema.recipeIngredients)
    .where(inArray(schema.recipeIngredients.recipeId, ids))
    .orderBy(asc(schema.recipeIngredients.position));
  return recipes.map((r) => ({ ...r, ingredients: ings.filter((i) => i.recipeId === r.id) }));
}

export async function getAllRecipesWithIngredients(): Promise<RecipeWithIngredients[]> {
  const db = await getDb();
  const recipes = await db.select().from(schema.recipes);
  const ings = await db.select().from(schema.recipeIngredients).orderBy(asc(schema.recipeIngredients.position));
  return recipes.map((r) => ({ ...r, ingredients: ings.filter((i) => i.recipeId === r.id) }));
}

export async function getRecipe(id: string) {
  const [r] = await getRecipes([id]);
  if (!r) return null;
  const db = await getDb();
  const originals = await db
    .select({ original: schema.originals })
    .from(schema.recipeOriginals)
    .innerJoin(schema.originals, eq(schema.originals.id, schema.recipeOriginals.originalId))
    .where(eq(schema.recipeOriginals.recipeId, id));
  const cooked = await db
    .select({ cookedAt: schema.plannedMeals.cookedAt })
    .from(schema.plannedMeals)
    .where(eq(schema.plannedMeals.recipeId, id))
    .orderBy(desc(schema.plannedMeals.cookedAt));
  return { ...r, originals: originals.map((o) => o.original), cookedDates: cooked.map((c) => c.cookedAt).filter(Boolean) as Date[] };
}

export function draftFromRecipe(r: RecipeWithIngredients, originalIds: string[] = []): RecipeDraft {
  return {
    title: r.title,
    sourceType: r.sourceType,
    sourceUrl: r.sourceUrl,
    sourceNote: r.sourceNote,
    servings: r.servings,
    prepMinutes: r.prepMinutes,
    cookMinutes: r.cookMinutes,
    tags: r.tags,
    ingredients: r.ingredients.map((i) => ({
      quantity: i.quantity,
      unit: i.unit,
      originalText: i.originalText,
      name: i.name,
      nameFi: i.nameFi,
      prepNote: i.prepNote,
      category: i.category,
      optional: i.optional,
    })),
    steps: r.steps,
    notes: r.notes,
    originalIds,
  };
}

/**
 * Create or update a recipe from a reviewed draft. Ingredients are replaced.
 * Name corrections you make in review are remembered as synonyms.
 */
export async function saveRecipe(input: RecipeDraft, existingId?: string): Promise<string> {
  const draft = recipeDraftSchema.parse(input);
  const db = await getDb();
  const values = {
    title: draft.title.trim(),
    sourceType: draft.sourceType,
    sourceUrl: draft.sourceUrl,
    sourceNote: draft.sourceNote,
    servings: draft.servings,
    prepMinutes: draft.prepMinutes,
    cookMinutes: draft.cookMinutes,
    tags: draft.tags,
    steps: draft.steps.filter((s) => s.trim()),
    notes: draft.notes,
    updatedAt: new Date(),
  };
  const id = await db.transaction(async (tx) => {
    let recipeId = existingId;
    if (recipeId) {
      await tx.update(schema.recipes).set(values).where(eq(schema.recipes.id, recipeId));
      await tx.delete(schema.recipeIngredients).where(eq(schema.recipeIngredients.recipeId, recipeId));
    } else {
      const [row] = await tx.insert(schema.recipes).values(values).returning({ id: schema.recipes.id });
      recipeId = row.id;
    }
    if (draft.ingredients.length) {
      await tx.insert(schema.recipeIngredients).values(
        draft.ingredients.map((i, position) => ({
          recipeId: recipeId!,
          position,
          quantity: i.quantity,
          unit: i.quantity == null ? null : i.unit,
          originalText: i.originalText || i.name,
          name: i.name,
          nameFi: i.nameFi.trim().toLowerCase(),
          prepNote: i.prepNote,
          category: i.category,
          optional: i.optional,
        })),
      );
    }
    if (draft.originalIds.length) {
      await tx
        .insert(schema.recipeOriginals)
        .values(draft.originalIds.map((originalId) => ({ recipeId: recipeId!, originalId })))
        .onConflictDoNothing();
      const originals = await tx.select().from(schema.originals).where(inArray(schema.originals.id, draft.originalIds));
      const firstImage = draft.originalIds.map((oid) => originals.find((o) => o.id === oid)).find((o) => o?.kind === "image");
      if (firstImage && !existingId) {
        await tx.update(schema.recipes).set({ imageOriginalId: firstImage.id }).where(eq(schema.recipes.id, recipeId!));
      }
    }
    return recipeId!;
  });
  await rememberSynonyms(
    draft.ingredients
      .filter((i) => i.name && i.nameFi && i.name.toLowerCase().trim() !== i.nameFi.toLowerCase().trim())
      .map((i) => ({ term: i.name, nameFi: i.nameFi.toLowerCase().trim(), category: i.category })),
    "user",
  );
  return id;
}

export async function deleteRecipe(id: string) {
  const db = await getDb();
  await db.delete(schema.recipes).where(eq(schema.recipes.id, id));
}
