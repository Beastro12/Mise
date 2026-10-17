"use client";

import { useState } from "react";
import type { MealSlot } from "@/db/schema";
import { addFoodAction } from "@/app/actions/nutrition";
import { Button, Field, cx, inputCls } from "./ui";

type Recent = { name: string; portion: string | null; kcal: number; meal: MealSlot };
const MEAL_OPTIONS: Array<[MealSlot, string]> = [
  ["breakfast", "Breakfast"],
  ["lunch", "Lunch"],
  ["dinner", "Dinner"],
  ["snack", "Snack"],
];

export function FoodAdd({ day, defaultMeal, recent, recipes }: { day: string; defaultMeal: MealSlot; recent: Recent[]; recipes: Array<{ id: string; title: string }> }) {
  const [meal, setMeal] = useState<MealSlot>(defaultMeal);
  const [name, setName] = useState("");
  const [portion, setPortion] = useState("");
  const [kcal, setKcal] = useState("");
  const [recipeId, setRecipeId] = useState("");

  const onName = (v: string) => {
    setName(v);
    // Picking a food you've logged before fills in its last portion and calories.
    const hit = recent.find((r) => r.name.toLowerCase() === v.trim().toLowerCase());
    if (hit) {
      setPortion(hit.portion ?? "");
      setKcal(String(hit.kcal));
    }
    const rec = recipes.find((r) => r.title.toLowerCase() === v.trim().toLowerCase());
    setRecipeId(rec?.id ?? "");
  };

  return (
    <form
      action={async (fd) => {
        await addFoodAction(fd);
        setName("");
        setPortion("");
        setKcal("");
        setRecipeId("");
      }}
      className="space-y-3"
    >
      <input type="hidden" name="day" value={day} />
      <input type="hidden" name="recipeId" value={recipeId} />
      {/* Meal is a hidden input + buttons, not radios: React resets the form after the action,
          which would put a radio back to its first-render default while the state kept the last meal. */}
      <input type="hidden" name="meal" value={meal} />
      <div className="grid grid-cols-4 rounded-full border border-line bg-surface p-1 text-[13px]" role="group" aria-label="Meal">
        {MEAL_OPTIONS.map(([m, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={meal === m}
            onClick={() => setMeal(m)}
            className={cx("rounded-full py-1.5 text-center font-semibold", meal === m ? "bg-primary text-primary-ink" : "text-muted")}
            data-testid={`meal-${m}`}
          >
            {label}
          </button>
        ))}
      </div>
      <Field label="Food">
        <input name="name" list="food-suggestions" required value={name} onChange={(e) => onName(e.target.value)} placeholder="e.g. Kaurapuuro maidolla" className={inputCls} data-testid="food-name" autoComplete="off" />
        <datalist id="food-suggestions">
          {recent.map((r) => (
            <option key={`f-${r.name}`} value={r.name}>{`${r.kcal} kcal${r.portion ? ` · ${r.portion}` : ""}`}</option>
          ))}
          {recipes.map((r) => (
            <option key={`r-${r.id}`} value={r.title}>recipe</option>
          ))}
        </datalist>
      </Field>
      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <Field label="Portion" hint="Optional. Start with a number (150 g, 2 dl) and the plan can scale it.">
          <input name="portion" value={portion} onChange={(e) => setPortion(e.target.value)} placeholder="e.g. 3 dl" className={inputCls} />
        </Field>
        <Field label="kcal">
          <input name="kcal" required inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} className={inputCls} data-testid="food-kcal" />
        </Field>
      </div>
      <Button type="submit" data-testid="food-add">
        Log it
      </Button>
    </form>
  );
}
