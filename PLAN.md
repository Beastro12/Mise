# Mise FI: plan

A personal meal planner and shopping list for one household in Turku. It plans meals
from your own recipe catalogue and builds a shopping list split between **S-market**
(S-kaupat) and **Lidl Vähäheikkilä**.

## Architecture

```
Browser (phone, PWA)
  ├─ App Router pages (server components, force-dynamic)      src/app/**
  ├─ Client components (forms, checklist, review editor)       src/components/**
  └─ Service worker public/sw.js (app shell + checklist offline, queued check-offs)

Next.js server (Vercel, Node runtime)
  ├─ proxy.ts: passcode cookie gate (share links bypass it)
  ├─ Route handlers  src/app/api/**   (JSON API used by client components)
  ├─ Server actions  src/app/actions/*.ts (form mutations; each checks auth)
  ├─ Domain core (pure, unit tested)    src/lib/domain/**
  │     units · ingredient-parser · normalize · vocabulary · scaling · aggregate · pantry
  │     · store-split · offers · packs · sections · list-builder · propose · recipe-draft
  ├─ Services (DB + side effects)       src/lib/services/**
  │     recipes · imports · originals · vocab · plans · lists · pantry · products · offers · settings
  ├─ Import pipeline                    src/lib/import/**
  │     jsonld (schema.org Recipe) · fetch-page · files (pdf/docx) · text-heuristic · offers-text · claude-map
  ├─ Claude (server only)               src/lib/ai/**
  │     client · extract (recipes: vision/pdf/text; ingredient names; leaflet offers)
  ├─ Store adapters                     src/lib/stores/**
  │     StoreAdapter interface · cached+rate-limited wrapper
  │     s-kaupat: mock | none  (real HTTP adapter UNVERIFIED, not built; see DECISIONS)
  │     lidl: leaflet (DB offers from photo/text import) | mock
  └─ Blob storage                       src/lib/storage/**   local-fs | supabase

Postgres (Supabase in production; embedded PGlite for zero-setup local dev/tests)
  Drizzle ORM schema src/db/schema.ts, SQL migrations in drizzle/
```

## Data model (Drizzle, Postgres)

| Table | Purpose / key columns |
|---|---|
| `recipes` | title, source_type (photo/url/file/manual/seed), source_url, servings, prep_minutes, cook_minutes, tags text[], steps jsonb, notes, image_original_id |
| `recipe_ingredients` | recipe_id, position, quantity numeric, unit (canonical metric), original_text, name (as written), name_fi (normalized), prep_note, category, optional |
| `originals` | the uploaded or fetched source: kind (image/file/url), storage_key, url, filename, mime |
| `recipe_originals` | recipe ↔ originals (many-to-many: two pages → one recipe, one page → many recipes) |
| `import_batches`, `import_drafts` | review queue: every import creates drafts (jsonb) → review screen → saved recipe |
| `synonyms` | term → name_fi + category (editable; source seed/user/claude) |
| `staples` | name_fi values that trigger "have it?" instead of silently being added |
| `stores` | `smarket` (configurable name + S-kaupat store id), `lidl` (Vähäheikkilä) |
| `store_sections` | per-store walking order of the 8 shopping sections |
| `products` | store product cache: store, source, external_id (S-kaupat id), ean, name, brand, pack size, price, unit price, store_external_id, fetched_at, raw |
| `product_search_cache` | query → product ids, fetched_at (adapter cache) |
| `ingredient_product_map` | **name_fi × store → product** (the seam for the cart-automation project) |
| `offers` | Lidl weekly offers: product_name, name_fi, price, unit_text, regular_price, valid_from, valid_to, source, original_id |
| `store_rules` | "always buy X at Lidl/S-market" |
| `pantry_items` | name_fi, display_name, quantity?, unit?, note |
| `meal_plans` | week_start, default_servings, mode, propose params |
| `planned_meals` | plan_id, recipe_id, servings, day, locked, reason, cooked_at (history) |
| `shopping_lists` | plan_id, share_token, version (bumped on every change → spouse polling) |
| `shopping_items` | name_fi, display_name, quantity, unit, section, store_id, store_reason, store_overridden, product_id, packs, price, offer_id, sources jsonb, state (none/ask/covered/have), note, manual, checked, moved_to_pantry |

## Core algorithms (pure functions, unit tested)

1. **Units**: canonical metric units per dimension: mass (g, kg), volume (ml, dl, l, rkl=15 ml, tl=5 ml, mausteml=1 ml), count (kpl), and opaque units (tlk, pkt, prk, pss, nippu, kynsi, ripaus…) that only merge with themselves. Imperial input (cup, oz, lb, fl oz, tbsp, tsp) is converted at parse time; the original text is kept.
2. **Scaling**: quantity × (target servings / recipe servings).
3. **Aggregation**: group by name_fi + dimension (opaque units: + unit). Same unit → keep the unit. Mixed units → sum in base unit and pick a readable display unit (2 dl + 100 ml → 3 dl). Lines without a quantity stay "as needed".
4. **Pantry subtraction**: a pantry item without a quantity covers the line. With a compatible quantity it is subtracted; with an incompatible one the line is kept and annotated.
5. **Staples**: staple lines not in the pantry become "have it?" questions instead of list items.
6. **Store split**: manual override → remembered rule → active Lidl offer (only if cheaper when both prices are known) → S-market default. Every decision carries a reason string.
7. **Packs**: ceil(need / pack size) when the mapped product's pack size is in a compatible dimension.
8. **Sections**: group by store, then by that store's section order.
9. **Propose**: filter (tags, not cooked or planned in the last 14 days, weekday time limit) → greedy scoring (Lidl-offer main ingredients, pantry use, protein variety, seeded jitter) → one-line reason. Locked meals are kept; "give me another" re-rolls one slot.

## Milestones

- **M0**: Scaffold (Next 16, TS, Tailwind 4), PLAN.md, DECISIONS.md.
- **M1**: Schema + migrations, PGlite/postgres drivers, seed (4 recipes, synonyms, staples, sections, stores), passcode auth.
- **M2**: Domain core + Vitest unit tests (units/merge, aggregation, pantry, store split, scaling, parser, propose).
- **M3**: Recipe catalogue + import: URL (JSON-LD → Claude fallback), photos (Claude vision), files (pdf/docx/txt/md), manual; review screen; originals kept.
- **M4**: Planning (pick + propose, swap, lock, cooked/history), shopping list generation, store split, sections reorder, pantry, product mapping (top 3 candidates), Lidl offers import (photo/text), S-market export JSON, share link + polling, offline checklist.
- **M5**: PWA manifest, icons and service worker; Playwright happy-path e2e; README, NEXT_SESSION.md, final DECISIONS.md.
