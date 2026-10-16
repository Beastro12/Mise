import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { addEntry, getProfile, listEntries, listHealth, recentFoods, saveHealthDays, setProfile, weekView } from "@/lib/services/nutrition";
import { DEFAULT_PROFILE } from "@/lib/domain/nutrition";
import { assertMigrationsPresent } from "@/db";

// Real services against a throwaway embedded Postgres (migrated + seeded on first use).
const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aitta-food-"));
process.env.PGLITE_DIR = dir;
delete process.env.DATABASE_URL;

const blank = { activeKcal: null, basalKcal: null, totalKcal: null, steps: null, weightKg: null, intakeKcal: null };

describe("calorie tracker against the database", () => {
  afterAll(() => fs.rmSync(dir, { recursive: true, force: true }));

  it("stores the profile in settings", async () => {
    expect((await getProfile()).saved).toBe(false);
    await setProfile({ ...DEFAULT_PROFILE, weightKg: 90, deficitKcal: 400 });
    expect(await getProfile()).toMatchObject({ weightKg: 90, deficitKcal: 400, saved: true });
  });

  it("validates and logs food entries", async () => {
    await expect(addEntry({ day: "2026-09-28", meal: "lunch", name: " ", kcal: 100 })).rejects.toThrow();
    await expect(addEntry({ day: "2026-09-28", meal: "lunch", name: "x", kcal: -5 })).rejects.toThrow();
    for (const day of ["2026-09-28", "2026-09-29", "2026-09-30"]) {
      await addEntry({ day, meal: "breakfast", name: "Kaurapuuro", portion: "3 dl", kcal: 350 });
      await addEntry({ day, meal: "dinner", name: "Lohikeitto", portion: "5 dl", kcal: 900 });
      await addEntry({ day, meal: "snack", name: "Pulla", kcal: 400 });
    }
    expect(await listEntries("2026-09-28", "2026-09-28")).toHaveLength(3);
    expect((await recentFoods()).map((f) => f.name).sort()).toEqual(["Kaurapuuro", "Lohikeitto", "Pulla"]);
  });

  it("upserts tracker days per source", async () => {
    await saveHealthDays("apple", [{ day: "2026-09-28", ...blank, activeKcal: 500, basalKcal: 1900 }]);
    await saveHealthDays("apple", [{ day: "2026-09-28", ...blank, activeKcal: 600, basalKcal: 1900, steps: 8000 }]);
    await saveHealthDays("oura", [{ day: "2026-09-28", ...blank, totalKcal: 2700 }]);
    const rows = await listHealth("2026-09-28", "2026-09-28");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.source === "apple")).toMatchObject({ activeKcal: 600, steps: 8000 });
  });

  it("summarises the week and plans the next one at a deficit", async () => {
    const v = await weekView("2026-09-28");
    expect(v.summary.loggedDays).toBe(3);
    expect(v.summary.avgIntake).toBe(1650);
    expect(v.plan!.days[0].day).toBe("2026-10-05");
    expect(v.target.deficit).toBe(400);
    // Burn: 2500 from Apple on the 28th, the profile estimate (1855 × 1.375 = 2551) on the other days.
    expect(v.summary.avgBurn).toBe(Math.round((2500 + 2551 * 6) / 7));
    expect(v.target.target).toBe(v.summary.avgBurn - 400);
    // 1650 kcal/day is already under that target, so the plan keeps the usual meals.
    expect(v.plan!.dailyCut).toBe(0);
    expect(v.plan!.days.every((d) => d.kcal === 1650)).toBe(true);
  });
});

describe("assertMigrationsPresent", () => {
  it("names the folder and DB_AUTO_MIGRATE when drizzle/ is missing", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "aitta-nomig-"));
    try {
      expect(() => assertMigrationsPresent(empty)).toThrow(/drizzle\//);
      expect(() => assertMigrationsPresent(empty)).toThrow(/DB_AUTO_MIGRATE/);
    } finally {
      fs.rmSync(empty, { recursive: true, force: true });
    }
  });

  it("accepts the repo's drizzle/ folder", () => {
    expect(() => assertMigrationsPresent(path.join(process.cwd(), "drizzle"))).not.toThrow();
  });
});
