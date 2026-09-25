// Everything specific to the s-kaupat.fi website lives here.
//
// STATUS: UNVERIFIED. s-kaupat.fi could not be opened from the environment this
// was built in, so these URLs and button texts are educated guesses based on
// how Finnish web shops usually label things. Every step is written so that if
// a guess fails, the helper pauses and asks you to do that one step by hand in
// the open browser, then carries on. Fix the guesses here after the first run
// (see helper/README.md → "Calibrating").
import { isForbidden } from "./plan.mjs";

export const SITE = {
  home: "https://www.s-kaupat.fi/",
  cart: "https://www.s-kaupat.fi/ostoskori", // UNVERIFIED
  /** Search results page for a query (EAN, product id or name). UNVERIFIED */
  search: (q) => `https://www.s-kaupat.fi/tuotteet?queryString=${encodeURIComponent(q)}`,
  text: {
    addToCart: /lisää (ostos)?koriin|lisää$|add to (cart|basket)/i,
    increase: /lisää yksi|kasvata|increase|^\+$/i,
    soldOut: /loppu|ei saatavilla|tilapäisesti|sold out|not available/i,
    toCheckout: /siirry kassalle|kassalle|jatka tilaukseen|to checkout/i,
    homeDelivery: /kotiinkuljetus|kotiinkuljetuksena|home delivery/i,
    pickup: /nouto|noutona|pickup/i,
  },
};

/** Click only if the element's text is allowed; never order or pay. */
export async function safeClick(locator) {
  const text = (await locator.innerText().catch(() => "")) || (await locator.getAttribute("aria-label").catch(() => "")) || "";
  if (isForbidden(text)) throw new Error(`Refusing to click "${text}": placing the order is yours to do.`);
  await locator.click();
}

/**
 * Try to add one product. Returns "added" | "sold_out" | "not_found".
 * Throws on unexpected page structure (the caller then asks you to do it).
 */
export async function addProduct(page, choice, quantity) {
  await page.goto(SITE.search(choice.query), { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const main = page.locator("main").first();
  const scope = (await main.count()) ? main : page.locator("body");
  const addButtons = scope.getByRole("button", { name: SITE.text.addToCart });
  if ((await addButtons.count()) === 0) {
    const bodyText = await scope.innerText().catch(() => "");
    return SITE.text.soldOut.test(bodyText) ? "sold_out" : "not_found";
  }
  // First search hit. With an EAN query the first hit should be the product.
  await safeClick(addButtons.first());
  for (let i = 1; i < quantity; i++) {
    await page.waitForTimeout(400);
    const plus = scope.getByRole("button", { name: SITE.text.increase }).first();
    if (!(await plus.count())) throw new Error("quantity button not found");
    await safeClick(plus);
  }
  return "added";
}

/** Go to the cart and on to delivery selection, stopping before payment. */
export async function openCheckout(page) {
  await page.goto(SITE.cart, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  const next = page.getByRole("button", { name: SITE.text.toCheckout }).or(page.getByRole("link", { name: SITE.text.toCheckout }));
  if (!(await next.count())) throw new Error("checkout button not found");
  await safeClick(next.first());
  await page.waitForTimeout(2000);
}

export async function chooseMode(page, mode) {
  const re = mode === "pickup" ? SITE.text.pickup : SITE.text.homeDelivery;
  const opt = page.getByRole("radio", { name: re }).or(page.getByRole("button", { name: re })).or(page.getByRole("tab", { name: re }));
  if (!(await opt.count())) throw new Error("delivery method option not found");
  await safeClick(opt.first());
  await page.waitForTimeout(1500);
}

/** Visible slot candidates as {label, locator}. UNVERIFIED structure. */
export async function listSlots(page) {
  const candidates = page.getByRole("radio").or(page.getByRole("button", { name: /\d{1,2}[.:]\d{2}\s*[-–]\s*\d{1,2}[.:]\d{2}/ }));
  const n = await candidates.count();
  const out = [];
  for (let i = 0; i < Math.min(n, 80); i++) {
    const loc = candidates.nth(i);
    const label = ((await loc.getAttribute("aria-label").catch(() => null)) || (await loc.innerText().catch(() => "")) || "").trim();
    if (/\d{1,2}[.:]?\d{0,2}\s*[-–]\s*\d{1,2}/.test(label) && !(await loc.isDisabled().catch(() => false))) out.push({ label, locator: loc });
  }
  return out;
}
