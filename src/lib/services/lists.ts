import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "@/db";
import type { StoreId } from "@/db/schema";
import { buildShoppingList, type ProductInfo } from "../domain/list-builder";
import { todayHelsinki } from "../domain/offers";
import { toSectionKey } from "../domain/sections";
import { packsNeeded } from "../domain/packs";
import { getPlan } from "./plans";
import { getRecipes } from "./recipes";
import { getStaples, normalizeMany } from "./vocab";
import { listCurrentOffers, toOfferInfo } from "./offers";
import { addToPantry } from "./pantry";
import { refreshMappedProducts } from "./products";
import { dueHousehold, markBought } from "./household";

export type ItemRow = typeof schema.shoppingItems.$inferSelect;
export type ListRow = typeof schema.shoppingLists.$inferSelect;

function newToken() {
  return randomBytes(18).toString("base64url");
}

async function bump(listId: string) {
  const db = await getDb();
  await db
    .update(schema.shoppingLists)
    .set({ version: sql`${schema.shoppingLists.version} + 1`, updatedAt: new Date() })
    .where(eq(schema.shoppingLists.id, listId));
}

export async function listLists() {
  const db = await getDb();
  return db.select().from(schema.shoppingLists).orderBy(desc(schema.shoppingLists.updatedAt));
}

async function loadMappings(): Promise<Map<string, Partial<Record<StoreId, ProductInfo>>>> {
  const db = await getDb();
  const rows = await db
    .select({ map: schema.ingredientProductMap, product: schema.products })
    .from(schema.ingredientProductMap)
    .innerJoin(schema.products, eq(schema.products.id, schema.ingredientProductMap.productId));
  await refreshMappedProducts(rows.map((r) => r.product.id)).catch(() => undefined);
  const out = new Map<string, Partial<Record<StoreId, ProductInfo>>>();
  for (const { map, product } of rows) {
    const m = out.get(map.nameFi) ?? {};
    m[map.storeId] = {
      id: product.id,
      price: product.price,
      unitPrice: product.unitPrice,
      unitPriceUnit: product.unitPriceUnit,
      packSize: product.packSize,
      packUnit: product.packUnit,
    };
    out.set(map.nameFi, m);
  }
  return out;
}

/**
 * Generate (or regenerate) the shopping list for a plan. On regeneration,
 * manual items, check-offs, "have it?" answers and manual store choices are kept.
 */
export async function generateListForPlan(planId: string): Promise<string> {
  const db = await getDb();
  const data = await getPlan(planId);
  if (!data) throw new Error("Plan not found");
  const recipes = await getRecipes([...new Set(data.meals.map((m) => m.recipe.id))]);
  const byId = new Map(recipes.map((r) => [r.id, r]));
  const meals = data.meals
    .filter((m) => !m.meal.cookedAt)
    .map((m) => {
      const r = byId.get(m.recipe.id)!;
      return {
        recipeId: r.id,
        title: r.title,
        recipeServings: r.servings,
        servings: m.meal.servings,
        ingredients: r.ingredients.map((i) => ({
          nameFi: i.nameFi,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          category: i.category,
          optional: i.optional,
        })),
      };
    });

  const today = todayHelsinki();
  const [pantry, staples, offers, rules, mappings, due] = await Promise.all([
    db.select().from(schema.pantryItems),
    getStaples(),
    listCurrentOffers(today),
    db.select().from(schema.storeRules),
    loadMappings(),
    dueHousehold(today),
  ]);

  let list = data.list;
  const previous = list ? await db.select().from(schema.shoppingItems).where(eq(schema.shoppingItems.listId, list.id)) : [];
  const overrides = new Map(previous.filter((p) => p.storeOverridden && !p.manual).map((p) => [p.nameFi, p.storeId]));

  const built = buildShoppingList({
    meals,
    pantry: pantry.map((p) => ({ nameFi: p.nameFi, quantity: p.quantity, unit: p.unit, note: p.note })),
    staples,
    offers: offers.map(toOfferInfo),
    rules: new Map(rules.map((r) => [r.nameFi, r.storeId])),
    mappings,
    overrides,
    today,
  });

  await db.transaction(async (tx) => {
    if (!list) {
      const [created] = await tx
        .insert(schema.shoppingLists)
        .values({ planId, name: data.plan.name || `Week of ${Number(data.plan.weekStart.slice(8, 10))}.${Number(data.plan.weekStart.slice(5, 7))}.`, shareToken: newToken() })
        .returning();
      list = created;
    }
    await tx.delete(schema.shoppingItems).where(and(eq(schema.shoppingItems.listId, list.id), eq(schema.shoppingItems.manual, false)));
    const prevByKey = new Map(previous.filter((p) => !p.manual).map((p) => [`${p.nameFi}|${p.unit ?? ""}`, p]));
    const prevByName = new Map(previous.filter((p) => !p.manual).map((p) => [p.nameFi, p]));
    if (built.length) {
      await tx.insert(schema.shoppingItems).values(
        built.map((b) => {
          const prev = prevByKey.get(`${b.nameFi}|${b.unit ?? ""}`);
          const prevAnswer = prevByName.get(b.nameFi);
          // Keep "have it"/"need it" answers for staples across regenerations.
          let state = b.state as ItemRow["state"];
          if (b.state === "ask" && prevAnswer && (prevAnswer.state === "have" || (prevAnswer.state === "none" && staples.has(b.nameFi)))) {
            state = prevAnswer.state;
          }
          return {
            listId: list!.id,
            nameFi: b.nameFi,
            displayName: b.displayName,
            quantity: b.quantity,
            unit: b.unit,
            section: b.section,
            storeId: b.storeId,
            storeReason: b.storeReason,
            storeOverridden: b.storeOverridden,
            productId: b.productId,
            packs: b.packs,
            price: b.price,
            offerId: b.offerId,
            sources: b.sources,
            state,
            note: b.note,
            checked: prev?.checked ?? false,
            checkedAt: prev?.checkedAt ?? null,
            movedToPantry: prev?.movedToPantry ?? false,
          };
        }),
      );
    }
    // Household refills due before the next shop: suggested, you decide per item.
    const inList = new Set(built.filter((b) => b.state === "none").map((b) => b.nameFi));
    const prevRefill = new Map(previous.filter((p) => p.householdItemId).map((p) => [p.householdItemId!, p]));
    const refills = due.filter((h) => !inList.has(h.nameFi));
    if (refills.length) {
      const ruleOf = new Map(rules.map((r) => [r.nameFi, r.storeId]));
      await tx.insert(schema.shoppingItems).values(
        refills.map((h) => {
          const prev = prevRefill.get(h.id);
          const storeId = ruleOf.get(h.nameFi) ?? "smarket";
          const product = mappings.get(h.nameFi)?.[storeId] ?? null;
          return {
            listId: list!.id,
            nameFi: h.nameFi,
            displayName: h.name,
            quantity: h.quantity,
            unit: h.unit,
            section: h.section,
            storeId,
            storeReason: ruleOf.has(h.nameFi) ? `Your rule: always at ${storeId === "lidl" ? "Lidl" : "S-market"}` : null,
            productId: product?.id ?? null,
            packs: product ? packsNeeded(h.quantity, h.unit, product.packSize, product.packUnit) : null,
            price: product?.price ?? null,
            sources: [],
            state: (prev && (prev.state === "none" || prev.state === "skipped") ? prev.state : "refill") as ItemRow["state"],
            note: "Household refill",
            householdItemId: h.id,
            checked: prev?.checked ?? false,
            checkedAt: prev?.checkedAt ?? null,
          };
        }),
      );
    }
    await tx
      .update(schema.shoppingLists)
      .set({ version: sql`${schema.shoppingLists.version} + 1`, updatedAt: new Date() })
      .where(eq(schema.shoppingLists.id, list.id));
  });
  return list!.id;
}

export async function getList(listId: string) {
  const db = await getDb();
  const [list] = await db.select().from(schema.shoppingLists).where(eq(schema.shoppingLists.id, listId));
  if (!list) return null;
  return loadListData(list);
}

export async function getListByToken(token: string) {
  if (!token || token.length < 10) return null;
  const db = await getDb();
  const [list] = await db.select().from(schema.shoppingLists).where(eq(schema.shoppingLists.shareToken, token));
  if (!list) return null;
  return loadListData(list);
}

async function loadListData(list: ListRow) {
  const db = await getDb();
  const items = await db
    .select()
    .from(schema.shoppingItems)
    .where(eq(schema.shoppingItems.listId, list.id))
    .orderBy(asc(schema.shoppingItems.displayName));
  const productIds = items.map((i) => i.productId).filter(Boolean) as string[];
  const products = productIds.length ? await db.select().from(schema.products).where(inArray(schema.products.id, productIds)) : [];
  const offerIds = items.map((i) => i.offerId).filter(Boolean) as string[];
  const offers = offerIds.length ? await db.select().from(schema.offers).where(inArray(schema.offers.id, offerIds)) : [];
  const sections = await db.select().from(schema.storeSections).orderBy(asc(schema.storeSections.position));
  const stores = await db.select().from(schema.stores);
  const sectionOrder: Record<StoreId, string[]> = {
    smarket: sections.filter((s) => s.storeId === "smarket").map((s) => s.sectionKey),
    lidl: sections.filter((s) => s.storeId === "lidl").map((s) => s.sectionKey),
  };
  return { list, items, products, offers, sectionOrder, stores };
}

export type ListData = NonNullable<Awaited<ReturnType<typeof getList>>>;

/** Minimal state for polling / offline sync. */
export async function getListState(listId: string) {
  const db = await getDb();
  const [list] = await db
    .select({ id: schema.shoppingLists.id, version: schema.shoppingLists.version })
    .from(schema.shoppingLists)
    .where(eq(schema.shoppingLists.id, listId));
  if (!list) return null;
  const items = await db
    .select({ id: schema.shoppingItems.id, checked: schema.shoppingItems.checked, storeId: schema.shoppingItems.storeId })
    .from(schema.shoppingItems)
    .where(eq(schema.shoppingItems.listId, listId));
  return { version: list.version, items };
}

async function itemInList(itemId: string, listId: string) {
  const db = await getDb();
  const [item] = await db
    .select()
    .from(schema.shoppingItems)
    .where(and(eq(schema.shoppingItems.id, itemId), eq(schema.shoppingItems.listId, listId)));
  if (!item) throw new Error("Item not found on this list");
  return item;
}

export async function setChecked(listId: string, itemId: string, checked: boolean) {
  const item = await itemInList(itemId, listId);
  // Buying a household refill resets its countdown.
  if (checked && item.householdItemId) await markBought(item.householdItemId);
  const db = await getDb();
  await db
    .update(schema.shoppingItems)
    .set({ checked, checkedAt: checked ? new Date() : null, updatedAt: new Date() })
    .where(eq(schema.shoppingItems.id, itemId));
  await bump(listId);
}

/** Manual store choice for one item, optionally remembered as a rule. */
export async function setItemStore(listId: string, itemId: string, storeId: StoreId, remember: boolean) {
  const item = await itemInList(itemId, listId);
  const db = await getDb();
  await db
    .update(schema.shoppingItems)
    .set({
      storeId,
      storeOverridden: true,
      storeReason: remember ? `Your rule: always at ${storeId === "lidl" ? "Lidl" : "S-market"}` : "Set manually",
      updatedAt: new Date(),
    })
    .where(eq(schema.shoppingItems.id, itemId));
  if (remember) {
    await db
      .insert(schema.storeRules)
      .values({ nameFi: item.nameFi, storeId })
      .onConflictDoUpdate({ target: schema.storeRules.nameFi, set: { storeId } });
  }
  await bump(listId);
}

/** "Have it?" answer for a staple. "have" also records it in the pantry. */
export async function answerStaple(listId: string, itemId: string, have: boolean) {
  const item = await itemInList(itemId, listId);
  const db = await getDb();
  await db
    .update(schema.shoppingItems)
    .set({ state: have ? "have" : "none", updatedAt: new Date() })
    .where(eq(schema.shoppingItems.id, itemId));
  if (have) await addToPantry({ name: item.displayName, nameFi: item.nameFi, category: item.section });
  await bump(listId);
}

export async function addManualItem(listId: string, input: { name: string; quantity: number | null; unit: string | null }) {
  const db = await getDb();
  const n = (await normalizeMany([input.name])).get(input.name)!;
  await db.insert(schema.shoppingItems).values({
    listId,
    nameFi: n.nameFi,
    displayName: input.name.trim(),
    quantity: input.quantity,
    unit: input.quantity == null ? null : (input.unit ?? "kpl"),
    section: toSectionKey(n.category),
    storeId: "smarket",
    manual: true,
    sources: [],
  });
  await bump(listId);
}

export async function deleteItem(listId: string, itemId: string) {
  await itemInList(itemId, listId);
  const db = await getDb();
  await db.delete(schema.shoppingItems).where(eq(schema.shoppingItems.id, itemId));
  await bump(listId);
}

/** One tap: every checked item that isn't in the pantry yet goes there. */
export async function moveCheckedToPantry(listId: string) {
  const db = await getDb();
  const items = await db
    .select()
    .from(schema.shoppingItems)
    .where(and(eq(schema.shoppingItems.listId, listId), eq(schema.shoppingItems.checked, true), eq(schema.shoppingItems.movedToPantry, false)));
  for (const it of items) {
    if (it.householdItemId) continue; // refills (toilet paper…) don't belong in the food pantry
    await addToPantry({ name: it.displayName, nameFi: it.nameFi, quantity: it.quantity, unit: it.unit, category: it.section });
  }
  if (items.length) {
    await db.update(schema.shoppingItems).set({ movedToPantry: true }).where(inArray(schema.shoppingItems.id, items.map((i) => i.id)));
    await bump(listId);
  }
  return items.length;
}

export async function renewShareToken(listId: string) {
  const db = await getDb();
  await db.update(schema.shoppingLists).set({ shareToken: newToken() }).where(eq(schema.shoppingLists.id, listId));
}

/**
 * Seam for the cart-automation project: S-market items with a mapped product.
 * Quantity = packs to buy (falls back to 1).
 */
export async function exportSMarket(listId: string) {
  const data = await getList(listId);
  if (!data) return null;
  const products = new Map(data.products.map((p) => [p.id, p]));
  const items = data.items
    .filter((i) => i.storeId === "smarket" && i.productId && (i.state === "none"))
    .map((i) => {
      const p = products.get(i.productId!)!;
      return {
        s_kaupat_product_id: p.source === "s-kaupat" || p.source === "manual" ? p.externalId : null,
        ean: p.ean,
        name: p.name,
        quantity: i.packs ?? 1,
        // Extra context (not required by the cart seam):
        ingredient: i.nameFi,
        needed: i.quantity != null ? `${i.quantity} ${i.unit ?? ""}`.trim() : null,
        product_source: p.source,
      };
    });
  const unmapped = data.items.filter((i) => i.storeId === "smarket" && !i.productId && i.state === "none").map((i) => i.nameFi);
  return {
    list_id: data.list.id,
    store: data.stores.find((s) => s.id === "smarket") ?? null,
    generated_at: new Date().toISOString(),
    items,
    unmapped_ingredients: unmapped,
  };
}

/** After (re)mapping an ingredient, update S-market items on existing lists: product, packs, price. */
export async function applyMappingToLists(nameFi: string, productId: string | null) {
  const db = await getDb();
  const items = await db
    .select()
    .from(schema.shoppingItems)
    .where(and(eq(schema.shoppingItems.nameFi, nameFi), eq(schema.shoppingItems.storeId, "smarket")));
  if (!items.length) return;
  const [p] = productId ? await db.select().from(schema.products).where(eq(schema.products.id, productId)) : [];
  const touched = new Set<string>();
  for (const it of items) {
    await db
      .update(schema.shoppingItems)
      .set({
        productId: p?.id ?? null,
        packs: p ? packsNeeded(it.quantity, it.unit, p.packSize, p.packUnit) : null,
        price: p?.price ?? null,
        updatedAt: new Date(),
      })
      .where(eq(schema.shoppingItems.id, it.id));
    touched.add(it.listId);
  }
  for (const id of touched) await bump(id);
}

/** "Add to list" / "Not this time" for a suggested household refill. */
export async function answerRefill(listId: string, itemId: string, add: boolean) {
  await itemInList(itemId, listId);
  const db = await getDb();
  await db
    .update(schema.shoppingItems)
    .set({ state: add ? "none" : "skipped", updatedAt: new Date() })
    .where(eq(schema.shoppingItems.id, itemId));
  await bump(listId);
}

/**
 * Order feed for the local S-kaupat cart helper (helper/skaupat-cart.mjs):
 * S-market items to buy with first and second-choice products, plus delivery
 * preferences. No address or credentials are included.
 */
export async function orderForHelper(listId: string, delivery: unknown) {
  const data = await getList(listId);
  if (!data) return null;
  const db = await getDb();
  const maps = await db
    .select()
    .from(schema.ingredientProductMap)
    .where(eq(schema.ingredientProductMap.storeId, "smarket"));
  const altIds = maps.map((m) => m.alternateProductId).filter(Boolean) as string[];
  const alts = altIds.length ? await db.select().from(schema.products).where(inArray(schema.products.id, altIds)) : [];
  const altOf = new Map(maps.filter((m) => m.alternateProductId).map((m) => [m.nameFi, alts.find((a) => a.id === m.alternateProductId) ?? null]));
  const products = new Map(data.products.map((p) => [p.id, p]));
  const toBuy = data.items.filter((i) => i.storeId === "smarket" && i.state === "none");
  const ref = (p: typeof schema.products.$inferSelect | null | undefined) =>
    p ? { s_kaupat_product_id: p.source === "mock" ? null : p.externalId, ean: p.ean, name: p.name, source: p.source, pack: p.packSize ? `${p.packSize} ${p.packUnit ?? ""}`.trim() : null } : null;
  return {
    version: 1,
    list: { id: data.list.id, name: data.list.name },
    store: data.stores.find((s) => s.id === "smarket") ?? null,
    delivery,
    generated_at: new Date().toISOString(),
    items: toBuy
      .filter((i) => i.productId)
      .map((i) => ({
        ingredient: i.nameFi,
        needed: i.quantity != null ? `${i.quantity} ${i.unit ?? ""}`.trim() : null,
        quantity: i.packs ?? 1,
        household: !!i.householdItemId,
        primary: ref(products.get(i.productId!)),
        alternate: ref(altOf.get(i.nameFi)),
      })),
    unmapped: toBuy.filter((i) => !i.productId).map((i) => ({ ingredient: i.nameFi, needed: i.quantity != null ? `${i.quantity} ${i.unit ?? ""}`.trim() : null })),
  };
}
