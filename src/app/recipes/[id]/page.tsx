import Link from "next/link";
import { notFound } from "next/navigation";
import { getRecipe } from "@/lib/services/recipes";
import { deleteRecipeAction } from "@/app/actions/recipes";
import { scaleQuantity } from "@/lib/domain/scaling";
import { formatQty } from "@/lib/domain/units";
import { sectionLabel } from "@/lib/domain/sections";
import { Badge, Button, LinkButton, PageTitle, Section, cx } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function RecipePage(props: PageProps<"/recipes/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const r = await getRecipe(id);
  if (!r) notFound();
  const target = Math.max(1, Math.min(40, parseInt(typeof sp.servings === "string" ? sp.servings : "", 10) || r.servings));
  const mins = (r.prepMinutes ?? 0) + (r.cookMinutes ?? 0);
  return (
    <div>
      <PageTitle
        sub={
          <>
            {r.prepMinutes != null ? `prep ${r.prepMinutes} min · ` : ""}
            {r.cookMinutes != null ? `cook ${r.cookMinutes} min · ` : ""}
            {mins ? `${mins} min total` : "time unknown"}
          </>
        }
        action={<LinkButton href={`/recipes/${r.id}/edit`}>Edit</LinkButton>}
      >
        {r.title}
      </PageTitle>
      <div className="flex flex-wrap gap-1">
        {r.tags.map((t) => (
          <Badge key={t}>{t}</Badge>
        ))}
      </div>

      <Section
        title="Ingredients"
        action={
          <div className="flex items-center gap-1 text-sm" aria-label="Servings">
            <Link className="rounded-md border border-line px-2" href={`?servings=${Math.max(1, target - 1)}`} scroll={false}>
              −
            </Link>
            <span className="w-20 text-center tabular" data-testid="servings">
              {target} serv.
            </span>
            <Link className="rounded-md border border-line px-2" href={`?servings=${target + 1}`} scroll={false}>
              +
            </Link>
          </div>
        }
      >
        {target !== r.servings ? <p className="mb-2 text-xs text-muted">Scaled from {r.servings} servings.</p> : null}
        <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
          {r.ingredients.map((i) => {
            const q = scaleQuantity(i.quantity, r.servings, target);
            return (
              <li key={i.id} className="px-4 py-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="font-medium">{i.nameFi}</span>
                    {i.prepNote ? <span className="text-muted">, {i.prepNote}</span> : null}
                    {i.optional ? <span className="text-muted"> (optional)</span> : null}
                  </span>
                  <span className="shrink-0 tabular">{formatQty({ quantity: q, unit: i.unit })}</span>
                </div>
                <div className="text-xs text-muted">
                  {i.originalText}
                  <span className={cx("ml-1")}>· {sectionLabel(i.category).split(" · ")[1]}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Steps">
        <ol className="list-decimal space-y-2 pl-5">
          {r.steps.map((s, i) => (
            <li key={i}>{s}</li>
          ))}
        </ol>
      </Section>

      {r.notes ? (
        <Section title="Notes">
          <p className="whitespace-pre-line text-sm">{r.notes}</p>
        </Section>
      ) : null}

      <Section title="Source">
        <div className="space-y-1 text-sm text-muted">
          <div>
            {r.sourceType}
            {r.sourceNote ? ` · ${r.sourceNote}` : ""}
          </div>
          {r.sourceUrl ? (
            <a href={r.sourceUrl} className="block truncate underline" target="_blank" rel="noreferrer">
              {r.sourceUrl}
            </a>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {r.originals
              .filter((o) => o.kind !== "url")
              .map((o) =>
                o.kind === "image" ? (
                  <a key={o.id} href={`/api/originals/${o.id}`} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/originals/${o.id}`} alt="original" className="h-24 rounded-lg border border-line object-cover" />
                  </a>
                ) : (
                  <a key={o.id} href={`/api/originals/${o.id}`} className="underline" target="_blank" rel="noreferrer">
                    📄 {o.filename}
                  </a>
                ),
              )}
          </div>
          {r.cookedDates.length ? <div>Cooked {r.cookedDates.length}× · last {r.cookedDates[0].toLocaleDateString("fi-FI")}</div> : null}
        </div>
      </Section>

      <form action={deleteRecipeAction} className="mt-8">
        <input type="hidden" name="id" value={r.id} />
        <Button variant="danger" type="submit">
          Delete recipe
        </Button>
      </form>
    </div>
  );
}
