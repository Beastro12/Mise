#!/usr/bin/env node
// Aitta → S-kaupat cart helper. Runs on your own Mac.
//
//   npm run cart -- "https://<your-aitta>/share/<token>"
//
// 1. Reads the week's S-market items from Aitta (via the list's share link).
// 2. Opens a real browser window (your installed Google Chrome). You log in to
//    S-kaupat yourself; the login is remembered in ~/.aitta/skaupat-profile.
// 3. Adds each product (2nd choice if the first is sold out), sets quantities.
// 4. Goes to checkout and pre-selects home delivery on your preferred day/time.
// 5. STOPS. You check the cart and slot, and place the order yourself.
//
// It never stores your password and never presses "order" or "pay".
// Options: --dry-run (only print the plan)  --no-chrome (use Playwright's Chromium)
import { openBrowser, prompter } from "./lib/local.mjs";
import { chooseSlot, planCart } from "./lib/plan.mjs";
import { SITE, addProduct, chooseMode, listSlots, openCheckout, safeClick } from "./lib/site-skaupat.mjs";

const args = process.argv.slice(2);
const shareUrl = args.find((a) => !a.startsWith("--"));
const dryRun = args.includes("--dry-run");
const useChrome = !args.includes("--no-chrome");
const WD = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const { ask, close } = await prompter();
const log = (...m) => console.log(...m);

function orderUrl(share) {
  const u = new URL(share);
  const token = u.pathname.split("/").filter(Boolean).pop();
  if (!u.pathname.includes("/share/") || !token) throw new Error("Pass the list's share link, e.g. https://aitta.example/share/AbC…");
  return `${u.origin}/api/share/${token}/order`;
}

async function main() {
  if (!shareUrl) {
    log('Usage: npm run cart -- "https://<your-aitta>/share/<token>" [--dry-run]');
    process.exit(1);
  }
  const res = await fetch(orderUrl(shareUrl));
  if (!res.ok) throw new Error(`Could not read the list from Aitta (HTTP ${res.status}).`);
  const order = await res.json();
  const { steps, missing } = planCart(order);
  const d = order.delivery;

  log(`\n🧺 ${order.list.name}: ${steps.length} products to add at ${order.store?.name ?? "S-market"}`);
  for (const s of steps) log(`   • ${s.ingredient} × ${s.quantity}: ${s.choices.map((c) => c.name).join("  →  2nd: ")}`);
  if (missing.length) {
    log(`\n⚠️  Not added automatically (${missing.length}):`);
    for (const m of missing) log(`   • ${m.ingredient}: ${m.reason}`);
  }
  log(`\n🚚 ${d.mode === "pickup" ? "Pickup" : "Home delivery"}, preferred ${WD[d.weekday]} ${d.windowStart}–${d.windowEnd}`);
  if (dryRun) return;

  const { ctx, page } = await openBrowser({ useChrome });
  await page.goto(SITE.home);
  await ask(
    "Log in to S-kaupat in the browser window and make sure your store is selected.\n   If the cart still has items from an earlier run, empty it first: quantities are added on top. Press Enter when ready.",
  );

  const added = [];
  const viaSecond = [];
  const manual = [];
  const skipped = [...missing.map((m) => m.ingredient)];

  for (const step of steps) {
    let done = false;
    for (const [i, choice] of step.choices.entries()) {
      try {
        const r = await addProduct(page, choice, step.quantity);
        if (r === "added") {
          (i === 0 ? added : viaSecond).push(`${step.ingredient} (${choice.name} × ${step.quantity})`);
          done = true;
          break;
        }
        log(`   ${step.ingredient}: ${choice.name} ${r === "sold_out" ? "sold out" : "not found"}${i + 1 < step.choices.length ? ", trying 2nd choice" : ""}`);
      } catch (e) {
        log(`   ${step.ingredient}: automatic add failed (${e.message})`);
      }
    }
    if (!done) {
      const a = await ask(`Please add "${step.ingredient}" × ${step.quantity} by hand (search: ${step.choices[0].query}). Enter = done, s = skip:`);
      if (a.trim().toLowerCase() === "s") skipped.push(step.ingredient);
      else manual.push(step.ingredient);
    }
  }

  // Checkout: delivery method + slot. Each step falls back to asking you.
  try {
    await openCheckout(page);
  } catch (e) {
    await ask(`Couldn't open checkout automatically (${e.message}). Go to the cart and on to delivery selection, then press Enter.`);
  }
  try {
    await chooseMode(page, d.mode);
  } catch {
    await ask(`Choose ${d.mode === "pickup" ? "pickup" : "home delivery"} in the browser, then press Enter.`);
  }
  let slotNote;
  try {
    const slots = await listSlots(page);
    const pick = chooseSlot(slots.map((s) => s.label), d);
    if (!pick) throw new Error("no slots visible");
    await safeClick(slots[pick.index].locator);
    slotNote = `${slots[pick.index].label} (${pick.match})`;
  } catch (e) {
    await ask(`Pick a delivery slot in the browser (preferred ${WD[d.weekday]} ${d.windowStart}–${d.windowEnd}), then press Enter. [${e.message}]`);
    slotNote = "chosen by you";
  }

  log("\n✅ Cart prepared. Nothing has been ordered.");
  log(`   Added: ${added.length}${viaSecond.length ? `, via 2nd choice: ${viaSecond.length}` : ""}${manual.length ? `, by you: ${manual.length}` : ""}`);
  if (viaSecond.length) log(`   2nd choices: ${viaSecond.join("; ")}`);
  if (skipped.length) log(`   Not in cart: ${skipped.join(", ")}`);
  log(`   Delivery: ${slotNote}`);
  if (d.substitutions === "store") log("   Replacements: you chose S-kaupat's own setting; check it in the cart before ordering.");
  await ask("Review the cart and delivery in the browser and place the order yourself. Press Enter here to close the browser.");
  await ctx.close();
}

main()
  .catch((e) => {
    console.error(`\n❌ ${e.message}`);
    process.exitCode = 1;
  })
  .finally(() => close());
