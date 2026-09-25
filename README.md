# Aitta

*Aitta* is the old Finnish storehouse on stilts where a household kept its food.

A personal meal planner and shopping list for one household in Turku. It plans the week from your own recipes and splits the shopping list between **S-market** (S-kaupat) and **Lidl Vähäheikkilä**. The UI is in English; ingredient names are Finnish, because that's how you search in the store.

- **Recipes:** import from a web link (schema.org JSON-LD, with Claude as fallback), photos or scans (Claude vision; many pages → one recipe, or one page → many recipes), files (PDF, .docx, .txt, .md), or type them in. Every import ends in a review screen, and the original stays linked to the recipe.
- **Plan:** pick recipes yourself, or have a week proposed (no repeats from the last 2 weeks, protein variety, pantry items, this week's Lidl offers). You can swap one meal, lock meals and regenerate the rest, and mark meals cooked.
- **List:** ingredients are merged across recipes (2 dl + 100 ml → 3 dl), and the pantry is subtracted. Staples trigger a "Have it?" question instead of being added. Pack counts come from the product you matched. Everything defaults to S-market and moves to Lidl only on a (cheaper) Lidl offer, with the reason shown. Sections follow each store's walking order. The checklist works offline, and checked items go to the pantry in one tap. Your spouse can use the same list through a share link.
- **Stores:** Lidl offers come from leaflet photos or pasted text. S-kaupat product data is a **mock** until the real site can be verified (see [DECISIONS.md](DECISIONS.md)).

Design: “birch & frost”: birch-paper background, charcoal ink, one fjord-blue accent, hairlines, Inter (self-hosted via `@fontsource-variable/inter`); a “frost night” dark theme follows the phone setting. The GitHub repo is still called `Mise`; the app itself is Aitta.

Docs: [PLAN.md](PLAN.md) (architecture, data model) · [DECISIONS.md](DECISIONS.md) (choices, and which data sources are verified or mocked) · [NEXT_SESSION.md](NEXT_SESSION.md) (cart-automation hand-off).

## Run locally

Requires Node 20.9+ (22 recommended).

```bash
npm install
cp .env.example .env.local      # optional: add ANTHROPIC_API_KEY, APP_PASSCODE
npm run dev                     # http://localhost:3000
```

No database setup is needed. Without `DATABASE_URL` the app uses an embedded Postgres (PGlite) in `./.data/pglite`. It runs migrations and seeds 4 recipes, the ingredient vocabulary and the store settings automatically on first request. Delete `.data/` to start over.

To try it on your phone over wifi: `DEV_ORIGINS=192.168.x.y npm run dev -- -H 0.0.0.0`, then open `http://192.168.x.y:3000`. Offline mode (the service worker) only runs in a production build: `npm run build && npm start`.

### Environment variables

| Variable | Needed | Purpose |
|---|---|---|
| `APP_PASSCODE` | **yes in production** | Single passcode for the app. Unset = no login (a warning banner is shown). |
| `SESSION_SECRET` | recommended | Signs the login cookie. Defaults to a value derived from the passcode. |
| `ANTHROPIC_API_KEY` | for photo import and smart extraction | Used server-side only. Without it, link import (JSON-LD), local file parsing, manual entry and pasted-text offers still work. |
| `ANTHROPIC_MODEL` | no | Default `claude-sonnet-5`. |
| `DATABASE_URL` | **yes on Vercel** | Postgres connection string (Supabase transaction pooler, port 6543). |
| `DB_AUTO_MIGRATE` | no | `1` runs migrations and seed on first connection. |
| `BLOB_STORE` | **`supabase` on Vercel** | `local` (`./.data/uploads`) or `supabase`. |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET` | with `BLOB_STORE=supabase` | Private bucket for recipe photos and files (default name `aitta-originals`). |
| `S_MARKET_STORE`, `S_KAUPAT_STORE_ID` | no | Your S-market or Prisma. Seeded once; editable later under More → Stores. |
| `S_KAUPAT_ADAPTER` | no | `mock` (invented demo catalogue) or `none`. Default: `mock` in dev, `none` in production. |

## Tests

```bash
npm test                 # Vitest unit tests (units, merging, aggregation, pantry, store split, scaling, parsers, propose, Claude mapping)
npm run test:e2e         # Playwright: builds the app, runs the happy path + offline sync against a fresh PGlite DB
E2E_DATABASE_URL=postgres://… npm run test:e2e   # same, against a real (empty) Postgres
npm run typecheck && npm run lint
```

The e2e suite imports a recipe from a URL (served by a local fixture server), plans 3 meals, generates the list, checks the S-market/Lidl split and section order, matches a product, checks off items (including from the share link), moves them to the pantry, and checks that a check-off made offline syncs later. If Playwright can't download its browser, set `PLAYWRIGHT_CHROMIUM=/path/to/chrome`.

## Deploy (Supabase + Vercel)

1. **Supabase:** create a project.
   - Database → Connect → copy the **Transaction pooler** URI (port 6543). That is `DATABASE_URL`.
   - Storage → create a **private** bucket `aitta-originals`.
   - Project Settings → API → copy the project URL and the `service_role` key.
2. **Create the tables and seed data** from your machine:
   ```bash
   DATABASE_URL='postgres://…:6543/postgres' npm run db:migrate
   DATABASE_URL='postgres://…:6543/postgres' S_MARKET_STORE='S-market …, Turku' npm run db:seed
   ```
3. **Vercel:** import the Git repo (framework: Next.js, default build command). Set the environment variables: `APP_PASSCODE`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `DATABASE_URL`, `BLOB_STORE=supabase`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET=aitta-originals`. Deploy.
4. Open the site on your phone, log in, then **Add to Home Screen**. Open the shopping list once while online so it also works offline in the store.
5. Share a list: on the list press **Share** and send the link to your spouse. The link only allows viewing and checking off that one list. **New link** revokes the old one.

Schema changes later: edit `src/db/schema.ts`, run `npm run db:generate`, commit the new SQL in `drizzle/`, and run `npm run db:migrate` against Supabase.

## Known gaps

- **S-kaupat data is not real.** s-kaupat.fi was blocked from the build environment, so no endpoint was verified and none was invented. The mock catalogue has made-up prices. In production the adapter is off, and you can type products in by hand when matching. See DECISIONS.md D1 and NEXT_SESSION.md.
- **lidl.fi is not scraped.** It was blocked the same way. Offers come from leaflet photos (Claude) or pasted text.
- **Claude calls were not run live.** There was no API key in the build environment. The request code follows the official SDK docs, and tests cover it with a stubbed client. Photo import and Claude extraction need a first real run to confirm prompt quality.
- **Supabase Storage was not exercised live.** Local-disk storage is tested; the Supabase path follows the supabase-js docs.
- Vercel limits request bodies to about 4.5 MB. Photos are resized on the phone before upload, but a PDF larger than about 4 MB won't upload on Vercel.
- Unit handling is deliberately conservative: `1 tlk tomaattimurskaa` and `400 g tomaattimurskaa` stay as two lines, because a can size isn't assumed.
- The partitive → nominative heuristic for unknown Finnish words is best effort. Fix names in review; corrections are saved as synonyms for new terms.
- Spouse sync polls every 4 s rather than using realtime push.
- No nutrition, no barcode scanning, no expiry dates, no other chains (out of scope).
