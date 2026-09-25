# Decisions log

Format: **what I chose**, why, how to change it.
External data sources carry an explicit status: **VERIFIED**, **UNVERIFIED**, or **MOCK**.

## External data sources

### D1. S-kaupat (S-market) product search and prices: UNVERIFIED, mock adapter only
- **What I tried:** fetching `https://www.s-kaupat.fi/` and `https://www.s-kaupat.fi/tuotteet?queryString=kermaviili` from the build environment. Both were **blocked by the session's network egress policy** (proxy returned HTTP 403 on CONNECT; the web-fetch tool returned `EGRESS_BLOCKED`). I could not see the site's network requests or response shapes.
- **Chosen:** Per the brief ("never invent API endpoints or response shapes"), there is **no real S-kaupat HTTP adapter in the code**. The `StoreAdapter` interface (`searchProducts`, `getProduct`, `getOffers`) is implemented by:
  - `mock`: a small fixed catalogue of realistic-looking products. Every one is flagged `source = "mock"`, has an id starting `mock-`, and shows a **MOCK** badge in the UI. Prices are invented and are not real S-market prices.
  - `none`: returns nothing. Items simply have no price.
  - **Manual products:** on the mapping screen you can type in a product you looked up in the S-kaupat app (S-kaupat product id, EAN, name, pack size, price). These are stored with `source = "manual"` and exported like any other product.
- **Default:** `S_KAUPAT_ADAPTER=mock` in development, `none` in production (so no invented prices reach the real shopping list).
- **How to change:** once s-kaupat.fi is reachable, open the site with devtools → Network, search a product with a store selected, and record the real request and response. Then implement `src/lib/stores/skaupat-http.ts` against the `StoreAdapter` interface and register it in `src/lib/stores/index.ts` under `S_KAUPAT_ADAPTER=http`. The cache, rate limiter and mapping UI already sit above the interface. See NEXT_SESSION.md.

### D2. Lidl weekly offers from lidl.fi: UNVERIFIED, not scraped
- **What I tried:** fetching `https://www.lidl.fi/`. **Blocked by the egress policy** in the same way, so I could not check whether the offers page is machine-readable.
- **Chosen:** the fallback the brief requires is the primary path. Upload photos of the Lidl leaflet, or paste its text, on **Stores → Lidl offers**. Claude extracts product, price, validity dates and a normalized Finnish ingredient name. Without an API key, a local line parser handles pasted text in the form `Product … 1,49 €` (you give the validity dates in the form). There is also a single-offer manual form.
- **How to change:** add a `lidl-web` adapter implementing `getOffers()` that writes into the same `offers` table (source `web`).

### D3. Claude API (recipe extraction, ingredient normalization, leaflet extraction): code follows SDK docs; **not exercised live in this session**
- The build environment has no `ANTHROPIC_API_KEY`, so no live Claude call was made. All Claude calls go through `@anthropic-ai/sdk` `messages.parse()` with Zod structured outputs (`output_config.format`). Unit tests cover the code around Claude (prompt assembly, mapping the parsed output into drafts) with a stubbed client.
- Model: `ANTHROPIC_MODEL`, default `claude-sonnet-5` (as the brief specifies).
- Without a key: URL import still works via JSON-LD. `.txt`/`.md`/`.docx`/`.pdf` import falls back to a local heuristic parser. Photo import shows a clear "needs ANTHROPIC_API_KEY" error. Ingredient normalization falls back to the synonym table plus light string cleanup.

## Architecture and stack

### D4. Next.js 16 (App Router), `proxy.ts` instead of `middleware.ts`
Next 16 renamed middleware to `proxy`. It runs in the Node runtime.

### D5. Local database: embedded PGlite when `DATABASE_URL` is unset
- **Why:** `npm run dev` works on first run with no Postgres or Supabase setup. PGlite is real Postgres compiled to WASM, so the same Drizzle schema and SQL migrations run on both.
- Data lives in `./.data/pglite` (override with `PGLITE_DIR`). Migrations and seeding run automatically on first access.
- **Production:** set `DATABASE_URL` to the Supabase pooler connection string. The `postgres` driver is used with `prepare: false` (required for Supabase's transaction pooler). Run `npm run db:migrate && npm run db:seed` once.
- **How to change:** always use Postgres by setting `DATABASE_URL`, even locally.

### D6. File storage: local filesystem in dev, Supabase Storage in production
`BLOB_STORE=supabase` (with `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_BUCKET`) or `local` (`./.data/uploads`). Vercel's filesystem is ephemeral, so production must use Supabase. The Supabase code follows the supabase-js docs and was **not exercised live** (no Supabase project in this session). Originals are served through an authenticated route (`/api/originals/[id]`), never as public bucket URLs.

### D7. Auth: single passcode (`APP_PASSCODE`)
Login sets an HMAC-signed httpOnly cookie (secret `SESSION_SECRET`, falling back to one derived from the passcode) valid for 180 days. If `APP_PASSCODE` is unset the app is open and shows a warning banner; README tells you to set it in production. Share links (`/share/<token>`) bypass the passcode, but only for that one list's checklist.

### D8. Spouse sync: polling, not websockets
The share page and the checklist poll `/api/lists/<id>/state` every 4 s while visible and online. Each list has a `version` counter bumped on every change. This works on any Postgres and on Vercel serverless, with no Supabase Realtime setup. **How to change:** replace the poll with Supabase Realtime on `shopping_items`.

## Domain rules

### D9. Spoon units stay as Finnish metric spoons
Finnish recipes use `rkl` (15 ml) and `tl` (5 ml), and `mausteml` (1 ml). `tbsp` → `rkl`, `tsp` → `tl`, `cup` → dl (US cup, 2.37 dl, rounded to 0.1 dl), `oz` → g (28.35), `lb` → g (453.6), `fl oz` → ml (29.57), `pint` → ml (473). All spoon and volume units merge through ml. The original line is always kept (`original_text`) and shown under the ingredient.

### D10. Merged display unit
If every merged line has the same unit, that unit is kept (1 rkl + 2 rkl = 3 rkl). Otherwise the sum is shown in l (≥ 1 l), dl (≥ 1 dl) or ml for volume, and kg (≥ 1 kg) or g for mass. Count (`kpl`) merges with count. Opaque units (tlk, pkt, prk, pss, nippu, kynsi, ripaus, …) merge only with the identical unit. Incompatible units stay as separate lines.

### D11. Pantry semantics
A pantry item without a quantity counts as "have enough" and removes the line. The line moves to a collapsed "Covered by pantry" section so it is still visible. With a compatible quantity, the quantity is subtracted. With an incompatible unit, the line stays and gets a note "pantry has 1 pkt".

### D12. Staples
Staples (seeded: salt, pepper, oil, olive oil, butter, flour, sugar, common spices, stock cubes; editable in Settings) that aren't in the pantry appear in a "Have it?" strip at the top of the list, not as list items. **Have it** → dropped from the list and added to the pantry. **Need it** → becomes a normal item.

### D13. Store split price comparison
The rule: default S-market; move to Lidl only on an active Lidl offer (valid today, matched by `name_fi`). If both prices are known, move only if Lidl is cheaper. "Both prices known" compares unit prices (€/kg or €/l) when both sides have one, otherwise the pack prices. A manual override always wins and can be saved as a rule ("always buy X at Lidl"). Remembered rules win over offers.

### D14. Offer ↔ ingredient matching
Offers get a `name_fi` at import (from Claude, or the synonym table plus text cleanup). An offer matches an item when the `name_fi` values are equal, or when the offer's product name contains the item's `name_fi` as a whole word, e.g. "Kermaviili 10 % 200 g" matches `kermaviili`.

### D15. Propose mode is deterministic scoring, not an LLM call
It is testable, instant, free, and works without an API key. Filters: include tags (recipe needs at least one) and exclude tags (none allowed); nothing cooked or planned in the last 14 days; the weekday time limit (prep + cook) applies to meals placed Mon–Fri. Scores (non-staple ingredients only): +4 per meat/fish ingredient and +2 per other ingredient on a Lidl offer, +1 per pantry ingredient (at most +3), −4 for repeating a protein already chosen, plus up to +1.5 seeded jitter so "give me another" varies. The "protein" is derived from tags (kala, kana/broileri, nauta/jauheliha, possu, vegetarian/kasvis) or from the ingredients. Meals go on consecutive days starting Monday.

### D16. Shopping sections
The eight sections from the brief, in this seeded order: hedelmät ja vihannekset → leipä → liha ja kala → maito ja juusto → kuivatuotteet → pakasteet → juomat → muut. Spices and oils are in kuivatuotteet, eggs in maito ja juusto. You can reorder them per store in Settings; the order is stored in `store_sections`.

### D17. Review corrections only add synonyms, never overwrite
When you save a reviewed recipe, each ingredient name you mapped differently becomes a synonym, **but only if that term is new**. Existing mappings, seed or yours, are never changed silently by one recipe edit. Change a mapping globally in More → Ingredient synonyms. Claude's answers for unknown names are stored the same way (source `claude`).

### D18. Claude structured-output enums are sent as strings
The SDK's Zod helper turns `enum` into description text and validates on the client, so one unexpected unit would make the whole extraction fail. Units, sections and unit-price units are therefore plain strings, with the allowed values in the field description, sanitized on the server (unknown unit → `kpl` with the quantity kept; unknown section → `muut`).

### D19. Offline design
The service worker (production builds only) caches static assets cache-first and page navigations network-first, falling back to the cached page. API calls are never cached. The checklist keeps a copy of the list in `localStorage`, plus a queue of check-offs made offline that is flushed when the connection returns. Other actions (move store, add item, to pantry) need a connection and say so.

### D20. Product mapping is per ingredient for S-market; Lidl uses offers
Lidl has no catalogue, so Lidl items carry the matched offer (name, price, validity) instead of a mapped product. Changing a mapping immediately updates product, pack count and price on existing lists.

### D21. Regenerating a list keeps your work
Check-offs, manually added items, manual store choices and "have it"/"need it" answers survive regeneration. Meals already marked as cooked are left out of the list.

### D22. Parsing details
Ranges buy the upper bound ("1–2 chiliä" → 2). Optional ingredients stay on the list with the note "optional". Water (`vesi`) never goes on the list. A bare count ("2 munaa") gets the unit `kpl`.

### D23. Offer dates
Propose mode counts offers valid on any day of the planned week. The store split on a list uses offers valid **today** (Europe/Helsinki), because that's when you shop. Regenerate the list on shopping day if offers changed.

### D24. Mock catalogue has no real brand names
The mock S-kaupat products use generic names, so no invented price is attached to a real brand. They are badged **MOCK** everywhere and exported with `s_kaupat_product_id: null`.

### D25. Cheaper-than check needs an S-market price
In production (adapter `none`), the S-market price is known only for products you typed in when matching. Without one, a matching Lidl offer moves the item to Lidl (the brief's rule when the price comparison isn't possible).

### D26. Deployment guards
On Vercel, a missing `DATABASE_URL` or `BLOB_STORE=supabase` gives a clear error instead of silently writing to the ephemeral disk. Pages that call Claude set `maxDuration = 300`.

### D27. Test tooling
Playwright is pinned to 1.56.1 to match the Chromium preinstalled in the build container (`PLAYWRIGHT_CHROMIUM` overrides the executable). The e2e suite builds the app and runs against a fresh PGlite database, or a real Postgres via `E2E_DATABASE_URL`. The second e2e test (offline) reuses the list created by the first, so the tests run in order on one worker. The .docx and .pdf fixtures come from `tests/fixtures/generate.py` (stdlib only), because LibreOffice couldn't load files in the container.

### D28. Dev server origins
Next 16 blocks dev resources for origins other than localhost. `127.0.0.1` is allowed, and more hosts can be added with `DEV_ORIGINS` (e.g. to test on the phone over wifi).

### D29. S-market store placeholder
The brief left `S_MARKET_STORE = <FILL IN>`. The app seeds "S-market (set your store in Settings)", unless `S_MARKET_STORE` is set at seed time, and the name and S-kaupat store id are editable under More → Stores. Nothing else depends on the name until a verified S-kaupat adapter exists.

## Verification status (summary)

| Source / integration | Status | Evidence |
|---|---|---|
| schema.org JSON-LD recipe import | **VERIFIED** (local fixture) | e2e test + unit tests on JSON-LD shapes (`@graph`, `HowToSection`, `@type` arrays). Real recipe sites were blocked from the build env. |
| Local .txt/.md/.docx/.pdf parsing | **VERIFIED** | unit tests with generated fixtures + browser test |
| Claude (vision/PDF/text extraction, normalization, leaflet) | **UNVERIFIED live** | SDK-documented request shape; stubbed-client unit tests; no API key in build env |
| S-kaupat product search/prices | **UNVERIFIED → MOCK** | s-kaupat.fi blocked (egress 403); no endpoint invented |
| lidl.fi weekly offers | **UNVERIFIED → not built** | lidl.fi blocked; leaflet photo/text import used instead |
| Supabase Postgres | **VERIFIED equivalent** | full e2e suite passed against a local Postgres 16 with the same driver settings |
| Supabase Storage | **UNVERIFIED live** | follows supabase-js docs; local storage path tested |
| S-kaupat cart helper (site steps) | **UNVERIFIED** | s-kaupat.fi blocked; guessed URLs/texts with pause-and-ask fallback; plan/slot/guard logic unit-tested; `--dry-run` against the real order feed in e2e |
| S-kaupat product matching (`npm run match`) | **UNVERIFIED page parsing** | JSON-LD parser unit-tested on schema.org shapes; helper key + write-back API + `--dry-run` covered in e2e; real product pages not seen |

### D30. Name and visual identity: Aitta, "birch & frost"
Renamed from "Mise FI" (the name belongs to an existing UK app) to **Aitta**, the Finnish word for a traditional food storehouse, chosen by you from a shortlist. **Not trademark- or domain-checked** (not possible from the build environment). Visuals: birch-paper background (#F4F2EE), charcoal ink (#22262A), one fjord-blue accent (#3E6A86), moss for S-market, lake blue for Lidl, hairline borders, squarer corners, Inter variable font bundled from npm (no Google Fonts request at runtime). Dark mode "frost night" follows the system setting. The icon is a line drawing of an aitta on stilts. Renamed internals too: cookie `aitta_session` (existing logins must sign in again), localStorage keys `aitta:*`, service-worker cache `aitta-v1`, default bucket `aitta-originals`.

### D31. Visual refinement: Iittala/Artek calm
Chosen in the interview: calm near-monochrome, geometric headings, a sage accent used rarely, flat surfaces with no texture. Changes from D30:
- Palette: warm greys (bg #F5F4F1, ink #1F2220, hairline #E3E1DC). Primary buttons are charcoal. Sage (#5B6F5E) appears only on check marks and messages. Store markers are muted: S-market moss-grey #4A5A4E, Lidl steel #4C6680. Dark theme uses the same palette in reverse.
- Type: Jost (geometric, bundled via `@fontsource-variable/jost`) for headings and the lowercase "aitta" wordmark; Inter for body text.
- Layout: lists are flat rows between hairlines instead of boxed cards. Section and store headings are larger with more space around them. Secondary list actions (share, new link, export, open plan) are in a "···" menu. Plan-meal actions are quiet text links.
- Icons: one line-icon set (nav, the eight store sections), a birch drawing for empty states, and an app icon with charcoal lines on birch white.

### D32. Visual direction v3: the Finnish autumn kitchen (replaces D31)
You found the calm monochrome look boring and asked for Nordic-kitchen colour that makes the food look appetizing. Palette: spruce #1F3B2E (header band, primary buttons, headings), birch bark #F3EEE6 (background), chanterelle #E3A02F (main actions like "Generate shopping list", the active nav tab, the "Have it at home?" panel), lingonberry #B3263E (Lidl offer tags and prices), blueberry #3A3F78 (Lidl banner). Type: Bricolage Grotesque (bundled) for headings, Inter for body text.
**Signature:** every recipe gets a top-down "plate" drawn from its real ingredient colours (`src/lib/domain/food-colors.ts` + `src/components/plate.tsx`). Coloured sauces become the plate base, cream bases take on the colour of the meat/fish/veg cooked in them, herbs are sprinkled, and it's seeded per recipe so the drawing never changes. The plates appear on meal cards, the recipe grid, recipe pages and the "add recipes" list. Shopping-list, pantry and recipe ingredients show a small swatch in that food's colour. The header shows the season and week in Finnish ("Syksy · viikko 39") as a small local touch; the rest of the UI stays in English. Empty states show a chanterelle drawing. Dark mode ("forest night") uses chanterelle as the primary colour.

### D33. Recipe icons
Chosen in the interview: main protein + time/effort (no allergen badges, no icon filter bar). `src/lib/domain/traits.ts` derives one protein: meat / chicken / fish / vegetarian / vegan. It uses tags first, then ingredients. Vegan means vegetarian with no dairy or eggs; plant milks like kookosmaito count as vegan. Effort icons: quick (≤ 30 min or tag), slow (≥ 90 min), soup (tag or title), oven (tag or "uuni"/"asteessa" in the steps). Best effort: set tags to correct a recipe.

### D34. Household refills
`household_items` (name, Finnish name, quantity, every N days, last bought). An active item is **due** when it has never been bought, or runs out within 7 days of generating the list. Due items appear in a "Running low?" strip on the list (Add / Skip), not straight on the list. Checking a refill off resets its countdown. Refills never go into the food pantry. A refill whose Finnish name is already on the list from a recipe isn't suggested twice.

### D35. S-kaupat cart helper: local, human in the loop, UNVERIFIED selectors
Chosen in the interview: a helper on your Mac (not the cloud), home delivery, preferred weekday + time window, 2nd choice then report.
- **App side (verified by e2e):** 2nd-choice product per ingredient (`ingredient_product_map.alternate_product_id`), delivery preferences (`settings.delivery`), and an order feed `GET /api/share/<token>/order`. The feed is readable with the list's share link, has no address or credentials, and MOCK products get `s_kaupat_product_id: null`.
- **Helper (`helper/`):** Node + Playwright, opens your installed Chrome with a persistent profile in `~/.aitta/skaupat-profile`. You log in yourself; no password is ever stored. Per item it tries the 1st, then 2nd choice. It then opens checkout, picks the delivery method and slot (`chooseSlot`: preferred day + window → same day → earliest), and **stops**. A click guard (`FORBIDDEN_CLICK`) refuses order/pay buttons.
- **UNVERIFIED:** s-kaupat.fi was blocked from the build environment, so the search/cart URLs and button texts in `helper/lib/site-skaupat.mjs` are guesses. Every site step falls back to "please do this by hand, press Enter", so the flow completes even when a guess is wrong. The pure logic (plan, slot choice, click guard) is unit-tested, and `--dry-run` against the real order feed runs in e2e.
- Automating a logged-in account may be restricted by S-kaupat's terms. The helper is personal, low-volume and attended.

### D36. Look & feel extras
- **In season:** `src/lib/domain/season.ts`, a rough monthly list of Finnish produce, with recipes that use it.
- **Recipe photos:** the schema.org `image` from web imports is downloaded (same private-address guard, re-checked on each redirect, ≤ 6 MB) and shown instead of the plate. Cookbook-page scans are not used as photos.
- **Week strip:** Mon–Sun plates at the top of the plan.
- **Cost estimate:** sum of known item prices × packs on the list, with a count of unpriced items. With the mock/none S-kaupat adapter this is only as good as the prices you enter.

### D37. Real products via the Mac helper (`npm run match`), UNVERIFIED page parsing
S-kaupat's product data still can't be read from a server (D1), and no endpoint is invented. Instead you open the product in S-kaupat yourself on the Mac, and the helper reads that page and saves it in Aitta.
- **How it reads a page:** schema.org Product JSON-LD (`gtin13`/`gtin`/`sku`, `offers.price`, `brand`), then `og:title` and an EAN in the URL. Pack size comes from the product name ("2 dl", "6 x 330 ml", "8 rl" → 8 kpl). Whether s-kaupat.fi publishes JSON-LD is **unverified**. If not, the helper says it couldn't read the page and skips it; nothing is guessed.
- **Write-back:** `GET /api/helper/unmatched` and `POST /api/helper/products`, authorised by a **helper key** (Bearer), not the passcode. The key is created on More → S-kaupat order, shown once, stored only as a SHA-256 hash, and replaced or revoked there. It can only list unmatched S-market items and save products (source `s-kaupat`, 1st choice → mapping and open lists, 2nd choice → alternate).
- **On the Mac:** the app address and key live in `~/.aitta/config.json` (mode 600), or in `AITTA_URL`/`AITTA_HELPER_KEY`. The S-kaupat login stays in the browser profile; no password is stored anywhere.

### D38. Dark-mode contrast, Mac launchers, CI
- **Dark mode:** checked by running the e2e suite with `COLOR_SCHEME=dark SHOTS=<dir>`. Three spots were unreadable because an `-ink` token (text on the *solid* colour, dark in dark mode) was used on a `-soft` background, which is also dark in dark mode, and because the Lidl banner hardcoded white text on a colour that turns light. New tokens: `chanterelle-deep` (text on chanterelle-soft) and `lidl-ink` (text on solid Lidl).
- **Launchers:** `helper/Aitta Match.command` and `helper/Aitta Cart.command` open in Terminal on double-click. They install dependencies on first run and wait for Enter before closing. Prompts now stop with a message when input ends, instead of the script exiting silently.
- **CI** (`.github/workflows/ci.yml`): typecheck (after `next typegen`), lint, unit tests and build in one job; the Playwright e2e suite in another (traces uploaded on failure).

### D39. Security review fixes (pre-merge)
- **Uploaded files** are served inline only for known-safe types (JPEG/PNG/WebP/GIF/HEIC, PDF, plain text/Markdown). Everything else downloads as `application/octet-stream`, with `nosniff` and a sandboxing CSP, so an uploaded SVG or HTML file can't run script in the app. PDFs skip the sandbox, because Chrome won't render a PDF under it.
- **Link-import fetch guard** uses Node's `net.BlockList`. It covers IPv4-mapped IPv6 (`[::ffff:169.254.169.254]`), NAT64, CGNAT, multicast and reserved ranges. Photo downloads stream with the 6 MB cap and one 12 s deadline covering all redirects and the body. Known limit: DNS is checked before the fetch, not pinned, so a DNS-rebinding host could still slip through. That is acceptable for a single-owner app whose URL import needs the owner's login.
- **Login attempt limit:** 10 wrong passcodes within 15 minutes pause logins for the rest of that window. The counter is stored in the database, because serverless instances don't share memory. Logged-in devices keep their 180-day cookie.
- **Headers:** `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` and a restrictive `Permissions-Policy` on every response. CI runs with a read-only `GITHUB_TOKEN`.

### D40. Review fixes: refills and the Mac helper
- **One row per ingredient.** A due refill whose ingredient is already on the week's list (to buy, a staple question, or covered by the pantry) merges into that row rather than adding a second one. Checking that row off counts as buying the refill. Unchecking on the same day undoes it (back to due). The household list keeps one item per ingredient: adding it again updates it. Its section comes from the vocabulary even for one-tap suggestions. Covered by a PGlite integration test (`tests/unit/household-list.test.ts`).
- **Cart helper:**
  - It only acts on an EAN search with exactly one result, and presses "+" inside that product's card (otherwise it asks you).
  - The add-button pattern no longer matches "Lue lisää".
  - The never-order guard also refuses buttons without readable text.
  - "Leave it to S-kaupat" no longer uses your 2nd choice.
  - It warns that quantities add to what's already in the cart.
  - The browser profile folder is readable only by you.
- **Product parser:** prefers the page's own Product over "related products" (URL match, then offer + GTIN). It reads the first offer that has a price, and only accepts EANs with a valid GS1 check digit.
