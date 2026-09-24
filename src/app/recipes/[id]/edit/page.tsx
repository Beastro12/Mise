import { notFound } from "next/navigation";
import { draftFromRecipe, getRecipe } from "@/lib/services/recipes";
import { RecipeEditor } from "@/components/recipe-editor";
import { PageTitle } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function EditRecipePage(props: PageProps<"/recipes/[id]/edit">) {
  const { id } = await props.params;
  const r = await getRecipe(id);
  if (!r) notFound();
  return (
    <div>
      <PageTitle>Edit recipe</PageTitle>
      <RecipeEditor initial={draftFromRecipe(r, r.originals.map((o) => o.id))} mode={{ kind: "recipe", recipeId: r.id }} />
    </div>
  );
}
