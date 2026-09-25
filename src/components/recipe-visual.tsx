/* eslint-disable @next/next/no-img-element */
import { plateFor } from "@/lib/domain/food-colors";
import { Plate } from "./plate";
import { cx } from "./ui";

type R = { id: string; imageOriginalId: string | null; sourceType: string };
type Ing = Array<{ nameFi: string; category: string }>;

/** The recipe's own photo (web imports) or else its ingredient-colour plate. Scans of cookbook pages aren't used as photos. */
export function photoId(r: R): string | null {
  return r.imageOriginalId && r.sourceType !== "photo" ? r.imageOriginalId : null;
}

export function RecipeCircle({ recipe, ingredients, size, className }: { recipe: R; ingredients: Ing; size: number; className?: string }) {
  const pid = photoId(recipe);
  if (!pid) return <Plate spec={plateFor(ingredients)} seed={recipe.id} size={size} className={className} />;
  return (
    <img
      src={`/api/originals/${pid}`}
      alt=""
      width={size}
      height={size}
      className={cx("shrink-0 rounded-full object-cover ring-4 ring-[#fffdf8] shadow-[0_4px_10px_-4px_rgba(0,0,0,.35)]", className)}
      style={{ width: size, height: size }}
      data-testid="recipe-photo"
    />
  );
}

export function RecipeCover({ recipe, ingredients, tint, plateSize, className }: { recipe: R; ingredients: Ing; tint: string; plateSize: number; className?: string }) {
  const pid = photoId(recipe);
  if (pid) {
    return <img src={`/api/originals/${pid}`} alt="" className={cx("w-full object-cover", className)} data-testid="recipe-photo" />;
  }
  return (
    <div className={cx("flex items-center justify-center", className)} style={{ background: `radial-gradient(circle at 50% 60%, ${tint}55, ${tint}18 70%)` }}>
      <Plate spec={plateFor(ingredients)} seed={recipe.id} size={plateSize} />
    </div>
  );
}
