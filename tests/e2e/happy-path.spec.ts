import { expect, test, type Page } from "@playwright/test";

/**
 * Happy path from the brief:
 * import a recipe from a URL → plan 3 meals → generate list → split by store →
 * check off items → items land in the pantry.
 * Plus: share link sync, product mapping, export, offline check-off.
 */

const FIXTURE_URL = "http://127.0.0.1:4599/kermaperunat.html";

async function login(page: Page) {
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="passcode"]', "e2e-passcode");
  await page.click('button:has-text("Open")');
  await expect(page).toHaveURL(/\/plan$/);
}

const item = (page: Page, store: "smarket" | "lidl", nameFi: string) =>
  page.locator(`[data-testid="store-${store}"] [data-testid="list-item"][data-name="${nameFi}"]`);

test("import → plan → list → split → check off → pantry", async ({ page, browser }) => {
  await login(page);

  // 1. Import a recipe from a URL (schema.org JSON-LD) and review it.
  await page.goto("/recipes/import");
  await page.fill('input[name="url"]', FIXTURE_URL);
  await page.click('button:has-text("Import")');
  await expect(page).toHaveURL(/\/recipes\/import\/[0-9a-f-]+$/);
  await expect(page.locator('[data-testid="ingredient-row"]')).toHaveCount(7);
  const finnish = await page.locator('input[aria-label="Finnish name"]').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
  expect(finnish).toEqual(["peruna", "sipuli", "kuohukerma", "kermaviili", "makkara", "suola", "mustapippuri"]);
  // "1 cup sour cream" → metric, original kept
  await expect(page.getByText("Original: 1 cup sour cream")).toBeVisible();
  await page.click('[data-testid="save-recipe"]');
  await expect(page.locator('[data-testid="saved-link"]')).toBeVisible();

  // 2. This week's Lidl offers (pasted leaflet text, parsed locally without Claude).
  await page.goto("/stores/lidl");
  await page.click('button:has-text("Paste text")');
  await page.fill('[data-testid="offers-text"]', "Kermaviili 10 % 200 g 0,49 €\nTuore lohifilee 400 g 5,99 €");
  await page.click('[data-testid="import-offers"]');
  await expect(page.getByText("Added 2 offers")).toBeVisible();
  await expect(page.locator('[data-testid="offers"] li')).toHaveCount(2);

  // 3. Plan 3 meals (pick mode).
  await page.goto("/plan");
  await page.click('[data-testid="new-plan"]');
  await expect(page).toHaveURL(/\/plan\/[0-9a-f-]+$/);
  for (const title of ["Kermaperunat ja uunimakkara", "Lohikeitto", "Broilerikastike"]) {
    await page.locator(`[data-testid="add-meal"][data-title="${title}"]`).click();
    await expect(page.locator('[data-testid="meal"]').filter({ hasText: title })).toBeVisible();
  }
  await expect(page.locator('[data-testid="meal"]')).toHaveCount(3);

  // 4. Generate the list and check the store split.
  await page.click('[data-testid="generate-list"]');
  await expect(page).toHaveURL(/\/list\/[0-9a-f-]+$/);
  const listUrl = page.url();
  await expect(page.locator('[data-testid="checklist"]')).toBeVisible();

  // Lidl: only items on a Lidl offer, with the reason shown.
  await expect(item(page, "lidl", "lohi")).toBeVisible();
  await expect(item(page, "lidl", "lohi").locator('[data-testid="store-reason"]')).toHaveText(/^Lidl offer until \w{3}.*5,99 €$|^Lidl offer until \d+\.\d+\..*5,99 €$/);
  await expect(item(page, "lidl", "kermaviili")).toBeVisible();
  // Everything else defaults to S-market.
  for (const n of ["peruna", "sipuli", "kuohukerma", "makkara", "broilerin suikale", "kerma"]) {
    await expect(item(page, "smarket", n)).toBeVisible();
  }
  // Merged across recipes: peruna 800 g (kermaperunat 4→2 serv = 400 g) + lohikeitto 300 g → 700 g
  await expect(item(page, "smarket", "peruna")).toContainText("700 g");
  // Staples ask instead of being added
  await expect(page.locator('[data-testid="have-it"]')).toContainText("Suola");

  // Sections follow the store's walking order.
  const sectionOrder = await page
    .locator('[data-testid="store-smarket"] [data-testid^="section-smarket-"]')
    .evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")!.replace("section-smarket-", "")));
  const expected = ["hedelmat_vihannekset", "leipa", "liha_kala", "maito_juusto", "kuivatuotteet", "pakasteet", "juomat", "muut"];
  expect(sectionOrder).toEqual(expected.filter((k) => sectionOrder.includes(k)));

  // 5a. First-time matching queue: each unmatched S-market ingredient with its top 3 candidates.
  await page.click('[data-testid="match-queue"]');
  await expect(page).toHaveURL(/\/products\/match\?list=/);
  const perunaCard = page.locator("li", { has: page.locator("span.font-semibold", { hasText: /^peruna$/ }) });
  await expect(perunaCard.getByRole("button", { name: "Use" })).toHaveCount(2); // mock catalogue has 2 potato products
  await page.goto(listUrl);

  // 5b. Match a product for kerma from the item menu (mock S-kaupat adapter) → packs shown.
  await item(page, "smarket", "kerma").locator('[data-testid="item-options"]').click();
  await page.getByRole("link", { name: "Match product" }).click();
  await expect(page.locator('[data-testid="candidates"] li')).toHaveCount(3);
  await page.locator('[data-testid="pick-product"]').first().click();
  await expect(page).toHaveURL(listUrl);
  await expect(item(page, "smarket", "kerma")).toContainText("×");

  // 6. Check off items.
  for (const [store, n] of [["smarket", "peruna"], ["lidl", "lohi"], ["smarket", "kerma"]] as const) {
    await item(page, store, n).locator("button[aria-pressed]").click();
    await expect(item(page, store, n)).toHaveAttribute("data-checked", "1");
  }

  // 7. Spouse opens the share link (no passcode) and sees + makes check-offs.
  const token = await page.evaluate(async (url) => {
    const res = await fetch(`/api/lists/${url.split("/").pop()}`);
    return (await res.json()).shareToken as string;
  }, listUrl);
  const spouse = await browser.newContext();
  const sp = await spouse.newPage();
  await sp.goto(`/share/${token}`);
  await expect(item(sp, "lidl", "lohi")).toHaveAttribute("data-checked", "1");
  await item(sp, "smarket", "sipuli").locator("button[aria-pressed]").click();
  await expect(item(sp, "smarket", "sipuli")).toHaveAttribute("data-checked", "1");
  // Owner's page picks it up via polling.
  await expect(item(page, "smarket", "sipuli")).toHaveAttribute("data-checked", "1", { timeout: 20_000 });
  // Share link can't do owner actions.
  expect(await sp.locator('[data-testid="item-options"]').count()).toBe(0);
  await spouse.close();

  // 8. Export S-market list JSON (seam for cart automation).
  const exported = await page.evaluate(async (url) => (await fetch(`/api/lists/${url.split("/").pop()}/export`)).json(), listUrl);
  expect(exported.items.some((i: { ingredient: string; quantity: number }) => i.ingredient === "kerma" && i.quantity >= 1)).toBe(true);

  // 9. Checked items → pantry in one tap.
  await page.click('[data-testid="to-pantry"]');
  await expect(page.locator('[data-testid="list-message"]')).toContainText("Moved 4 item(s)");
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/list.png`, fullPage: true });
  await page.goto("/pantry");
  for (const n of ["peruna", "lohi", "kerma", "sipuli"]) {
    await expect(page.locator(`[data-testid="pantry-item"][data-name="${n}"]`)).toBeVisible();
  }
});

test("offline check-off is kept and synced", async ({ page, context }) => {
  await login(page);
  // Reuse the list from the previous test.
  await page.goto("/list");
  await expect(page).toHaveURL(/\/list\/[0-9a-f-]+$/);
  const listUrl = page.url();
  // Let the service worker take control, then load once more so the page is cached.
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.reload();

  await context.setOffline(true);
  const target = item(page, "smarket", "makkara");
  await target.locator("button[aria-pressed]").click();
  await expect(target).toHaveAttribute("data-checked", "1");
  await expect(page.getByText("1 to sync")).toBeVisible();

  // Reload while offline: served from the service worker cache, check-off restored from local storage.
  await page.reload();
  await expect(item(page, "smarket", "makkara")).toHaveAttribute("data-checked", "1");

  await context.setOffline(false);
  await expect(page.getByText("to sync")).toHaveCount(0, { timeout: 20_000 });
  const serverState = await page.evaluate(async (url) => (await fetch(`/api/lists/${url.split("/").pop()}`)).json(), listUrl);
  const makkara = serverState.items.find((i: { nameFi: string }) => i.nameFi === "makkara");
  expect(makkara.checked).toBe(true);
});
