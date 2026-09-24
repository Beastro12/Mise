CREATE TABLE "import_batches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"original_ids" uuid[] DEFAULT '{}' NOT NULL,
	"message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"draft" jsonb NOT NULL,
	"recipe_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingredient_product_map" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_fi" text NOT NULL,
	"store_id" text NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_start" date NOT NULL,
	"name" text,
	"default_servings" integer DEFAULT 2 NOT NULL,
	"mode" text DEFAULT 'pick' NOT NULL,
	"propose_params" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text DEFAULT 'lidl' NOT NULL,
	"product_name" text NOT NULL,
	"name_fi" text NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"regular_price" numeric(10, 2),
	"unit_text" text,
	"unit_price" numeric(10, 2),
	"unit_price_unit" text,
	"valid_from" date NOT NULL,
	"valid_to" date NOT NULL,
	"source" text NOT NULL,
	"original_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "originals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"url" text,
	"storage_key" text,
	"filename" text,
	"mime" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pantry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_fi" text NOT NULL,
	"display_name" text NOT NULL,
	"quantity" double precision,
	"unit" text,
	"note" text,
	"category" text DEFAULT 'muut' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planned_meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"servings" integer NOT NULL,
	"day" date,
	"position" integer DEFAULT 0 NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"reason" text,
	"cooked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_search_cache" (
	"store_id" text NOT NULL,
	"adapter" text NOT NULL,
	"query" text NOT NULL,
	"product_ids" uuid[] DEFAULT '{}' NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_search_cache_store_id_adapter_query_pk" PRIMARY KEY("store_id","adapter","query")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"store_id" text NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"ean" text,
	"name" text NOT NULL,
	"brand" text,
	"pack_size" double precision,
	"pack_unit" text,
	"price" numeric(10, 2),
	"unit_price" numeric(10, 2),
	"unit_price_unit" text,
	"store_external_id" text,
	"raw" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"quantity" double precision,
	"unit" text,
	"original_text" text NOT NULL,
	"name" text NOT NULL,
	"name_fi" text NOT NULL,
	"prep_note" text,
	"category" text DEFAULT 'muut' NOT NULL,
	"optional" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_originals" (
	"recipe_id" uuid NOT NULL,
	"original_id" uuid NOT NULL,
	CONSTRAINT "recipe_originals_recipe_id_original_id_pk" PRIMARY KEY("recipe_id","original_id")
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"source_url" text,
	"source_note" text,
	"servings" integer DEFAULT 2 NOT NULL,
	"prep_minutes" integer,
	"cook_minutes" integer,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"image_original_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"list_id" uuid NOT NULL,
	"name_fi" text NOT NULL,
	"display_name" text NOT NULL,
	"quantity" double precision,
	"unit" text,
	"section" text DEFAULT 'muut' NOT NULL,
	"store_id" text DEFAULT 'smarket' NOT NULL,
	"store_reason" text,
	"store_overridden" boolean DEFAULT false NOT NULL,
	"product_id" uuid,
	"packs" integer,
	"price" numeric(10, 2),
	"offer_id" uuid,
	"sources" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"state" text DEFAULT 'none' NOT NULL,
	"note" text,
	"manual" boolean DEFAULT false NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"checked_at" timestamp with time zone,
	"moved_to_pantry" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_lists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid,
	"name" text NOT NULL,
	"share_token" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "staples" (
	"name_fi" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_rules" (
	"name_fi" text PRIMARY KEY NOT NULL,
	"store_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "store_sections" (
	"store_id" text NOT NULL,
	"section_key" text NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "store_sections_store_id_section_key_pk" PRIMARY KEY("store_id","section_key")
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"chain" text NOT NULL,
	"external_id" text,
	"address" text
);
--> statement-breakpoint
CREATE TABLE "synonyms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"term" text NOT NULL,
	"name_fi" text NOT NULL,
	"category" text,
	"source" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "import_drafts" ADD CONSTRAINT "import_drafts_batch_id_import_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."import_batches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_drafts" ADD CONSTRAINT "import_drafts_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ingredient_product_map" ADD CONSTRAINT "ingredient_product_map_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_original_id_originals_id_fk" FOREIGN KEY ("original_id") REFERENCES "public"."originals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_meals" ADD CONSTRAINT "planned_meals_plan_id_meal_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planned_meals" ADD CONSTRAINT "planned_meals_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_originals" ADD CONSTRAINT "recipe_originals_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_originals" ADD CONSTRAINT "recipe_originals_original_id_originals_id_fk" FOREIGN KEY ("original_id") REFERENCES "public"."originals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_image_original_id_originals_id_fk" FOREIGN KEY ("image_original_id") REFERENCES "public"."originals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_list_id_shopping_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."shopping_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_offer_id_offers_id_fk" FOREIGN KEY ("offer_id") REFERENCES "public"."offers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_plan_id_meal_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ingredient_product_map_name_store_idx" ON "ingredient_product_map" USING btree ("name_fi","store_id");--> statement-breakpoint
CREATE INDEX "offers_valid_idx" ON "offers" USING btree ("store_id","valid_to");--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_name_idx" ON "pantry_items" USING btree ("name_fi");--> statement-breakpoint
CREATE INDEX "planned_meals_plan_idx" ON "planned_meals" USING btree ("plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "products_store_source_ext_idx" ON "products" USING btree ("store_id","source","external_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "shopping_items_list_idx" ON "shopping_items" USING btree ("list_id");--> statement-breakpoint
CREATE UNIQUE INDEX "synonyms_term_idx" ON "synonyms" USING btree ("term");