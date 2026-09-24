import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, gt, ilike, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { StoreId } from "@/db/schema";
import { getSKaupatAdapter, limiterFor } from "../stores";
import type { StoreProduct } from "../stores/types";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type ProductRow = typeof schema.products.$inferSelect;

async function upsertProducts(items: StoreProduct[]): Promise<ProductRow[]> {
  if (!items.length) return [];
  const db = await getDb();
  const rows: ProductRow[] = [];
  for (const p of items) {
    const [row] = await db
      .insert(schema.products)
      .values({ ...p, raw: p.raw ?? null, fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: [schema.products.storeId, schema.products.source, schema.products.externalId],
        set: {
          ean: p.ean,
          name: p.name,
          brand: p.brand,
          packSize: p.packSize,
          packUnit: p.packUnit,
          price: p.price,
          unitPrice: p.unitPrice,
          unitPriceUnit: p.unitPriceUnit,
          storeExternalId: p.storeExternalId,
          raw: p.raw ?? null,
          fetchedAt: new Date(),
        },
      })
      .returning();
    rows.push(row);
  }
  return rows;
}

export type SearchResult = { products: ProductRow[]; adapter: { id: string; status: string; description: string }; error: string | null; cached: boolean };

/**
 * Search S-market products: adapter results (cached 24 h, rate limited) plus
 * manually entered products. Never throws; on adapter failure returns what is
 * cached with an error message.
 */
export async function searchSMarketProducts(query: string): Promise<SearchResult> {
  const adapter = getSKaupatAdapter();
  const q = query.trim().toLowerCase();
  const db = await getDb();
  const info = { id: adapter.id, status: adapter.status, description: adapter.description };

  const manual = await db
    .select()
    .from(schema.products)
    .where(and(eq(schema.products.storeId, "smarket"), eq(schema.products.source, "manual"), ilike(schema.products.name, `%${q}%`)))
    .limit(10);

  if (adapter.status === "OFF" || !q) return { products: manual, adapter: info, error: null, cached: false };

  const [cache] = await db
    .select()
    .from(schema.productSearchCache)
    .where(
      and(
        eq(schema.productSearchCache.storeId, "smarket"),
        eq(schema.productSearchCache.adapter, adapter.id),
        eq(schema.productSearchCache.query, q),
      ),
    );
  const fromCache = async () => {
    if (!cache?.productIds.length) return [];
    const rows = await db.select().from(schema.products).where(inArray(schema.products.id, cache.productIds));
    return cache.productIds.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as ProductRow[];
  };

  if (cache && Date.now() - cache.fetchedAt.getTime() < CACHE_TTL_MS) {
    return { products: [...manual, ...(await fromCache())], adapter: info, error: null, cached: true };
  }

  try {
    await limiterFor(adapter.id).acquire();
    const found = await adapter.searchProducts(q);
    const rows = await upsertProducts(found);
    await db
      .insert(schema.productSearchCache)
      .values({ storeId: "smarket", adapter: adapter.id, query: q, productIds: rows.map((r) => r.id), fetchedAt: new Date() })
      .onConflictDoUpdate({
        target: [schema.productSearchCache.storeId, schema.productSearchCache.adapter, schema.productSearchCache.query],
        set: { productIds: rows.map((r) => r.id), fetchedAt: new Date() },
      });
    return { products: [...manual, ...rows], adapter: info, error: null, cached: false };
  } catch (e) {
    console.warn("[products] adapter search failed:", (e as Error).message);
    return { products: [...manual, ...(await fromCache())], adapter: info, error: (e as Error).message, cached: true };
  }
}

export async function createManualProduct(input: {
  externalId?: string | null;
  ean?: string | null;
  name: string;
  brand?: string | null;
  packSize?: number | null;
  packUnit?: string | null;
  price?: number | null;
  unitPrice?: number | null;
  unitPriceUnit?: string | null;
}): Promise<ProductRow> {
  const db = await getDb();
  const [store] = await db.select().from(schema.stores).where(eq(schema.stores.id, "smarket"));
  const [row] = await upsertProducts([
    {
      storeId: "smarket",
      source: "manual",
      externalId: input.externalId?.trim() || `manual-${randomUUID()}`,
      ean: input.ean?.trim() || null,
      name: input.name.trim(),
      brand: input.brand?.trim() || null,
      packSize: input.packSize ?? null,
      packUnit: input.packUnit ?? null,
      price: input.price ?? null,
      unitPrice: input.unitPrice ?? null,
      unitPriceUnit: input.unitPriceUnit ?? null,
      storeExternalId: store?.externalId ?? null,
    },
  ]);
  return row;
}

export async function getMapping(nameFi: string, storeId: StoreId) {
  const db = await getDb();
  const [row] = await db
    .select({ map: schema.ingredientProductMap, product: schema.products })
    .from(schema.ingredientProductMap)
    .innerJoin(schema.products, eq(schema.products.id, schema.ingredientProductMap.productId))
    .where(and(eq(schema.ingredientProductMap.nameFi, nameFi), eq(schema.ingredientProductMap.storeId, storeId)));
  return row ?? null;
}

export async function listMappings() {
  const db = await getDb();
  return db
    .select({ map: schema.ingredientProductMap, product: schema.products })
    .from(schema.ingredientProductMap)
    .innerJoin(schema.products, eq(schema.products.id, schema.ingredientProductMap.productId));
}

export async function setMapping(nameFi: string, storeId: StoreId, productId: string) {
  const db = await getDb();
  await db
    .insert(schema.ingredientProductMap)
    .values({ nameFi, storeId, productId })
    .onConflictDoUpdate({
      target: [schema.ingredientProductMap.nameFi, schema.ingredientProductMap.storeId],
      set: { productId, updatedAt: new Date() },
    });
}

export async function clearMapping(nameFi: string, storeId: StoreId) {
  const db = await getDb();
  await db
    .delete(schema.ingredientProductMap)
    .where(and(eq(schema.ingredientProductMap.nameFi, nameFi), eq(schema.ingredientProductMap.storeId, storeId)));
}

/** Refresh stale mapped products (older than 24 h) from the adapter. Failures are ignored. */
export async function refreshMappedProducts(productIds: string[]) {
  const adapter = getSKaupatAdapter();
  if (adapter.status === "OFF" || !productIds.length) return;
  const db = await getDb();
  const stale = await db
    .select()
    .from(schema.products)
    .where(
      and(
        inArray(schema.products.id, productIds),
        eq(schema.products.source, adapter.status === "MOCK" ? "mock" : "s-kaupat"),
        gt(sql`now() - ${schema.products.fetchedAt}`, sql`interval '24 hours'`),
      ),
    );
  for (const p of stale.slice(0, 20)) {
    try {
      await limiterFor(adapter.id).acquire();
      const fresh = await adapter.getProduct(p.externalId);
      if (fresh) await upsertProducts([fresh]);
    } catch (e) {
      console.warn("[products] refresh failed:", (e as Error).message);
      return;
    }
  }
}
