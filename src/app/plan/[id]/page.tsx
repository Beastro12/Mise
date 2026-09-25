import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlan } from "@/lib/services/plans";
import { allTags, listRecipes } from "@/lib/services/recipes";
import {
  addMealAction,
  cookedAction,
  deletePlanAction,
  generateListAction,
  proposeAction,
  removeMealAction,
  swapAction,
  toggleLockAction,
  updateMealAction,
} from "@/app/actions/plans";
import { Badge, Button, Card, Empty, Field, LinkButton, PageTitle, Section, btn, cx, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function dayLabel(d: string | null) {
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return `${WD[dt.getUTCDay()]} ${day}.${m}.`;
}

export default async function PlanPage(props: PageProps<"/plan/[id]">) {
  const { id } = await props.params;
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const data = await getPlan(id);
  if (!data) notFound();
  const { plan, meals, list } = data;
  const [recipes, tags] = await Promise.all([listRecipes({ q }), allTags()]);
  const planned = new Set(meals.map((m) => m.recipe.id));
  const params = plan.proposeParams;
  const [y, mo, d] = plan.weekStart.split("-").map(Number);

  return (
    <div>
      <PageTitle sub={`${meals.length} meal${meals.length === 1 ? "" : "s"} · default ${plan.defaultServings} servings`}>
        {plan.name || `Week of ${d}.${mo}.${y}`}
      </PageTitle>

      {meals.length === 0 ? (
        <Empty>No meals yet. Propose a week below, or add recipes yourself.</Empty>
      ) : (
        <ul className="space-y-2" data-testid="meals">
          {meals.map(({ meal, recipe }) => (
            <li key={meal.id} className={cx("rounded-lg border border-line bg-surface p-3", meal.cookedAt && "opacity-70")} data-testid="meal">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                    {dayLabel(meal.day)} {meal.locked ? <Badge tone="accent">locked</Badge> : null} {meal.cookedAt ? <Badge tone="accent">cooked</Badge> : null}
                  </div>
                  <Link href={`/recipes/${recipe.id}?servings=${meal.servings}`} className="font-medium hover:underline">
                    {recipe.title}
                  </Link>
                  {meal.reason ? <div className="text-xs text-muted" data-testid="meal-reason">{meal.reason}</div> : null}
                </div>
                <form action={updateMealAction} className="flex shrink-0 items-center gap-1">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="mealId" value={meal.id} />
                  <input
                    name="servings"
                    defaultValue={meal.servings}
                    inputMode="numeric"
                    aria-label="Servings"
                    className="w-12 rounded-md border border-line bg-surface px-2 py-1 text-center text-sm"
                  />
                  <button className={btn.small} type="submit">
                    serv.
                  </button>
                </form>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <form action={toggleLockAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="mealId" value={meal.id} />
                  <input type="hidden" name="locked" value={meal.locked ? "0" : "1"} />
                  <button className={btn.small}>{meal.locked ? "Unlock" : "Lock"}</button>
                </form>
                {!meal.locked ? (
                  <form action={swapAction}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="mealId" value={meal.id} />
                    <button className={btn.small} data-testid="swap">
                      Give me another
                    </button>
                  </form>
                ) : null}
                <form action={cookedAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="mealId" value={meal.id} />
                  <input type="hidden" name="cooked" value={meal.cookedAt ? "0" : "1"} />
                  <button className={btn.small}>{meal.cookedAt ? "Not cooked" : "Mark cooked"}</button>
                </form>
                <form action={removeMealAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="mealId" value={meal.id} />
                  <button className={cx(btn.small, "text-danger")}>Remove</button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={generateListAction}>
          <input type="hidden" name="planId" value={plan.id} />
          <Button type="submit" disabled={!meals.length} data-testid="generate-list">
            {list ? "Regenerate shopping list" : "Generate shopping list"}
          </Button>
        </form>
        {list ? (
          <LinkButton href={`/list/${list.id}`} data-testid="open-list">
            Open list
          </LinkButton>
        ) : null}
      </div>

      <Section title="Propose a week">
        <Card>
          <form action={proposeAction} className="space-y-3">
            <input type="hidden" name="planId" value={plan.id} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="Meals">
                <input name="meals" defaultValue={params?.meals ?? 5} inputMode="numeric" className={inputCls} />
              </Field>
              <Field label="Weekday max min">
                <input name="weekdayMax" defaultValue={params?.weekdayMaxMinutes ?? 45} inputMode="numeric" className={inputCls} />
              </Field>
            </div>
            <Field label="Include tags" hint={tags.length ? `Known: ${tags.join(", ")}` : undefined}>
              <input name="include" defaultValue={params?.includeTags.join(", ") ?? ""} placeholder="e.g. arki, quick" className={inputCls} />
            </Field>
            <Field label="Exclude tags">
              <input name="exclude" defaultValue={params?.excludeTags.join(", ") ?? ""} placeholder="e.g. jälkiruoka" className={inputCls} />
            </Field>
            <p className="text-xs text-muted">
              Skips anything cooked or planned in the last 2 weeks, varies the protein, and prefers your pantry and this week&apos;s Lidl offers. Locked
              meals stay.
            </p>
            <Button type="submit" variant="secondary" data-testid="propose">
              {meals.length ? "Regenerate unlocked meals" : "Propose"}
            </Button>
          </form>
        </Card>
      </Section>

      <Section title="Add recipes">
        <form className="mb-2">
          <input name="q" defaultValue={q} placeholder="Search recipes" className={inputCls} />
        </form>
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {recipes.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 px-4 py-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium">{r.title}</div>
                <div className="text-xs text-muted">
                  {r.tags.slice(0, 3).join(", ")}
                  {(r.prepMinutes ?? 0) + (r.cookMinutes ?? 0) ? ` · ${(r.prepMinutes ?? 0) + (r.cookMinutes ?? 0)} min` : ""}
                </div>
              </div>
              <form action={addMealAction}>
                <input type="hidden" name="planId" value={plan.id} />
                <input type="hidden" name="recipeId" value={r.id} />
                <button className={btn.small} data-testid="add-meal" data-title={r.title}>
                  {planned.has(r.id) ? "+ again" : "+ Add"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </Section>

      <form action={deletePlanAction} className="mt-8">
        <input type="hidden" name="planId" value={plan.id} />
        <Button variant="danger" type="submit">
          Delete plan
        </Button>
      </form>
    </div>
  );
}
