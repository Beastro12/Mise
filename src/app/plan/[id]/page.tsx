import Link from "next/link";
import { notFound } from "next/navigation";
import { getPlan } from "@/lib/services/plans";
import { allTags, getAllRecipesWithIngredients, listRecipes } from "@/lib/services/recipes";
import { accentFor } from "@/lib/domain/food-colors";
import { RecipeCircle } from "@/components/recipe-visual";
import { MONTH_FI, inSeason, seasonalRecipes } from "@/lib/domain/season";
import { addDays } from "@/lib/domain/offers";
import { foodColor } from "@/lib/domain/food-colors";
import { TraitBadges } from "@/components/trait-badges";
import { recipeTraits } from "@/lib/domain/traits";
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
  const [recipes, tags, full] = await Promise.all([listRecipes({ q }), allTags(), getAllRecipesWithIngredients()]);
  const ingOf = new Map(full.map((r) => [r.id, r.ingredients]));
  const traitsOf = new Map(full.map((r) => [r.id, recipeTraits(r)]));
  const seasonMonth = Number(addDays(plan.weekStart, 3).slice(5, 7)) - 1;
  const season = inSeason(seasonMonth);
  const seasonal = seasonalRecipes(full, season);
  const planned = new Set(meals.map((m) => m.recipe.id));
  const params = plan.proposeParams;
  const [y, mo, d] = plan.weekStart.split("-").map(Number);

  return (
    <div>
      <PageTitle sub={`${meals.length} meal${meals.length === 1 ? "" : "s"} · default ${plan.defaultServings} servings`}>
        {plan.name || `Week of ${d}.${mo}.${y}`}
      </PageTitle>

      {/* Week at a glance */}
      <div className="mb-5 grid grid-cols-7 gap-1 rounded-3xl bg-surface p-2.5 shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]" data-testid="week-strip">
        {Array.from({ length: 7 }, (_, i) => {
          const day = addDays(plan.weekStart, i);
          const todays = meals.filter((m) => m.meal.day === day);
          return (
            <div key={day} className="flex flex-col items-center gap-1">
              <span className="text-[10px] font-bold uppercase text-muted">{["ma", "ti", "ke", "to", "pe", "la", "su"][i]}</span>
              {todays.length ? (
                todays.slice(0, 2).map((m) => (
                  <Link key={m.meal.id} href={`/recipes/${m.recipe.id}`} title={m.recipe.title}>
                    <RecipeCircle recipe={m.recipe} ingredients={ingOf.get(m.recipe.id) ?? []} size={38} className={m.meal.cookedAt ? "opacity-50" : undefined} />
                  </Link>
                ))
              ) : (
                <span className="h-[38px] w-[38px] rounded-full border-2 border-dashed border-line" aria-hidden />
              )}
              <span className="text-[10px] tabular text-muted">{Number(day.slice(8, 10))}.</span>
            </div>
          );
        })}
      </div>

      {meals.length === 0 ? (
        <Empty>No meals yet. Propose a week below, or add recipes yourself.</Empty>
      ) : (
        <ul className="space-y-3" data-testid="meals">
          {meals.map(({ meal, recipe }) => {
            const ings = ingOf.get(recipe.id) ?? [];
            const tint = accentFor(ings);
            return (
            <li
              key={meal.id}
              className={cx("overflow-hidden rounded-3xl bg-surface shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]", meal.cookedAt && "opacity-60")}
              data-testid="meal"
            >
              <div className="flex gap-3.5 p-3.5" style={{ background: `linear-gradient(100deg, ${tint}2e, transparent 62%)` }}>
                <RecipeCircle recipe={recipe} ingredients={ings} size={76} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                    <span className="rounded-full bg-surface/80 px-2 py-0.5 text-primary">{dayLabel(meal.day)}</span>
                    {meal.locked ? <Badge tone="accent">locked</Badge> : null} {meal.cookedAt ? <Badge tone="accent">cooked</Badge> : null}
                  </div>
                  <Link href={`/recipes/${recipe.id}?servings=${meal.servings}`} className="mt-1 block font-display text-[21px] font-[650] leading-tight tracking-[-0.015em] hover:underline">
                    {recipe.title}
                  </Link>
                  {traitsOf.get(recipe.id) ? <TraitBadges className="mt-1.5" traits={traitsOf.get(recipe.id)!} /> : null}
                  {meal.reason ? <div className="mt-1 text-xs leading-snug text-muted" data-testid="meal-reason">{meal.reason}</div> : null}
                </div>
              </div>
              <div className="flex items-center gap-0.5 border-t border-line/70 px-2 py-1.5">
                <form action={updateMealAction} className="mr-auto flex items-center gap-1">
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="mealId" value={meal.id} />
                  <input
                    name="servings"
                    defaultValue={meal.servings}
                    inputMode="numeric"
                    aria-label="Servings"
                    className="w-10 rounded-full border border-line bg-surface px-2 py-1 text-center text-sm"
                  />
                  <button className={cx(btn.quiet, "px-1.5")} type="submit" aria-label="Save servings">
                    serv.
                  </button>
                </form>
                <form action={toggleLockAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="mealId" value={meal.id} />
                  <input type="hidden" name="locked" value={meal.locked ? "0" : "1"} />
                  <button className={cx(btn.quiet, "px-2")}>{meal.locked ? "Unlock" : "Lock"}</button>
                </form>
                {!meal.locked ? (
                  <form action={swapAction}>
                    <input type="hidden" name="planId" value={plan.id} />
                    <input type="hidden" name="mealId" value={meal.id} />
                    <button className={cx(btn.quiet, "px-2")} data-testid="swap" title="Give me another">
                      Another
                    </button>
                  </form>
                ) : null}
                <form action={cookedAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="mealId" value={meal.id} />
                  <input type="hidden" name="cooked" value={meal.cookedAt ? "0" : "1"} />
                  <button className={cx(btn.quiet, "px-2")}>{meal.cookedAt ? "Undo" : "Cooked"}</button>
                </form>
                <form action={removeMealAction}>
                  <input type="hidden" name="planId" value={plan.id} />
                  <input type="hidden" name="mealId" value={meal.id} />
                  <button className={cx(btn.quiet, "px-2 hover:text-danger")} aria-label="Remove meal">✕</button>
                </form>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <div className="mt-5 flex flex-wrap gap-2">
        <form action={generateListAction}>
          <input type="hidden" name="planId" value={plan.id} />
          <Button type="submit" variant="harvest" disabled={!meals.length} data-testid="generate-list">
            {list ? "Regenerate shopping list" : "Generate shopping list"}
          </Button>
        </form>
        {list ? (
          <LinkButton href={`/list/${list.id}`} data-testid="open-list">
            Open list
          </LinkButton>
        ) : null}
      </div>

      {seasonal.length || season.length ? (
        <Section title={`In season · ${MONTH_FI[seasonMonth]}`}>
          <div className="rounded-3xl bg-chanterelle-soft/70 p-4" data-testid="season">
            <div className="flex flex-wrap gap-1.5">
              {season.map((n) => (
                <span key={n} className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-xs font-semibold">
                  <span className="h-2.5 w-2.5 rounded-full ring-1 ring-black/10" style={{ background: foodColor(n) }} aria-hidden />
                  {n}
                </span>
              ))}
            </div>
            {seasonal.length ? (
              <ul className="mt-3 space-y-2">
                {seasonal.slice(0, 3).map(({ recipe: r, uses }) => (
                  <li key={r.id} className="flex items-center gap-3">
                    <RecipeCircle recipe={r} ingredients={r.ingredients} size={36} />
                    <div className="min-w-0 flex-1">
                      <Link href={`/recipes/${r.id}`} className="text-sm font-semibold hover:underline">
                        {r.title}
                      </Link>
                      <div className="text-xs text-muted">uses {uses.join(", ")}</div>
                    </div>
                    <form action={addMealAction}>
                      <input type="hidden" name="planId" value={plan.id} />
                      <input type="hidden" name="recipeId" value={r.id} />
                      <button className={btn.small}>+ Add</button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted">None of your recipes use these yet.</p>
            )}
          </div>
        </Section>
      ) : null}

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
        <ul className="divide-y divide-line rounded-3xl bg-surface px-4 shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]">
          {recipes.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 px-1 py-2.5">
              <RecipeCircle recipe={r} ingredients={ingOf.get(r.id) ?? []} size={40} className="shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{r.title}</div>
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  {traitsOf.get(r.id) ? <TraitBadges compact traits={traitsOf.get(r.id)!} /> : null}
                  {r.tags.slice(0, 2).join(", ")}
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
