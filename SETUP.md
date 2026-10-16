# Setting up Aitta: your checklist

Everything that needs you, in order. The code side is done. Tick these off once. Steps 1–4 work from an iPhone in Safari; only step 5 needs a Mac.

## 1. Accounts (about 15 minutes)
- [ ] **Supabase** (database + photo storage): sign up at supabase.com and create a project. Pick the region **EU (Frankfurt or Stockholm)**.
- [ ] **Vercel** (hosting): sign up at vercel.com with your GitHub account.
- [ ] **Anthropic API key** (photo import, smart ingredient reading): console.anthropic.com → API keys. Keep it for step 3. Never paste it into a chat.

## 2. Supabase
- [ ] Database → Connect → copy the **Transaction pooler** URI (port **6543**). This is `DATABASE_URL`.
- [ ] Storage → New bucket → name `aitta-originals`, **private**.
- [ ] Project Settings → API → copy the **Project URL** (`SUPABASE_URL`) and the **service_role** key (`SUPABASE_SERVICE_ROLE_KEY`).
- [ ] Nothing to run for the tables: `DB_AUTO_MIGRATE=1` in step 3 makes the app create them (and the starter data, store S-market Majakkaranta) on its first start, and add new ones after updates. *(Alternative with a computer: `DATABASE_URL='…' npm run db:migrate && npm run db:seed`.)*

## 3. Vercel
- [ ] Add New → Project → import `Beastro12/Mise` (framework Next.js, default settings).
- [ ] Environment variables:

  | Name | Value |
  |---|---|
  | `APP_PASSCODE` | a passcode of **12+ characters** that you and your spouse will type |
  | `SESSION_SECRET` | any long random string (on iPhone: Passwords app → + → copy the suggested strong password) |
  | `ANTHROPIC_API_KEY` | from step 1 |
  | `DATABASE_URL` | from step 2 |
  | `BLOB_STORE` | `supabase` |
  | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | from step 2 |
  | `SUPABASE_BUCKET` | `aitta-originals` |
  | `DB_AUTO_MIGRATE` | `1` |
  | `OURA_ACCESS_TOKEN` | optional: Oura token for **Sync Oura** (the Oura file import works without it) |

- [ ] Deploy, then open the address Vercel gives you (e.g. `https://mise-xxxx.vercel.app`).
- [ ] Check the deploy: open `<your-app>/api/health`. Expect `"ok":true` and `"food_entries":true,"health_days":true`. If not, follow the `hint` in the response.

## 4. Phones
- [ ] On each phone, open the address, log in with the passcode, then Share → **Add to Home Screen** (iPhone Safari) or ⋮ → **Install app** (Android Chrome).
- [ ] Open the shopping list once while online, so it also works offline in the store.
- [ ] **Calories:** Calories → Setup → enter height, weight, age and deficit. Then in the Health app: your picture → **Export All Health Data** → Save to Files. Back in Aitta, pick that `export.zip` (it is read on the phone; only daily totals are uploaded). For Oura, export your data from the Oura website and pick the daily-activity file.
- [ ] Your spouse can also use the list without the passcode: on the list press **Share** and send the link.

## 5. Mac helper (S-kaupat)
- [ ] Install **Node.js 22** (nodejs.org) and **Google Chrome**. Clone the repo and run `npm install` (already done if you did step 2).
- [ ] In Aitta: More → S-kaupat order → set the delivery day and time window, then **Create helper key** and copy it.
- [ ] Double-click `helper/Aitta Match.command` (the first time: right-click → Open). Give it the Aitta address and the key, log in to S-kaupat in the window, select **S-market Majakkaranta**, and pick products.
- [ ] Double-click `helper/Aitta Cart.command` and paste the list's share link. It fills the cart and picks a slot, **then stops**. You check the cart and order yourself.
- [ ] Check S-kaupat's terms of use before automating your account.

## 6. Send back to Claude (for the next session)
- [ ] Where the helpers **stopped and asked you** to do something by hand: the step, and the button text or page address you saw.
- [ ] Whether `npm run match` could read a product page. If it couldn't: one product page's address.
- [ ] The S-kaupat store page address for Majakkaranta, so the store id can be filled in.
- [ ] Anything that looked wrong on the phone (a screenshot is enough).
