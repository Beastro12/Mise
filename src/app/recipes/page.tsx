import Link from "next/link";
import { allTags, listRecipes } from "@/lib/services/recipes";
import { Badge, Empty, LinkButton, PageTitle, cx, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RecipesPage(props: PageProps<"/recipes">) {
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const tag = typeof sp.tag === "string" ? sp.tag : "";
  const [recipes, tags] = await Promise.all([listRecipes({ q, tag }), allTags()]);
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
        <Link href="/recipes" className={cx("rounded-full border px-2.5 py-0.5 text-xs", !tag ? "border-accent bg-accent-soft text-accent" : "border-line text-muted")}>
          all
        </Link>
        {tags.map((t) => (
          <Link
            key={t}
            href={`/recipes?tag=${encodeURIComponent(t)}`}
            className={cx("rounded-full border px-2.5 py-0.5 text-xs", tag === t ? "border-accent bg-accent-soft text-accent" : "border-line text-muted")}
          >
            {t}
          </Link>
        ))}
      </div>
      {recipes.length === 0 ? (
        <Empty>No recipes match. Import one from a link, photo or file.</Empty>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
          {recipes.map((r) => {
            const mins = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
            return (
              <li key={r.id}>
                <Link href={`/recipes/${r.id}`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium">{r.title}</div>
                    <div className="mt-0.5 flex flex-wrap gap-1">
                      {r.tags.slice(0, 4).map((t) => (
                        <Badge key={t}>{t}</Badge>
                      ))}
                    </div>
                  </div>
                  <div className="shrink-0 text-right text-xs text-muted tabular">
                    {mins ? `${mins} min` : ""}
                    <div>{r.servings} serv.</div>
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
