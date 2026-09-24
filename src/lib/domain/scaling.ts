import { round } from "./units";

export function scaleFactor(recipeServings: number, targetServings: number): number {
  if (!recipeServings || recipeServings <= 0) return 1;
  return targetServings / recipeServings;
}

export function scaleQuantity(quantity: number | null, recipeServings: number, targetServings: number): number | null {
  if (quantity == null) return null;
  return round(quantity * scaleFactor(recipeServings, targetServings), 3);
}

export function scaleIngredients<T extends { quantity: number | null }>(
  ingredients: T[],
  recipeServings: number,
  targetServings: number,
): T[] {
  return ingredients.map((i) => ({ ...i, quantity: scaleQuantity(i.quantity, recipeServings, targetServings) }));
}
