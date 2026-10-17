import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE,
  bmr,
  dailyBurn,
  deficitTarget,
  mealBudgets,
  mealTemplates,
  planDeficitWeek,
  scalePortion,
  summarizeWeek,
  type FoodEntry,
  type HealthDay,
  type Profile,
} from "@/lib/domain/nutrition";

const me: Profile = { ...DEFAULT_PROFILE, sex: "male", age: 35, heightCm: 180, weightKg: 85, activity: 1.375, deficitKcal: 500 };
const hd = (day: string, source: "apple" | "oura", v: Partial<HealthDay>): HealthDay => ({
  day,
  source,
  activeKcal: null,
  basalKcal: null,
  totalKcal: null,
  steps: null,
  weightKg: null,
  ...v,
});

describe("energy burned", () => {
  it("uses Mifflin–St Jeor for resting energy", () => {
    expect(bmr(me)).toBe(1805); // 850 + 1125 − 175 + 5
    expect(bmr({ ...me, sex: "female" })).toBe(1639);
  });

  it("picks one source per day and never adds Apple and Oura together", () => {
    const rows = [hd("2026-09-28", "apple", { basalKcal: 1800, activeKcal: 600 }), hd("2026-09-28", "oura", { totalKcal: 2700 })];
    expect(dailyBurn(rows, me)).toMatchObject({ kcal: 2400, source: "apple" });
    expect(dailyBurn(rows, { ...me, energySource: "oura" })).toMatchObject({ kcal: 2700, source: "oura" });
    expect(dailyBurn(rows, { ...me, energySource: "estimate" })).toMatchObject({ kcal: Math.round(1805 * 1.375), source: "estimate" });
  });

  it("fills a missing resting value (no Apple Watch) from the formula", () => {
    expect(dailyBurn([hd("2026-09-28", "apple", { activeKcal: 300 })], me).kcal).toBe(1805 + 300);
  });

  it("falls back to Oura, then the estimate", () => {
    expect(dailyBurn([hd("2026-09-28", "oura", { totalKcal: 2600 })], me)).toMatchObject({ kcal: 2600, source: "oura" });
    expect(dailyBurn([], me).source).toBe("estimate");
  });
});

describe("deficit target", () => {
  it("subtracts the wanted deficit", () => {
    expect(deficitTarget(2500, me)).toEqual({ target: 2000, deficit: 500, limitedBy: null });
  });
  it("caps the deficit at 25 % of burn and 1000 kcal", () => {
    expect(deficitTarget(2000, { ...me, deficitKcal: 800 })).toMatchObject({ target: 1500, deficit: 500 });
    expect(deficitTarget(4400, { ...me, deficitKcal: 1500 })).toMatchObject({ deficit: 1000, limitedBy: "capped at 1000 kcal/day" });
  });
  it("never targets below 1500 (men) / 1200 (women)", () => {
    expect(deficitTarget(1700, me)).toMatchObject({ target: 1500, deficit: 200 });
    expect(deficitTarget(1300, { ...me, sex: "female" })).toMatchObject({ target: 1200, deficit: 100 });
    expect(deficitTarget(1100, { ...me, sex: "female" })).toMatchObject({ target: 1100, deficit: 0 });
  });
});

describe("portion scaling", () => {
  it("scales the leading number and rounds sensibly", () => {
    expect(scalePortion("150 g", 0.8)).toBe("120 g");
    expect(scalePortion("3 dl", 0.75)).toBe("2,25 dl");
    expect(scalePortion("4 dl", 0.9)).toBe("3,5 dl");
    expect(scalePortion("1 annos", 0.9)).toBe("1 annos × 90 %");
    expect(scalePortion("2 slices", 0.5)).toBe("1 slices");
    expect(scalePortion("1,5 dl", 1)).toBe("1,5 dl");
    expect(scalePortion("a bowl", 0.8)).toBe("a bowl × 80 %");
    expect(scalePortion(null, 0.7)).toBe("70 % of usual");
    expect(scalePortion(null, 1)).toBeNull();
  });
});

// A logged week: porridge or yoghurt breakfasts, two lunches, two dinners, snacks.
const e = (day: string, meal: FoodEntry["meal"], name: string, kcal: number, portion: string | null = null): FoodEntry => ({ day, meal, name, kcal, portion });
const week: FoodEntry[] = [];
const days = ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"];
days.forEach((d, i) => {
  if (i % 2) week.push(e(d, "breakfast", "Jogurtti", 250, "2 dl"), e(d, "breakfast", "Mysli", 200, "50 g"));
  else week.push(e(d, "breakfast", "Kaurapuuro", 350, "3 dl"));
  week.push(i % 2 ? e(d, "lunch", "Kanasalaatti", 600) : e(d, "lunch", "Lohikeitto", 700, "4 dl"));
  week.push(i % 2 ? e(d, "dinner", "Jauhelihakastike ja pasta", 900, "400 g") : e(d, "dinner", "Uunilohi ja perunat", 800));
  week.push(e(d, "snack", "Suklaa", 300, "60 g"));
});

describe("week summary", () => {
  it("averages intake over logged days only and splits it by meal", () => {
    const health = days.map((d) => hd(d, "apple", { basalKcal: 1800, activeKcal: 600 }));
    const s = summarizeWeek("2026-09-28", week, health, me);
    expect(s.loggedDays).toBe(5);
    // per day: 350/450 + 700/600 + 800/900 + 300 → (2150 × 3 + 2250 × 2) / 5
    expect(s.avgIntake).toBe(2190);
    expect(s.perMeal).toEqual({ breakfast: 390, lunch: 660, dinner: 840, snack: 300 });
    expect(s.avgBalance).toBe(2190 - 2400);
    expect(s.topFoods.snack[0]).toEqual({ name: "Suklaa", times: 5, kcal: 300 });
    // Sat + Sun have no tracker data, so they use the estimate.
    expect(s.days[6].burn.source).toBe("estimate");
  });
});

describe("deficit plan", () => {
  it("groups a day's meal into one template and counts repeats", () => {
    const t = mealTemplates(week).filter((x) => x.meal === "breakfast");
    expect(t.map((x) => [x.kcal, x.times]).sort()).toEqual([
      [350, 3],
      [450, 2],
    ]);
  });

  it("cuts snacks first and no meal by more than 35 %", () => {
    const { budgets, uncut } = mealBudgets({ breakfast: 400, lunch: 600, dinner: 800, snack: 300 }, 500);
    expect(uncut).toBe(0);
    expect(budgets.breakfast + budgets.lunch + budgets.dinner + budgets.snack).toBe(1600);
    expect(300 - budgets.snack).toBeGreaterThan(400 - budgets.breakfast); // snack takes more than its size share
    for (const m of ["breakfast", "lunch", "dinner"] as const) expect(budgets[m]).toBeGreaterThanOrEqual(Math.round([400, 600, 800][["breakfast", "lunch", "dinner"].indexOf(m)] * 0.65));
  });

  it("reports the part of a cut that doesn't fit", () => {
    const { budgets, uncut } = mealBudgets({ breakfast: 400, lunch: 0, dinner: 600, snack: 100 }, 800);
    expect(budgets.snack).toBe(0);
    expect(budgets.breakfast).toBe(260);
    expect(budgets.dinner).toBe(390);
    expect(uncut).toBe(800 - 100 - 140 - 210);
  });

  it("plans 7 days from your own meals, close to the target", () => {
    const plan = planDeficitWeek({ startDay: "2026-10-05", entries: week, loggedDays: 5, target: 1900 });
    expect(plan.usualIntake).toBe(2190);
    expect(plan.dailyCut).toBe(290);
    expect(plan.days).toHaveLength(7);
    expect(plan.days[0].day).toBe("2026-10-05");
    const names = new Set(week.map((x) => x.name));
    for (const d of plan.days) {
      expect(Math.abs(d.kcal - 1900)).toBeLessThan(120);
      for (const m of d.meals) for (const it of m.items) expect(names.has(it.name)).toBe(true);
    }
    // Rotates between the meals you eat rather than one meal seven times.
    const dinners = new Set(plan.days.map((d) => d.meals.find((m) => m.meal === "dinner")!.template!.key));
    expect(dinners.size).toBe(2);
    // Snack portion shrinks and its grams are scaled.
    const snack = plan.days[0].meals.find((m) => m.meal === "snack")!;
    expect(snack.factor).toBeLessThan(1);
    expect(snack.items[0].portion).toMatch(/^\d+ g$/);
  });

  it("keeps usual portions when you're already under the target", () => {
    const plan = planDeficitWeek({ startDay: "2026-10-05", entries: week, loggedDays: 5, target: 2600 });
    expect(plan.dailyCut).toBe(0);
    expect(plan.notes[0]).toMatch(/already average/);
    expect(plan.days.every((d) => d.meals.every((m) => m.factor === 1))).toBe(true);
  });
});
