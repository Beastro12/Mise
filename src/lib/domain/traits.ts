import { proteinOf } from "./propose";

export type Protein = "meat" | "chicken" | "fish" | "vegetarian" | "vegan";
export type Effort = "quick" | "slow" | "oven" | "soup";

export type RecipeTraits = { protein: Protein; effort: Effort[] };

type TraitInput = {
  id: string;
  title: string;
  tags: string[];
  prepMinutes: number | null;
  cookMinutes: number | null;
  steps?: string[];
  ingredients: Array<{ nameFi: string; category: string }>;
};

const ANIMAL_NON_MEAT = /kerma|maito|voi|juusto|jogurtti|viili|smetana|kananmuna|muna|hunaja|parmesaani|feta|mozzarella|rahka/;
const PLANT_BASED = /kookos|kaura|soija|manteli|riisijuoma|kasvikerma/;

/**
 * Icons for scanning the catalogue: main protein (from tags, else ingredients)
 * and time/effort. Best effort; tags you set on the recipe always win.
 */
export function recipeTraits(r: TraitInput): RecipeTraits {
  const tags = r.tags.map((t) => t.toLowerCase());
  const base = proteinOf({ id: r.id, title: r.title, tags: r.tags, totalMinutes: null, ingredients: r.ingredients.map((i) => ({ nameFi: i.nameFi, section: i.category })) });
  let protein: Protein;
  if (base === "fish") protein = "fish";
  else if (base === "chicken") protein = "chicken";
  else if (base === "vegetarian") {
    const vegan = tags.some((t) => t === "vegan" || t === "vegaani") || !r.ingredients.some((i) => !PLANT_BASED.test(i.nameFi) && (i.category === "maito_juusto" || ANIMAL_NON_MEAT.test(i.nameFi)));
    protein = vegan ? "vegan" : "vegetarian";
  } else protein = "meat";

  const effort: Effort[] = [];
  const total = r.prepMinutes != null || r.cookMinutes != null ? (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) : null;
  if (tags.includes("quick") || (total != null && total <= 30)) effort.push("quick");
  else if (total != null && total >= 90) effort.push("slow");
  const text = `${r.title} ${(r.steps ?? []).join(" ")}`.toLowerCase();
  if (tags.some((t) => /keitto|soup/.test(t)) || /keitto\b|soup\b/.test(r.title.toLowerCase())) effort.push("soup");
  if (tags.some((t) => /uuni|oven/.test(t)) || /\buuni|asteessa|\boven\b|°c/.test(text)) effort.push("oven");
  return { protein, effort };
}

export const PROTEIN_LABEL: Record<Protein, string> = {
  meat: "Meat",
  chicken: "Chicken",
  fish: "Fish",
  vegetarian: "Vegetarian",
  vegan: "Vegan",
};

export const EFFORT_LABEL: Record<Effort, string> = {
  quick: "Quick",
  slow: "Slow",
  oven: "Oven",
  soup: "Soup",
};
