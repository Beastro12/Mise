import { sql } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { SEED_RECIPES } from "./seed-recipes";
import { SEED_STAPLES, seedSynonymPairs } from "../lib/domain/vocabulary";
import { SECTION_KEYS } from "../lib/domain/sections";
import { buildSynonymIndex } from "../lib/domain/normalize";
import { draftsFromLines } from "../lib/domain/recipe-draft";

type AnyDb = PgDatabase<PgQueryResultHKT, typeof schema>;

export const DEFAULT_SMARKET_NAME = "S-market (set your store in Settings)";

/**
 * Idempotent: seeds reference data only when the stores table is empty,
 * and seed recipes only when there are no recipes yet.
 */
export async function seedDatabase(db: AnyDb): Promise<{ seeded: boolean }> {
  const existing = await db.select({ id: schema.stores.id }).from(schema.stores).limit(1);
  if (existing.length) return { seeded: false };

  await db.transaction(async (tx) => {
    await tx
      .insert(schema.stores)
      .values([
        {
          id: "smarket",
          name: process.env.S_MARKET_STORE || DEFAULT_SMARKET_NAME,
          chain: "S Group",
          externalId: process.env.S_KAUPAT_STORE_ID || null,
          address: null,
        },
        {
          id: "lidl",
          name: "Lidl Vähäheikkilä",
          chain: "Lidl",
          externalId: null,
          address: "Vähäheikkiläntie 58, 20810 Turku",
        },
      ])
      .onConflictDoNothing();

    for (const storeId of ["smarket", "lidl"] as const) {
      await tx
        .insert(schema.storeSections)
        .values(SECTION_KEYS.map((sectionKey, position) => ({ storeId, sectionKey, position })))
        .onConflictDoNothing();
    }

    const pairs = seedSynonymPairs();
    for (let i = 0; i < pairs.length; i += 200) {
      await tx
        .insert(schema.synonyms)
        .values(pairs.slice(i, i + 200).map((p) => ({ ...p, source: "seed" as const })))
        .onConflictDoNothing();
    }

    await tx
      .insert(schema.staples)
      .values(SEED_STAPLES.map((nameFi) => ({ nameFi })))
      .onConflictDoNothing();

    const recipeCount = await tx.select({ n: sql<number>`count(*)::int` }).from(schema.recipes);
    if (recipeCount[0].n === 0) {
      const index = buildSynonymIndex(pairs);
      for (const r of SEED_RECIPES) {
        const [row] = await tx
          .insert(schema.recipes)
          .values({
            title: r.title,
            sourceType: "seed",
            sourceNote: "Seed recipe",
            servings: r.servings,
            prepMinutes: r.prepMinutes,
            cookMinutes: r.cookMinutes,
            tags: r.tags,
            steps: r.steps,
            notes: r.notes,
          })
          .returning({ id: schema.recipes.id });
        const drafts = draftsFromLines(r.ingredients, index);
        await tx.insert(schema.recipeIngredients).values(
          drafts.map((d, position) => ({
            recipeId: row.id,
            position,
            quantity: d.quantity,
            unit: d.unit,
            originalText: d.originalText,
            name: d.name,
            nameFi: d.nameFi,
            prepNote: d.prepNote,
            category: d.category,
            optional: d.optional,
          })),
        );
      }
    }
  });
  return { seeded: true };
}
