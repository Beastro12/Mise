import Link from "next/link";
import { allTags, getAllRecipesWithIngredients, listRecipes } from "@/lib/services/recipes";
import { accentFor } from "@/lib/domain/food-colors";
import { RecipeCover } from "@/components/recipe-visual";
import { TraitBadges } from "@/components/trait-badges";
import { recipeTraits } from "@/lib/domain/traits";
import { Empty, LinkButton, PageTitle, cx, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RecipesPage(props: PageProps<"/recipes">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const [recipes, tags, full] = await Promise.all([listRecipes({ q, tag }), allTags(), getAllRecipesWithIngredients()]);
  const ingOf = new Map(full.map((r) => [r.id, r.ingredients]));
  const fullOf = new Map(full.map((r) => [r.id, r]));
  return (
    <div>
      <PageTitle sub={`${recipes.length} recipe${recipes.length === 1 ? "" : "s"}`} action={<LinkButton href="/recipes/import" variant="primary">+ Add</LinkButton>}>
        Recipes
      </PageTitle>
      <form className="mb-3">
        <input name="q" defaultValue={q} placeholder="Search title or tag" className={inputCls} />
        {tag ? <input type="hidden" name="tag" value={tag} /> : null}
      </form>
      <div className="mb-4 flex flex-wrap gap-1.5">
        <Link href="/recipes" className={cx("rounded-full border px-3 py-1 text-xs font-semibold", !tag ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-muted")}>
          all
        </Link>
        {tags.map((t) => (
          <Link
            key={t}
            href={`/recipes?tag=${encodeURIComponent(t)}`}
            className={cx("rounded-full border px-3 py-1 text-xs font-semibold", tag === t ? "border-primary bg-primary text-primary-ink" : "border-line bg-surface text-muted")}
          >
            {t}
          </Link>
        ))}
      </div>
      {recipes.length === 0 ? (
        <Empty>No recipes match. Import one from a link, photo or file.</Empty>
      ) : (
        <ul className="grid grid-cols-2 gap-3">
          {recipes.map((r) => {
            const mins = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
            const ings = ingOf.get(r.id) ?? [];
            const tint = accentFor(ings);
            return (
              <li key={r.id}>
                <Link
                  href={`/recipes/${r.id}`}
                  className="flex h-full flex-col overflow-hidden rounded-3xl bg-surface shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)] transition active:scale-[.98]"
                >
                  <RecipeCover recipe={r} ingredients={ings} tint={tint} plateSize={92} className="h-[124px]" />
                  <div className="flex flex-1 flex-col p-3">
                    <div className="font-display text-[16px] font-[650] leading-tight tracking-[-0.01em]">{r.title}</div>
                    <div className="mt-auto pt-2 text-xs text-muted tabular">
                      {mins ? `${mins} min · ` : ""}
                      {r.servings} serv.
                    </div>
                    <TraitBadges className="mt-2" traits={recipeTraits(fullOf.get(r.id) ?? { ...r, ingredients: [] })} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
