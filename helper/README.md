# S-kaupat cart helper (runs on your Mac)

Fills your S-kaupat cart with the week's S-market items from Aitta and pre-selects your delivery slot. **You log in yourself and you press the order button yourself.** The helper never stores your password and refuses to click any order or pay button (`helper/lib/plan.mjs` → `FORBIDDEN_CLICK`).

## Status: unverified against the real site

s-kaupat.fi could not be opened from the environment where this was built, so the page addresses and button texts in `lib/site-skaupat.mjs` are guesses. When a guess fails, the helper **pauses and asks you to do that one step by hand** in the open browser, then continues. The first real run tells us which guesses need fixing (see *Calibrating*).

Automating a logged-in account may be restricted by S-kaupat's terms of use. Check them first. Use is personal, low-volume, with you present.

## One-time setup

1. Install **Node.js 22** (<https://nodejs.org>) and **Google Chrome**.
2. `git clone` this repository, `cd` into it, run `npm install`.
3. Optional, if you don't want to use your installed Chrome: `npx playwright install chromium` and add `--no-chrome` when running.

## Every week

1. In Aitta: plan the meals, generate the list, answer "Have it?" and "Running low?", and match S-market products. Pick 2nd choices on each product page if you like.
2. Set the delivery preferences under **More → S-kaupat order**. That page also shows the exact command to run.
3. In the repo folder:

   ```bash
   npm run cart -- "https://<your-aitta>/share/<token>" --dry-run   # just show the plan
   npm run cart -- "https://<your-aitta>/share/<token>"
   ```

4. Chrome opens S-kaupat. Log in (the session is remembered in `~/.aitta/skaupat-profile`) and check your store is selected, then press Enter in the terminal.
5. The helper adds each product and sets its quantity. If a product is sold out it tries your 2nd choice; anything it can't add is listed at the end. It then goes to checkout, selects home delivery or pickup, and picks the first slot on your preferred day inside your time window (falling back to another time that day, then the earliest slot, and saying which).
6. It stops. Review the cart and slot in the browser and place the order yourself.

## What it can't do

- Items matched only to **MOCK** products (the demo catalogue) are skipped. They aren't real S-kaupat products. Match real ones by entering the product by hand in Aitta.
- Lidl items are not part of this: Lidl Finland has no online shop.

## Calibrating (after the first run)

Where the helper had to ask you, note the real page address or button text and update `lib/site-skaupat.mjs`:

- `SITE.search`: the URL of a search result page.
- `SITE.cart`: the cart page URL.
- `SITE.text.*`: the words on the "add to cart", "+", "to checkout" and delivery-method buttons.
- `listSlots`: how delivery slots are shown.

`--dry-run` never opens a browser. It's a safe way to check what would be added.
