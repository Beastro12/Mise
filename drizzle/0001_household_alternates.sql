CREATE TABLE "household_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"name_fi" text NOT NULL,
	"quantity" double precision,
	"unit" text,
	"interval_days" integer DEFAULT 14 NOT NULL,
	"last_bought_on" date,
	"section" text DEFAULT 'muut' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ingredient_product_map" ADD COLUMN "alternate_product_id" uuid;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD COLUMN "household_item_id" uuid;--> statement-breakpoint
ALTER TABLE "ingredient_product_map" ADD CONSTRAINT "ingredient_product_map_alternate_product_id_products_id_fk" FOREIGN KEY ("alternate_product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_household_item_id_household_items_id_fk" FOREIGN KEY ("household_item_id") REFERENCES "public"."household_items"("id") ON DELETE set null ON UPDATE no action;