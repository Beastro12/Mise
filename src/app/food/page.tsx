import Link from "next/link";
import { listEntries, listHealth, getProfile, recentFoods } from "@/lib/services/nutrition";
import { listRecipes } from "@/lib/services/recipes";
import { deleteFoodAction } from "@/app/actions/nutrition";
import { MEALS, MEAL_LABEL, dailyBurn, deficitTarget, mealAt, weekDays } from "@/lib/domain/nutrition";
import { addDays, mondayOf, todayHelsinki } from "@/lib/domain/offers";
import { FoodAdd } from "@/components/food-add";
import { Card, LinkButton, Notice, PageTitle, Section, btn, cx } from "@/components/ui";

export const dynamic = "force-dynamic";

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayLabel(day: string, today: string) {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  return `${WEEKDAY[(new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7]} ${d}.${m}.`;
}

export default async function FoodPage(props: PageProps<"/food">) {
  const sp = await props.searchParams;
  const today = todayHelsinki();
  const day = typeof sp.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : today;
  const monday = mondayOf(day);
  const days = weekDays(monday);
  const [profile, week, health, recent, recipes] = await Promise.all([getProfile(), listEntries(monday, days[6]), listHealth(monday, days[6]), recentFoods(), listRecipes()]);

  const entries = week.filter((e) => e.day === day);
  const eaten = entries.reduce((s, e) => s + e.kcal, 0);
  const burn = dailyBurn(health.filter((h) => h.day === day), profile);
  const { target } = deficitTarget(burn.kcal, profile);
  const left = target - eaten;
  const pct = Math.min(100, Math.round((eaten / Math.max(1, target)) * 100));
  const totals = new Map(days.map((d) => [d, week.filter((e) => e.day === d).reduce((s, e) => s + e.kcal, 0)]));
  const maxBar = Math.max(target, ...totals.values(), 1);

  return (
    <div>
      <PageTitle
        sub="Log what you eat by meal. The week view turns it into a similar week at a calorie deficit."
        action={<LinkButton href={`/food/week?start=${monday}`} variant="harvest" className="shrink-0 whitespace-nowrap">Week & plan</LinkButton>}
      >
        Calories
      </PageTitle>

      {!profile.saved ? (
        <div className="mb-4">
          <Notice>
            Set your height, weight and goal first, and import Apple Health or Oura data, on{" "}
            <Link href="/food/setup" className="font-semibold underline">
              Setup
            </Link>
            . Until then, targets use a generic profile.
          </Notice>
        </div>
      ) : null}

      {/* Week strip: one bar per day, the line is that day's target. */}
      <div className="mb-5 grid grid-cols-7 gap-1.5" aria-label="This week">
        {days.map((d, i) => {
          const kcal = totals.get(d) ?? 0;
          return (
            <Link key={d} href={`/food?day=${d}`} className={cx("flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px]", d === day ? "bg-chanterelle-soft text-chanterelle-deep" : "text-muted hover:bg-surface-2")}>
              <span className="relative flex h-14 w-3 items-end overflow-hidden rounded-full bg-surface-2">
                <span className={cx("w-full rounded-full", kcal > target ? "bg-lingon" : "bg-primary")} style={{ height: `${Math.round((kcal / maxBar) * 100)}%` }} />
              </span>
              <span className="font-semibold">{WEEKDAY[i]}</span>
              <span>{kcal ? kcal : "–"}</span>
            </Link>
          );
        })}
      </div>

      <Card>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-display text-xl font-[620]">{dayLabel(day, today)}</h2>
          <div className="flex gap-1">
            <Link className={btn.quiet} href={`/food?day=${addDays(day, -1)}`} aria-label="Previous day">
              ←
            </Link>
            {day !== today ? (
              <Link className={btn.quiet} href="/food">
                Today
              </Link>
            ) : null}
            <Link className={btn.quiet} href={`/food?day=${addDays(day, 1)}`} aria-label="Next day">
              →
            </Link>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className="font-display text-4xl font-[650] tracking-tight" data-testid="day-eaten">
              {eaten}
            </div>
            <div className="text-xs text-muted">kcal eaten of {target} target</div>
          </div>
          <div className="text-right text-sm">
            <div className={cx("font-semibold", left < 0 ? "text-danger" : "text-accent")}>{left >= 0 ? `${left} left` : `${-left} over`}</div>
            <div className="text-xs text-muted">burn {burn.kcal}</div>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2">
          <div className={cx("h-full rounded-full", left < 0 ? "bg-lingon" : "bg-chanterelle")} style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-xs text-muted">{burn.detail}</p>
      </Card>

      <Section title="Add food">
        <Card>
          <FoodAdd day={day} defaultMeal={mealAt()} recent={recent} recipes={recipes.map((r) => ({ id: r.id, title: r.title }))} />
        </Card>
      </Section>

      {MEALS.map((m) => {
        const items = entries.filter((e) => e.meal === m);
        if (!items.length) return null;
        return (
          <Section key={m} title={`${MEAL_LABEL[m]} · ${items.reduce((s, e) => s + e.kcal, 0)} kcal`}>
            <ul className="divide-y divide-line rounded-3xl bg-surface px-4 shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]">
              {items.map((e) => (
                <li key={e.id} className="flex items-center justify-between gap-2 py-3" data-testid="food-entry">
                  <div className="min-w-0">
                    <div className="font-medium">
                      {e.recipeId ? (
                        <Link href={`/recipes/${e.recipeId}`} className="underline decoration-line underline-offset-2">
                          {e.name}
                        </Link>
                      ) : (
                        e.name
                      )}
                    </div>
                    {e.portion ? <div className="text-xs text-muted">{e.portion}</div> : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <span className="text-sm font-semibold tabular-nums">{e.kcal}</span>
                    <form action={deleteFoodAction}>
                      <input type="hidden" name="id" value={e.id} />
                      <button className={cx(btn.quiet, "hover:text-danger")} aria-label={`Delete ${e.name}`}>
                        ✕
                      </button>
                    </form>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        );
      })}

      <p className="mt-8 text-sm text-muted">
        <Link href="/food/setup" className="underline">
          Setup: profile, goal, Apple Health & Oura
        </Link>
      </p>
    </div>
  );
}
