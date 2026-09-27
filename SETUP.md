# Setting up Aitta: your checklist

Everything that needs you, in order. The code side is done. Tick these off once.

## 1. Accounts (about 15 minutes)
- [ ] **Supabase** (database + photo storage): sign up at supabase.com and create a project. Pick the region **EU (Frankfurt or Stockholm)**.
- [ ] **Vercel** (hosting): sign up at vercel.com with your GitHub account.
- [ ] **Anthropic API key** (photo import, smart ingredient reading): console.anthropic.com → API keys. Keep it for step 3. Never paste it into a chat.

## 2. Supabase
- [ ] Database → Connect → copy the **Transaction pooler** URI (port **6543**). This is `DATABASE_URL`.
- [ ] Storage → New bucket → name `aitta-originals`, **private**.
- [ ] Project Settings → API → copy the **Project URL** (`SUPABASE_URL`) and the **service_role** key (`SUPABASE_SERVICE_ROLE_KEY`).
- [ ] On your Mac, in the repo folder, create the tables and starter data. The store defaults to S-market Majakkaranta.
  ```bash
  npm install
  DATABASE_URL='postgres://…:6543/postgres' npm run db:migrate
  DATABASE_URL='postgres://…:6543/postgres' npm run db:seed
  ```

## 3. Vercel
- [ ] Add New → Project → import `Beastro12/Mise` (framework Next.js, default settings).
- [ ] Environment variables:

  | Name | Value |
  |---|---|
  | `APP_PASSCODE` | a passcode of **12+ characters** that you and your spouse will type |
  | `SESSION_SECRET` | any long random string (e.g. from `openssl rand -base64 32`) |
  | `ANTHROPIC_API_KEY` | from step 1 |
  | `DATABASE_URL` | from step 2 |
  | `BLOB_STORE` | `supabase` |
  | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | from step 2 |
  | `SUPABASE_BUCKET` | `aitta-originals` |

- [ ] Deploy, then open the address Vercel gives you (e.g. `https://mise-xxxx.vercel.app`).

## 4. Phones
- [ ] On each phone, open the address, log in with the passcode, then Share → **Add to Home Screen** (iPhone Safari) or ⋮ → **Install app** (Android Chrome).
- [ ] Open the shopping list once while online, so it also works offline in the store.
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
