import {
  pgTable,
  uuid,
  text,
  integer,
  doublePrecision,
  numeric,
  boolean,
  timestamp,
  date,
  jsonb,
  primaryKey,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
const money = (name: string) => numeric(name, { precision: 10, scale: 2, mode: "number" });

/** Store ids are fixed: this app knows exactly two stores. */
export type StoreId = "smarket" | "lidl";

// ---------------------------------------------------------------------------
// Recipes
// ---------------------------------------------------------------------------

export const originals = pgTable("originals", {
  id: id(),
  kind: text("kind").$type<"image" | "file" | "url" | "text">().notNull(),
  url: text("url"),
  storageKey: text("storage_key"),
  filename: text("filename"),
  mime: text("mime"),
  createdAt: createdAt(),
});

export const recipes = pgTable("recipes", {
  id: id(),
  title: text("title").notNull(),
  sourceType: text("source_type").$type<"photo" | "url" | "file" | "manual" | "seed">().notNull(),
  sourceUrl: text("source_url"),
  sourceNote: text("source_note"),
  servings: integer("servings").notNull().default(2),
  prepMinutes: integer("prep_minutes"),
  cookMinutes: integer("cook_minutes"),
  tags: text("tags").array().notNull().default([]),
  steps: jsonb("steps").$type<string[]>().notNull().default([]),
  notes: text("notes"),
  imageOriginalId: uuid("image_original_id").references(() => originals.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const recipeIngredients = pgTable(
  "recipe_ingredients",
  {
    id: id(),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    position: integer("position").notNull().default(0),
    quantity: doublePrecision("quantity"),
    unit: text("unit"),
    originalText: text("original_text").notNull(),
    name: text("name").notNull(),
    nameFi: text("name_fi").notNull(),
    prepNote: text("prep_note"),
    category: text("category").notNull().default("muut"),
    optional: boolean("optional").notNull().default(false),
  },
  (t) => [index("recipe_ingredients_recipe_idx").on(t.recipeId)],
);

export const recipeOriginals = pgTable(
  "recipe_originals",
  {
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    originalId: uuid("original_id")
      .notNull()
      .references(() => originals.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.recipeId, t.originalId] })],
);

// ---------------------------------------------------------------------------
// Import review queue
// ---------------------------------------------------------------------------

export const importBatches = pgTable("import_batches", {
  id: id(),
  kind: text("kind").$type<"photo" | "url" | "file" | "manual">().notNull(),
  originalIds: uuid("original_ids").array().notNull().default([]),
  message: text("message"),
  createdAt: createdAt(),
});

export const importDrafts = pgTable("import_drafts", {
  id: id(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => importBatches.id, { onDelete: "cascade" }),
  position: integer("position").notNull().default(0),
  status: text("status").$type<"pending" | "saved" | "discarded">().notNull().default("pending"),
  draft: jsonb("draft").notNull(),
  recipeId: uuid("recipe_id").references(() => recipes.id, { onDelete: "set null" }),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Ingredient vocabulary
// ---------------------------------------------------------------------------

export const synonyms = pgTable(
  "synonyms",
  {
    id: id(),
    term: text("term").notNull(),
    nameFi: text("name_fi").notNull(),
    category: text("category"),
    source: text("source").$type<"seed" | "user" | "claude">().notNull().default("user"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("synonyms_term_idx").on(t.term)],
);

export const staples = pgTable("staples", {
  nameFi: text("name_fi").primaryKey(),
});

// ---------------------------------------------------------------------------
// Stores, products, mapping, offers
// ---------------------------------------------------------------------------

export const stores = pgTable("stores", {
  id: text("id").$type<StoreId>().primaryKey(),
  name: text("name").notNull(),
  chain: text("chain").notNull(),
  externalId: text("external_id"),
  address: text("address"),
});

export const storeSections = pgTable(
  "store_sections",
  {
    storeId: text("store_id").$type<StoreId>().notNull(),
    sectionKey: text("section_key").notNull(),
    position: integer("position").notNull(),
  },
  (t) => [primaryKey({ columns: [t.storeId, t.sectionKey] })],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    storeId: text("store_id").$type<StoreId>().notNull(),
    source: text("source").$type<"s-kaupat" | "mock" | "manual" | "lidl-offer">().notNull(),
    externalId: text("external_id").notNull(),
    ean: text("ean"),
    name: text("name").notNull(),
    brand: text("brand"),
    packSize: doublePrecision("pack_size"),
    packUnit: text("pack_unit"),
    price: money("price"),
    unitPrice: money("unit_price"),
    unitPriceUnit: text("unit_price_unit"),
    storeExternalId: text("store_external_id"),
    raw: jsonb("raw"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("products_store_source_ext_idx").on(t.storeId, t.source, t.externalId)],
);

export const productSearchCache = pgTable(
  "product_search_cache",
  {
    storeId: text("store_id").$type<StoreId>().notNull(),
    adapter: text("adapter").notNull(),
    query: text("query").notNull(),
    productIds: uuid("product_ids").array().notNull().default([]),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.storeId, t.adapter, t.query] })],
);

/**
 * Ingredient → store product. One row per (normalized ingredient, store).
 * This is the seam the S-kaupat cart-automation project builds on.
 */
export const ingredientProductMap = pgTable(
  "ingredient_product_map",
  {
    id: id(),
    nameFi: text("name_fi").notNull(),
    storeId: text("store_id").$type<StoreId>().notNull(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("ingredient_product_map_name_store_idx").on(t.nameFi, t.storeId)],
);

export const offers = pgTable(
  "offers",
  {
    id: id(),
    storeId: text("store_id").$type<StoreId>().notNull().default("lidl"),
    productName: text("product_name").notNull(),
    nameFi: text("name_fi").notNull(),
    price: money("price").notNull(),
    regularPrice: money("regular_price"),
    unitText: text("unit_text"),
    unitPrice: money("unit_price"),
    unitPriceUnit: text("unit_price_unit"),
    validFrom: date("valid_from").notNull(),
    validTo: date("valid_to").notNull(),
    source: text("source").$type<"leaflet_photo" | "leaflet_text" | "manual" | "web" | "mock">().notNull(),
    originalId: uuid("original_id").references(() => originals.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("offers_valid_idx").on(t.storeId, t.validTo)],
);

export const storeRules = pgTable("store_rules", {
  nameFi: text("name_fi").primaryKey(),
  storeId: text("store_id").$type<StoreId>().notNull(),
  createdAt: createdAt(),
});

// ---------------------------------------------------------------------------
// Pantry
// ---------------------------------------------------------------------------

export const pantryItems = pgTable(
  "pantry_items",
  {
    id: id(),
    nameFi: text("name_fi").notNull(),
    displayName: text("display_name").notNull(),
    quantity: doublePrecision("quantity"),
    unit: text("unit"),
    note: text("note"),
    category: text("category").notNull().default("muut"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("pantry_name_idx").on(t.nameFi)],
);

// ---------------------------------------------------------------------------
// Planning
// ---------------------------------------------------------------------------

export type ProposeParams = {
  meals: number;
  weekdayMaxMinutes: number | null;
  includeTags: string[];
  excludeTags: string[];
  seed: number;
};

export const mealPlans = pgTable("meal_plans", {
  id: id(),
  weekStart: date("week_start").notNull(),
  name: text("name"),
  defaultServings: integer("default_servings").notNull().default(2),
  mode: text("mode").$type<"pick" | "propose">().notNull().default("pick"),
  proposeParams: jsonb("propose_params").$type<ProposeParams>(),
  createdAt: createdAt(),
});

export const plannedMeals = pgTable(
  "planned_meals",
  {
    id: id(),
    planId: uuid("plan_id")
      .notNull()
      .references(() => mealPlans.id, { onDelete: "cascade" }),
    recipeId: uuid("recipe_id")
      .notNull()
      .references(() => recipes.id, { onDelete: "cascade" }),
    servings: integer("servings").notNull(),
    day: date("day"),
    position: integer("position").notNull().default(0),
    locked: boolean("locked").notNull().default(false),
    reason: text("reason"),
    cookedAt: timestamp("cooked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("planned_meals_plan_idx").on(t.planId)],
);

// ---------------------------------------------------------------------------
// Shopping lists
// ---------------------------------------------------------------------------

export type ItemSource = { recipeId: string; title: string; quantity: number | null; unit: string | null };

export const shoppingLists = pgTable("shopping_lists", {
  id: id(),
  planId: uuid("plan_id").references(() => mealPlans.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  shareToken: text("share_token").notNull(),
  version: integer("version").notNull().default(1),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const shoppingItems = pgTable(
  "shopping_items",
  {
    id: id(),
    listId: uuid("list_id")
      .notNull()
      .references(() => shoppingLists.id, { onDelete: "cascade" }),
    nameFi: text("name_fi").notNull(),
    displayName: text("display_name").notNull(),
    quantity: doublePrecision("quantity"),
    unit: text("unit"),
    section: text("section").notNull().default("muut"),
    storeId: text("store_id").$type<StoreId>().notNull().default("smarket"),
    storeReason: text("store_reason"),
    storeOverridden: boolean("store_overridden").notNull().default(false),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    packs: integer("packs"),
    price: money("price"),
    offerId: uuid("offer_id").references(() => offers.id, { onDelete: "set null" }),
    sources: jsonb("sources").$type<ItemSource[]>().notNull().default([]),
    /** none = normal item; ask = staple awaiting "have it?"; covered = pantry covers it */
    state: text("state").$type<"none" | "ask" | "covered" | "have">().notNull().default("none"),
    note: text("note"),
    manual: boolean("manual").notNull().default(false),
    checked: boolean("checked").notNull().default(false),
    checkedAt: timestamp("checked_at", { withTimezone: true }),
    movedToPantry: boolean("moved_to_pantry").notNull().default(false),
    updatedAt: updatedAt(),
  },
  (t) => [index("shopping_items_list_idx").on(t.listId)],
);

// ---------------------------------------------------------------------------
// Settings (single row key/value)
// ---------------------------------------------------------------------------

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});
