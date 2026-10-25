import { expect, test, type Page } from "@playwright/test";
import path from "node:path";

/**
 * Calories: profile setup, Apple Health + Oura import, meal logging (the meal picker must keep
 * its selection between submits) and the week plan. All dates are explicit: the server pages
 * use the server's clock, the importer uses the browser's.
 */

// Last day of the fixtures (a Sunday); must match ANCHOR in tests/fixtures/calories/generate.mjs.
// Not imported: Playwright loads specs as CommonJS and cannot require that .mjs file.
const ANCHOR = "2026-10-04";
const FIX = path.join(__dirname, "..", "fixtures", "calories");
const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
};
// ANCHOR is a Sunday, so the Monday of its week is 6 days earlier.
const MONDAY = addDays(ANCHOR, -6);

async function login(page: Page) {
  await page.goto("/plan");
  await expect(page).toHaveURL(/\/login/);
  await page.fill('input[name="passcode"]', "e2e-passcode");
  await page.click('button:has-text("Open")');
  await expect(page).toHaveURL(/\/plan$/);
}

const PROFILE = { sex: "female", age: "41", heightCm: "168", weightKg: "72.5", activity: "1.55", deficitKcal: "400", energySource: "oura" };

async function logTwice(page: Page, day: string, meal: "lunch" | "dinner", label: string, foods: Array<[string, string]>) {
  await page.goto(`/food?day=${day}`);
  const btn = page.locator(`[data-testid="meal-${meal}"]`);
  await btn.click(); // picked once only
  for (const [name, kcal] of foods) {
    await page.fill('[data-testid="food-name"]', name);
    await page.fill('[data-testid="food-kcal"]', kcal);
    await page.click('[data-testid="food-add"]');
    const section = page.locator("section").filter({ has: page.getByRole("heading", { name: `${label} ·` }) });
    await expect(section.getByText(name, { exact: true })).toBeVisible();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator('[data-testid="food-name"]')).toHaveValue("");
  }
}

test("calories: setup → import → log meals → week plan", async ({ page }) => {
  await login(page);

  // 1. Setup: save the profile, reload, every value persisted.
  await page.goto("/food/setup");
  await page.selectOption('select[name="sex"]', PROFILE.sex);
  await page.fill('input[name="age"]', PROFILE.age);
  await page.fill('input[name="heightCm"]', PROFILE.heightCm);
  await page.fill('input[name="weightKg"]', PROFILE.weightKg);
  await page.selectOption('select[name="activity"]', PROFILE.activity);
  await page.fill('[data-testid="deficit"]', PROFILE.deficitKcal);
  await page.selectOption('select[name="energySource"]', PROFILE.energySource);
  await page.click('[data-testid="save-profile"]');
  await expect(page.locator('[data-testid="deficit"]')).toHaveValue(PROFILE.deficitKcal);
  await page.reload();
  await expect(page.locator('select[name="sex"]')).toHaveValue(PROFILE.sex);
  await expect(page.locator('input[name="age"]')).toHaveValue(PROFILE.age);
  await expect(page.locator('input[name="heightCm"]')).toHaveValue(PROFILE.heightCm);
  await expect(page.locator('input[name="weightKg"]')).toHaveValue(PROFILE.weightKg);
  await expect(page.locator('select[name="activity"]')).toHaveValue(PROFILE.activity);
  await expect(page.locator('[data-testid="deficit"]')).toHaveValue(PROFILE.deficitKcal);
  await expect(page.locator('select[name="energySource"]')).toHaveValue(PROFILE.energySource);

  // 2. Import. The importer drops days older than 120 days by the browser clock, so pin it
  // to the day after the fixtures end.
  await page.clock.setSystemTime(new Date(`${addDays(ANCHOR, 1)}T12:00:00Z`));
  await page.setInputFiles('[data-testid="apple-file"]', path.join(FIX, "apple-export.zip"));
  await expect(page.getByText("Saved 10 days from Apple Health.")).toBeVisible();
  await page.setInputFiles('[data-testid="oura-file"]', path.join(FIX, "oura-daily.csv"));
  await expect(page.getByText("Saved 10 days from Oura.")).toBeVisible();

  // 3. Logging: the meal picker keeps its selection across submits.
  const d1 = addDays(MONDAY, 1);
  const d2 = addDays(MONDAY, 2);
  await logTwice(page, d1, "lunch", "Lunch", [["Testikeitto", "450"], ["Testileipa", "200"]]);
  await logTwice(page, d1, "dinner", "Dinner", [["Testipasta", "700"], ["Testisalaatti", "150"]]);
  await logTwice(page, d2, "lunch", "Lunch", [["Testiwrap", "520"], ["Testihedelma", "90"]]);
  await logTwice(page, d2, "dinner", "Dinner", [["Testikala", "650"], ["Testiperuna", "220"]]);

  // 4. Week plan for the ANCHOR week.
  await page.goto(`/food/week?start=${MONDAY}`);
  await expect(page.locator('[data-testid="deficit-plan"] > *')).toHaveCount(7);
  const target = Number(await page.locator("span", { hasText: /^Target\s/ }).locator("b").first().innerText());
  const burned = Number(await page.locator('[data-testid="week-stats"] > div', { hasText: "Burned / day" }).locator("div.font-display").innerText());
  expect(target).toBeGreaterThan(0);
  expect(target).toBeLessThan(burned);
  await expect(page.locator('[data-testid="plan-meal"]', { hasText: /Testi/ }).first()).toBeVisible();
});
