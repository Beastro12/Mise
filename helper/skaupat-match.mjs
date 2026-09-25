#!/usr/bin/env node
// Aitta ← S-kaupat product matching. Runs on your own Mac.
//
//   npm run match                # uses ~/.aitta/config.json (asks the first time)
//   npm run match -- --setup     # change the Aitta address or helper key
//   npm run match -- --dry-run   # only list what still needs a product
//
// For each S-market ingredient on your latest list that has no real product yet:
// 1. It opens the S-kaupat search for the ingredient in a real browser window.
// 2. You open the product you want; it reads the product page (name, EAN,
//    pack size, price) and saves it in Aitta as your 1st choice.
// 3. Optionally you open a 2nd choice (used when the 1st is sold out).
// Next time the cart helper can add these products by EAN.
//
// It only talks to your own Aitta (with the helper key from More → S-kaupat
// order) and never stores your S-kaupat password.
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { openBrowser, readConfig, writeConfig } from "./lib/local.mjs";
import { parseProductPage } from "./lib/product.mjs";
import { SITE } from "./lib/site-skaupat.mjs";

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n) => {
  const i = args.indexOf(n);
  return i >= 0 ? args[i + 1] : null;
};

const rl = readline.createInterface({ input: stdin, output: stdout });
const ask = (q) => rl.question(`\n👉 ${q} `);
const log = (...m) => console.log(...m);

async function setup(current) {
  log("\nAitta helper setup. Your answers are saved in ~/.aitta/config.json (readable only by you).");
  const appUrl = (await ask(`Aitta address${current.appUrl ? ` [${current.appUrl}]` : " (e.g. https://aitta.vercel.app)"}:`)).trim() || current.appUrl;
  const helperKey =
    (await ask(`Helper key from Aitta → More → S-kaupat order → Create helper key${current.helperKey ? " [keep current]" : ""}:`)).trim() || current.helperKey;
  if (!appUrl || !helperKey) throw new Error("Both the address and the helper key are needed.");
  const cfg = { appUrl: new URL(appUrl).origin, helperKey };
  log(`Saved to ${writeConfig(cfg)}`);
  return cfg;
}

async function api(cfg, path, init = {}) {
  const res = await fetch(`${cfg.appUrl}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${cfg.helperKey}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error("Aitta rejected the helper key. Create a new one in Aitta and run: npm run match -- --setup");
  if (!res.ok) throw new Error(body.error ?? `Aitta answered HTTP ${res.status}`);
  return body;
}

const describe = (p) =>
  [p.name, p.packSize ? `${String(p.packSize).replace(".", ",")} ${p.packUnit}` : null, p.price != null ? `${p.price.toFixed(2).replace(".", ",")} €` : null, p.ean ? `EAN ${p.ean}` : null]
    .filter(Boolean)
    .join(" · ");

async function readProduct(page) {
  const product = parseProductPage(await page.content(), page.url());
  if (!product) log("   Couldn't read a product from this page (no product data found). Open the product's own page, not the search results.");
  return product;
}

async function main() {
  let cfg = readConfig();
  if (flag("--setup") || !cfg.appUrl || !cfg.helperKey) cfg = await setup(cfg);

  const list = opt("--list");
  const data = await api(cfg, `/api/helper/unmatched${list ? `?list=${encodeURIComponent(list)}` : ""}`);
  log(`\n🧺 ${data.list.name}: ${data.items.length} S-market item(s) without a real S-kaupat product`);
  for (const i of data.items) log(`   • ${i.nameFi}${i.household ? " (refill)" : ""}`);
  if (flag("--dry-run") || data.items.length === 0) return;

  const { ctx, page } = await openBrowser({ useChrome: !flag("--no-chrome") });
  await page.goto(SITE.home);
  await ask("Log in to S-kaupat in the browser window (if you aren't already) and select your store. Press Enter when ready.");

  const saved = [];
  const skipped = [];
  for (const [n, item] of data.items.entries()) {
    log(`\n[${n + 1}/${data.items.length}] ${item.nameFi}${item.displayName && item.displayName !== item.nameFi ? ` (${item.displayName})` : ""}`);
    await page.goto(SITE.search(item.nameFi), { waitUntil: "domcontentloaded" }).catch(() => {});
    let first = null;
    while (!first) {
      const a = (await ask("Open the product you want in the browser, then press Enter.  s = skip · q = stop:")).trim().toLowerCase();
      if (a === "q") return finish(ctx, saved, skipped.concat(data.items.slice(n).map((i) => i.nameFi)));
      if (a === "s") break;
      first = await readProduct(page);
      if (first) {
        const ok = (await ask(`${describe(first)}\n   Save as 1st choice? Enter = yes, n = pick again:`)).trim().toLowerCase();
        if (ok === "n") first = null;
      }
    }
    if (!first) {
      skipped.push(item.nameFi);
      continue;
    }
    await api(cfg, "/api/helper/products", { method: "POST", body: JSON.stringify({ nameFi: item.nameFi, rank: 1, product: first }) });
    saved.push(`${item.nameFi} → ${first.name}`);
    log("   ✓ saved as 1st choice");

    const two = (await ask("2nd choice for when it's sold out? Open it and type 2 + Enter, or just Enter to go on:")).trim();
    if (two === "2") {
      const second = await readProduct(page);
      if (second && second.externalId !== first.externalId) {
        await api(cfg, "/api/helper/products", { method: "POST", body: JSON.stringify({ nameFi: item.nameFi, rank: 2, product: second }) });
        log(`   ✓ 2nd choice: ${describe(second)}`);
      } else if (second) log("   That's the same product as the 1st choice; no 2nd choice saved.");
    }
  }
  return finish(ctx, saved, skipped);
}

async function finish(ctx, saved, skipped) {
  log(`\n✅ Saved ${saved.length} product(s) in Aitta.`);
  for (const s of saved) log(`   • ${s}`);
  if (skipped.length) log(`   Skipped: ${skipped.join(", ")}`);
  log('   Your current list uses them already. Next: npm run cart -- "<share link>"');
  await ctx.close();
}

main()
  .catch((e) => {
    console.error(`\n❌ ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
