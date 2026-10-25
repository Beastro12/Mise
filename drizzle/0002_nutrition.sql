CREATE TABLE "food_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"day" date NOT NULL,
	"meal" text NOT NULL,
	"name" text NOT NULL,
	"portion" text,
	"kcal" integer NOT NULL,
	"protein_g" double precision,
	"recipe_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_days" (
	"day" date NOT NULL,
	"source" text NOT NULL,
	"active_kcal" integer,
	"basal_kcal" integer,
	"total_kcal" integer,
	"steps" integer,
	"weight_kg" double precision,
	"intake_kcal" integer,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_days_day_source_pk" PRIMARY KEY("day","source")
);
--> statement-breakpoint
ALTER TABLE "food_entries" ADD CONSTRAINT "food_entries_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "food_entries_day_idx" ON "food_entries" USING btree ("day");