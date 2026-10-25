"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAuth } from "@/lib/auth-server";
import type { MealSlot } from "@/db/schema";
import { ACTIVITY_LEVELS, type Profile } from "@/lib/domain/nutrition";
import { addEntry, deleteEntry, saveHealthDays, setProfile, syncOura } from "@/lib/services/nutrition";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const n = parseFloat(str(f, k).replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

function revalidate() {
  revalidatePath("/food", "layout");
}

export async function addFoodAction(formData: FormData) {
  await requireAuth();
  await addEntry({
    day: str(formData, "day"),
    meal: str(formData, "meal") as MealSlot,
    name: str(formData, "name"),
    portion: str(formData, "portion") || null,
    kcal: num(formData, "kcal") ?? NaN,
    proteinG: num(formData, "protein"),
    recipeId: str(formData, "recipeId") || null,
  });
  revalidate();
}

export async function deleteFoodAction(formData: FormData) {
  await requireAuth();
  await deleteEntry(str(formData, "id"));
  revalidate();
}

/** "Ate this": log a planned meal's items as eaten on that day. */
export async function logPlannedAction(formData: FormData) {
  await requireAuth();
  const items = z
    .array(z.object({ name: z.string().min(1).max(200), portion: z.string().max(100).nullable(), kcal: z.number().int().min(0).max(10_000), recipeId: z.uuid().nullable() }))
    .max(30)
    .parse(JSON.parse(str(formData, "items") || "[]"));
  for (const it of items) await addEntry({ day: str(formData, "day"), meal: str(formData, "meal") as MealSlot, ...it });
  revalidate();
}

export async function saveProfileAction(formData: FormData) {
  await requireAuth();
  const clamp = (v: number | null, lo: number, hi: number, d: number) => (v == null ? d : Math.min(hi, Math.max(lo, v)));
  const activity = num(formData, "activity");
  const source = str(formData, "energySource");
  const p: Profile = {
    sex: str(formData, "sex") === "female" ? "female" : "male",
    age: Math.round(clamp(num(formData, "age"), 16, 100, 35)),
    heightCm: clamp(num(formData, "heightCm"), 120, 230, 175),
    weightKg: clamp(num(formData, "weightKg"), 35, 300, 80),
    activity: ACTIVITY_LEVELS.some((a) => a.value === activity) ? activity! : 1.375,
    deficitKcal: Math.round(clamp(num(formData, "deficitKcal"), 0, 1000, 500)),
    energySource: (["auto", "apple", "oura", "estimate"] as const).find((s) => s === source) ?? "auto",
  };
  await setProfile(p);
  revalidate();
}

const DaySchema = z.object({
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  activeKcal: z.number().nullable(),
  basalKcal: z.number().nullable(),
  totalKcal: z.number().nullable(),
  steps: z.number().nullable(),
  weightKg: z.number().nullable(),
  intakeKcal: z.number().nullable(),
});

/** Daily totals parsed in the browser from an Apple Health or Oura export. */
export async function importHealthAction(source: "apple" | "oura", days: unknown): Promise<{ ok: boolean; message: string }> {
  await requireAuth();
  if (source !== "apple" && source !== "oura") return { ok: false, message: "Unknown source." };
  const parsed = z.array(DaySchema).max(800).safeParse(days);
  if (!parsed.success) return { ok: false, message: "The file's daily totals didn't look right." };
  const n = await saveHealthDays(source, parsed.data);
  revalidate();
  return { ok: true, message: `Saved ${n} day${n === 1 ? "" : "s"} from ${source === "apple" ? "Apple Health" : "Oura"}.` };
}

export async function syncOuraAction(): Promise<{ ok: boolean; message: string }> {
  await requireAuth();
  try {
    const n = await syncOura(30);
    revalidate();
    return { ok: true, message: `Synced ${n} day${n === 1 ? "" : "s"} from Oura.` };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
