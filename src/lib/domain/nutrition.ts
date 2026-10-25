/**
 * Calorie tracking: energy expenditure, deficit target, weekly summary and the
 * "similar week, fewer calories" plan. Pure functions, unit tested.
 */
import type { MealSlot } from "@/db/schema";
import { addDays } from "./offers";

export const MEALS: MealSlot[] = ["breakfast", "lunch", "dinner", "snack"];
export const MEAL_LABEL: Record<MealSlot, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snacks" };

/** Meal slot by Helsinki time of day, so logging right after eating needs one tap less. */
export function mealAt(now: Date = new Date()): MealSlot {
  const h = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Helsinki", hour: "2-digit", hourCycle: "h23" }).format(now));
  if (h < 10) return "breakfast";
  if (h < 14) return "lunch";
  if (h >= 17 && h < 21) return "dinner";
  return "snack";
}

/** ≈ energy in 1 kg of body fat; the usual rule of thumb for weekly weight change. */
export const KCAL_PER_KG = 7700;

export type Profile = {
  sex: "male" | "female";
  age: number;
  heightCm: number;
  weightKg: number;
  /** Multiplier on BMR when no tracker data: 1.2 sedentary … 1.725 very active. */
  activity: number;
  /** Wanted daily deficit in kcal (clamped by safeDeficit). */
  deficitKcal: number;
  /** Which tracker to trust when both exist for a day. */
  energySource: "auto" | "apple" | "oura" | "estimate";
};

export const DEFAULT_PROFILE: Profile = { sex: "male", age: 35, heightCm: 180, weightKg: 85, activity: 1.375, deficitKcal: 500, energySource: "auto" };

export const ACTIVITY_LEVELS = [
  { value: 1.2, label: "Sedentary (desk job, little exercise)" },
  { value: 1.375, label: "Light (exercise 1–3 days a week)" },
  { value: 1.55, label: "Moderate (3–5 days a week)" },
  { value: 1.725, label: "Very active (6–7 days a week)" },
];

/** Mifflin–St Jeor resting energy, kcal/day. */
export function bmr(p: Pick<Profile, "sex" | "age" | "heightCm" | "weightKg">): number {
  return Math.round(10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === "male" ? 5 : -161));
}

export function estimatedTdee(p: Profile): number {
  return Math.round(bmr(p) * p.activity);
}

export type HealthDay = {
  day: string;
  source: "apple" | "oura";
  activeKcal: number | null;
  basalKcal: number | null;
  totalKcal: number | null;
  steps: number | null;
  weightKg: number | null;
};

export type Burn = { kcal: number; source: "apple" | "oura" | "estimate"; detail: string };

function appleBurn(a: HealthDay | undefined, p: Profile): Burn | null {
  if (!a || a.activeKcal == null) return null;
  if (a.basalKcal) return { kcal: a.basalKcal + a.activeKcal, source: "apple", detail: `Apple Health: ${a.basalKcal} resting + ${a.activeKcal} active` };
  // No resting energy recorded (no Apple Watch): use the formula for the resting part.
  const rest = bmr(p);
  return { kcal: rest + a.activeKcal, source: "apple", detail: `${rest} resting (estimated) + ${a.activeKcal} active (Apple Health)` };
}

function ouraBurn(o: HealthDay | undefined): Burn | null {
  if (!o) return null;
  if (o.totalKcal) return { kcal: o.totalKcal, source: "oura", detail: `Oura: ${o.totalKcal} total` };
  return null;
}

/**
 * Energy burned on one day. Apple and Oura overlap (Oura also writes to Apple
 * Health), so one source is picked per day, never summed.
 */
export function dailyBurn(rows: HealthDay[], p: Profile): Burn {
  const apple = rows.find((r) => r.source === "apple");
  const oura = rows.find((r) => r.source === "oura");
  const estimate: Burn = { kcal: estimatedTdee(p), source: "estimate", detail: `Estimated from your profile (resting ${bmr(p)} × ${p.activity})` };
  if (p.energySource === "estimate") return estimate;
  const a = appleBurn(apple, p);
  const o = ouraBurn(oura);
  if (p.energySource === "oura") return o ?? a ?? estimate;
  return a ?? o ?? estimate; // "apple" and "auto"
}

/**
 * Safe deficit: at most 25 % of what you burn and never more than 1000 kcal/day,
 * and intake never below 1500 (men) / 1200 (women) kcal. Returns the reason
 * when the wanted deficit was reduced.
 */
export function deficitTarget(burn: number, p: Pick<Profile, "sex" | "deficitKcal">): { target: number; deficit: number; limitedBy: string | null } {
  const floor = p.sex === "male" ? 1500 : 1200;
  let deficit = Math.max(0, Math.round(p.deficitKcal));
  let limitedBy: string | null = null;
  const cap = Math.min(1000, Math.round(burn * 0.25));
  if (deficit > cap) {
    deficit = cap;
    limitedBy = cap === 1000 ? "capped at 1000 kcal/day" : "capped at 25 % of what you burn";
  }
  if (burn - deficit < floor) {
    deficit = Math.max(0, burn - floor);
    limitedBy = `intake kept at or above ${floor} kcal/day`;
  }
  return { target: Math.round(burn - deficit), deficit, limitedBy };
}

// ---------------------------------------------------------------------------
// Week summary
// ---------------------------------------------------------------------------

export type FoodEntry = {
  id?: string;
  day: string;
  meal: MealSlot;
  name: string;
  portion: string | null;
  kcal: number;
  proteinG?: number | null;
  recipeId?: string | null;
};

export function weekDays(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

export type WeekSummary = {
  days: Array<{ day: string; intake: number; logged: boolean; burn: Burn; balance: number | null }>;
  loggedDays: number;
  avgIntake: number | null;
  avgBurn: number;
  /** Average intake − burn on logged days (negative = deficit). */
  avgBalance: number | null;
  /** Expected weight change for a whole week at this average, kg. */
  weeklyKg: number | null;
  /** Average kcal per logged day, by meal. */
  perMeal: Record<MealSlot, number>;
  topFoods: Record<MealSlot, Array<{ name: string; times: number; kcal: number }>>;
};

export function summarizeWeek(monday: string, entries: FoodEntry[], health: HealthDay[], p: Profile): WeekSummary {
  const days = weekDays(monday).map((day) => {
    const mine = entries.filter((e) => e.day === day);
    const intake = mine.reduce((s, e) => s + e.kcal, 0);
    const burn = dailyBurn(health.filter((h) => h.day === day), p);
    return { day, intake, logged: mine.length > 0, burn, balance: mine.length ? intake - burn.kcal : null };
  });
  const logged = days.filter((d) => d.logged);
  const avg = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);
  const avgIntake = avg(logged.map((d) => d.intake));
  const avgBalance = avg(logged.map((d) => d.balance!));
  const loggedSet = new Set(logged.map((d) => d.day));
  const inWeek = entries.filter((e) => loggedSet.has(e.day));
  const perMeal = Object.fromEntries(
    MEALS.map((m) => [m, logged.length ? Math.round(inWeek.filter((e) => e.meal === m).reduce((s, e) => s + e.kcal, 0) / logged.length) : 0]),
  ) as Record<MealSlot, number>;
  const topFoods = Object.fromEntries(
    MEALS.map((m) => {
      const by = new Map<string, { name: string; times: number; kcal: number }>();
      for (const e of inWeek.filter((x) => x.meal === m)) {
        const k = e.name.trim().toLowerCase();
        const cur = by.get(k) ?? { name: e.name.trim(), times: 0, kcal: 0 };
        cur.times += 1;
        cur.kcal += e.kcal;
        by.set(k, cur);
      }
      return [m, [...by.values()].map((f) => ({ ...f, kcal: Math.round(f.kcal / f.times) })).sort((a, b) => b.times - a.times || b.kcal - a.kcal).slice(0, 3)];
    }),
  ) as WeekSummary["topFoods"];
  return {
    days,
    loggedDays: logged.length,
    avgIntake,
    avgBurn: avg(days.map((d) => d.burn.kcal))!,
    avgBalance,
    weeklyKg: avgBalance == null ? null : Math.round(((avgBalance * 7) / KCAL_PER_KG) * 100) / 100,
    perMeal,
    topFoods,
  };
}

// ---------------------------------------------------------------------------
// Plan: a week like the logged one, at a deficit
// ---------------------------------------------------------------------------

/** One logged meal (all entries of one day + slot), reused as a template. */
export type MealTemplate = { key: string; meal: MealSlot; items: FoodEntry[]; kcal: number; times: number };

export function mealTemplates(entries: FoodEntry[]): MealTemplate[] {
  const groups = new Map<string, FoodEntry[]>();
  for (const e of entries) {
    const k = `${e.day}|${e.meal}`;
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const byKey = new Map<string, MealTemplate>();
  for (const items of groups.values()) {
    const meal = items[0].meal;
    const sig = items
      .map((i) => i.name.trim().toLowerCase())
      .sort()
      .join(" + ");
    const key = `${meal}|${sig}`;
    const kcal = items.reduce((s, i) => s + i.kcal, 0);
    const cur = byKey.get(key);
    if (cur) {
      // Same meal eaten again: keep the average size.
      cur.kcal = Math.round((cur.kcal * cur.times + kcal) / (cur.times + 1));
      cur.times += 1;
    } else {
      byKey.set(key, { key, meal, items, kcal, times: 1 });
    }
  }
  return [...byKey.values()].filter((t) => t.kcal > 0);
}

/** Share of the cut each meal takes, relative to its size. Snacks go first. */
const CUT_WEIGHT: Record<MealSlot, number> = { breakfast: 1, lunch: 1, dinner: 1, snack: 2 };
/** Largest share of a meal the plan will cut before it stops looking like your meal. */
const MAX_CUT: Record<MealSlot, number> = { breakfast: 0.35, lunch: 0.35, dinner: 0.35, snack: 1 };

/**
 * Split a daily cut across meals: proportional to meal size × weight, each meal
 * capped at MAX_CUT; whatever a capped meal can't take moves to the others.
 */
export function mealBudgets(perMeal: Record<MealSlot, number>, cut: number): { budgets: Record<MealSlot, number>; uncut: number } {
  const budgets = { ...perMeal };
  let left = Math.max(0, cut);
  let open = MEALS.filter((m) => perMeal[m] > 0);
  for (let round = 0; round < 4 && left > 0.5 && open.length; round++) {
    const weightSum = open.reduce((s, m) => s + perMeal[m] * CUT_WEIGHT[m], 0);
    let taken = 0;
    const next: MealSlot[] = [];
    for (const m of open) {
      const want = (left * perMeal[m] * CUT_WEIGHT[m]) / weightSum;
      const room = perMeal[m] * MAX_CUT[m] - (perMeal[m] - budgets[m]);
      const take = Math.min(want, room);
      budgets[m] -= take;
      taken += take;
      if (want < room) next.push(m);
    }
    left -= taken;
    open = next;
  }
  for (const m of MEALS) budgets[m] = Math.round(budgets[m]);
  return { budgets, uncut: Math.round(left) };
}

export type PlannedMeal = {
  meal: MealSlot;
  budget: number;
  template: MealTemplate | null;
  /** Portion multiplier applied to every item of the template (0.5–1: never more than you usually eat). */
  factor: number;
  kcal: number;
  items: Array<{ name: string; portion: string | null; kcal: number; recipeId: string | null }>;
};

export type PlannedDay = { day: string; target: number; meals: PlannedMeal[]; kcal: number };

export type WeekPlan = {
  days: PlannedDay[];
  /** Typical (logged) day vs the target, kcal. */
  usualIntake: number;
  dailyCut: number;
  budgets: Record<MealSlot, number>;
  /** Cut that couldn't be placed without changing meals too much. */
  uncut: number;
  notes: string[];
};

/** Scale the leading number of a portion text: "150 g" × 0.8 → "120 g". */
export function scalePortion(portion: string | null, factor: number): string | null {
  if (!portion) return factor === 1 ? null : `${Math.round(factor * 100)} % of usual`;
  if (Math.abs(factor - 1) < 0.025) return portion;
  const m = /^\s*(\d+(?:[.,]\d+)?)(.*)$/.exec(portion);
  if (!m) return `${portion} × ${Math.round(factor * 100)} %`;
  const orig = parseFloat(m[1].replace(",", "."));
  const n = orig * factor;
  // 5 g steps for grams-sized numbers, halves for "3,5 dl", quarters below 3.
  const rounded = n >= 20 ? Math.round(n / 5) * 5 : n >= 3 ? Math.round(n * 2) / 2 : Math.round(n * 4) / 4;
  // "1 annos" at 90 % can't be shown by rounding: say the percentage instead.
  if (rounded === orig) return `${portion} × ${Math.round(factor * 100)} %`;
  return `${String(rounded).replace(".", ",")}${m[2]}`;
}

const MIN_FACTOR = 0.5;
const MAX_FACTOR = 1;

/**
 * Plan 7 days from a logged week. Each meal reuses something you actually ate
 * in that slot, scaled to its budget. Picks the meal whose normal size is
 * closest to the budget, prefers ones you eat often, and avoids repeating the
 * same meal more than needed.
 */
export function planDeficitWeek(input: { startDay: string; entries: FoodEntry[]; loggedDays: number; target: number; days?: number }): WeekPlan {
  const templates = mealTemplates(input.entries);
  const notes: string[] = [];
  const n = Math.max(1, input.loggedDays);
  const perMeal = Object.fromEntries(MEALS.map((m) => [m, Math.round(input.entries.filter((e) => e.meal === m).reduce((s, e) => s + e.kcal, 0) / n)])) as Record<MealSlot, number>;
  const usual = MEALS.reduce((s, m) => s + perMeal[m], 0);
  const cut = Math.max(0, usual - input.target);
  if (usual <= input.target) notes.push(`Your logged days already average ${usual} kcal, at or under the ${input.target} kcal target, so the plan keeps your usual portions.`);
  const { budgets, uncut } = mealBudgets(perMeal, cut);
  if (uncut > 0) notes.push(`About ${uncut} kcal/day of the cut doesn't fit without shrinking meals by more than a third. Swap a meal for a lighter one, or add activity.`);
  if (budgets.snack === 0 && perMeal.snack > 0) notes.push("Snacks are dropped: they were the easiest calories to cut.");

  const used = new Map<string, number>();
  const days: PlannedDay[] = [];
  for (let i = 0; i < (input.days ?? 7); i++) {
    const day = addDays(input.startDay, i);
    const meals: PlannedMeal[] = [];
    for (const meal of MEALS) {
      const budget = budgets[meal];
      const options = templates.filter((t) => t.meal === meal);
      if (budget <= 0 || !options.length) {
        if (perMeal[meal] > 0) meals.push({ meal, budget: 0, template: null, factor: 0, kcal: 0, items: [] });
        continue;
      }
      const scored = options
        .map((t, idx) => {
          // No cut needed: your usual portions, only rotated.
          const factor = cut === 0 ? 1 : Math.min(MAX_FACTOR, Math.max(MIN_FACTOR, budget / t.kcal));
          const fit = cut === 0 ? 0 : Math.abs(t.kcal * factor - budget) / budget; // 0 = lands on budget
          const shrink = Math.abs(1 - factor); // prefer meals already near the budget
          const repeat = used.get(t.key) ?? 0;
          // Rotation: day index shifts ties so the week isn't one meal × 7.
          const jitter = ((idx + i) % options.length) * 0.001;
          return { t, factor, score: fit * 3 + shrink + repeat * 0.25 - Math.min(t.times, 3) * 0.05 + jitter };
        })
        .sort((a, b) => a.score - b.score);
      const { t, factor } = scored[0];
      const f = Math.round(factor * 20) / 20; // 5 % steps read better than 0.83
      used.set(t.key, (used.get(t.key) ?? 0) + 1);
      const items = t.items.map((it) => ({ name: it.name, portion: scalePortion(it.portion, f), kcal: Math.round(it.kcal * (t.kcal / t.items.reduce((s, x) => s + x.kcal, 0)) * f), recipeId: it.recipeId ?? null }));
      meals.push({ meal, budget, template: t, factor: f, kcal: items.reduce((s, x) => s + x.kcal, 0), items });
    }
    days.push({ day, target: input.target, meals, kcal: meals.reduce((s, m) => s + m.kcal, 0) });
  }
  return { days, usualIntake: usual, dailyCut: cut - uncut, budgets, uncut, notes };
}
