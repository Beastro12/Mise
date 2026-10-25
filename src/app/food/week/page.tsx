import Link from "next/link";
import { weekView } from "@/lib/services/nutrition";
import { logPlannedAction } from "@/app/actions/nutrition";
import { MEALS, MEAL_LABEL } from "@/lib/domain/nutrition";
import { addDays, mondayOf, todayHelsinki } from "@/lib/domain/offers";
import { Badge, Card, Empty, LinkButton, Notice, PageTitle, Section, btn, cx } from "@/components/ui";

export const dynamic = "force-dynamic";

const WEEKDAY = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const short = (day: string) => {
  const [, m, d] = day.split("-").map(Number);
  return `${d}.${m}.`;
};
const signed = (n: number) => (n > 0 ? `+${n}` : `${n}`);

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl bg-surface-2/70 px-3 py-2.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="font-display text-2xl font-[650] tabular-nums">{value}</div>
      {sub ? <div className="text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

export default async function FoodWeekPage(props: PageProps<"/food/week">) {
  const sp = await props.searchParams;
  const today = todayHelsinki();
  // Default: the last full week (the one you've finished logging).
  const start = mondayOf(typeof sp.start === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.start) ? sp.start : addDays(mondayOf(today), -7));
  const { profile, summary, target, plan, healthDays } = await weekView(start);
  const planStart = addDays(start, 7);

  return (
    <div>
      <PageTitle sub={`Logged week ${short(start)}–${short(addDays(start, 6))}, and a plan for the week after.`}>Week & plan</PageTitle>
      <div className="mb-5 flex items-center justify-between">
        <Link className={btn.quiet} href={`/food/week?start=${addDays(start, -7)}`}>
          ← Earlier week
        </Link>
        <Link className={btn.quiet} href={`/food/week?start=${addDays(start, 7)}`}>
          Later week →
        </Link>
      </div>

      {summary.loggedDays === 0 ? (
        <Empty>
          Nothing logged {short(start)}–{short(addDays(start, 6))}. Log a few days on the{" "}
          <Link href={`/food?day=${start}`} className="underline">
            Calories
          </Link>{" "}
          page, then come back for the plan.
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5" data-testid="week-stats">
            <Stat label="Eaten / day" value={`${summary.avgIntake}`} sub={`${summary.loggedDays} of 7 days logged`} />
            <Stat label="Burned / day" value={`${summary.avgBurn}`} sub={healthDays ? "from your tracker data" : "estimated (no tracker data)"} />
            <Stat label="Balance / day" value={signed(summary.avgBalance!)} sub={summary.avgBalance! < 0 ? "deficit" : "surplus"} />
            <Stat label="Weight / week" value={`${signed(summary.weeklyKg!)} kg`} sub="if every day were like this" />
          </div>

          <Section title="Where the calories were">
            <Card>
              <ul className="space-y-3">
                {MEALS.filter((m) => summary.perMeal[m] > 0).map((m) => {
                  const pct = Math.round((summary.perMeal[m] / Math.max(1, summary.avgIntake!)) * 100);
                  return (
                    <li key={m}>
                      <div className="flex justify-between text-sm">
                        <span className="font-semibold">{MEAL_LABEL[m]}</span>
                        <span className="tabular-nums text-muted">
                          {summary.perMeal[m]} kcal · {pct} %
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="mt-1 text-xs text-muted">{summary.topFoods[m].map((f) => `${f.name} (${f.kcal}${f.times > 1 ? `, ×${f.times}` : ""})`).join(" · ")}</div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </Section>

          <Section title={`Plan · week of ${short(planStart)}`}>
            <Card className="mb-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                <span>
                  Target <b className="tabular-nums">{target.target}</b> kcal/day
                </span>
                <span className="text-muted">
                  = {summary.avgBurn} burned − {target.deficit} deficit
                </span>
              </div>
              <div className="mt-1 text-xs text-muted">
                ≈ {Math.round(((target.deficit * 7) / 7700) * 100) / 100} kg a week. Wanted deficit {profile.deficitKcal} kcal
                {target.limitedBy ? ` (${target.limitedBy})` : ""}.{" "}
                <Link href="/food/setup" className="underline">
                  Change
                </Link>
              </div>
              {plan!.dailyCut > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {MEALS.filter((m) => summary.perMeal[m] > 0).map((m) => (
                    <Badge key={m} tone={plan!.budgets[m] < summary.perMeal[m] ? "lidl" : "neutral"}>
                      {MEAL_LABEL[m]} {summary.perMeal[m]} → {plan!.budgets[m]}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </Card>
            {plan!.notes.length ? (
              <div className="mb-3 space-y-2">
                {plan!.notes.map((n) => (
                  <Notice key={n} tone="accent">
                    {n}
                  </Notice>
                ))}
              </div>
            ) : null}

            <div className="space-y-3" data-testid="deficit-plan">
              {plan!.days.map((d, i) => (
                <Card key={d.day} className="p-4">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="font-display text-lg font-[620]">
                      {WEEKDAY[i]} {short(d.day)}
                    </h3>
                    <span className={cx("text-sm font-semibold tabular-nums", d.kcal > d.target + 50 ? "text-danger" : "text-accent")}>
                      {d.kcal} / {d.target}
                    </span>
                  </div>
                  <ul className="space-y-2.5">
                    {d.meals.map((m) => (
                      <li key={m.meal} className="flex items-start justify-between gap-2" data-testid="plan-meal">
                        <div className="min-w-0 text-sm">
                          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
                            {MEAL_LABEL[m.meal]}
                            {m.template && m.factor < 0.98 ? <span className="ml-1.5 normal-case text-chanterelle-deep">{Math.round(m.factor * 100)} % portion</span> : null}
                          </div>
                          {m.template ? (
                            <div>
                              {m.items.map((it, k) => (
                                <span key={k}>
                                  {k ? " + " : ""}
                                  {it.recipeId ? (
                                    <Link href={`/recipes/${it.recipeId}`} className="underline decoration-line underline-offset-2">
                                      {it.name}
                                    </Link>
                                  ) : (
                                    it.name
                                  )}
                                  {it.portion ? <span className="text-muted"> ({it.portion})</span> : null}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="text-muted">Skip</div>
                          )}
                        </div>
                        {m.template ? (
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="text-sm font-semibold tabular-nums">{m.kcal}</span>
                            {d.day <= today ? (
                              <form action={logPlannedAction}>
                                <input type="hidden" name="day" value={d.day} />
                                <input type="hidden" name="meal" value={m.meal} />
                                <input type="hidden" name="items" value={JSON.stringify(m.items)} />
                                <button className={btn.small}>Ate this</button>
                              </form>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted">
              Each meal reuses something you logged for that meal, shrunk to its budget (never below half a portion). Snacks are cut first. Calories and burn are estimates; for medical
              conditions, pregnancy or a history of disordered eating, plan a deficit with a professional.
            </p>
          </Section>
        </>
      )}
      <div className="mt-8">
        <LinkButton href={`/food?day=${planStart <= today ? planStart : today}`}>Back to log</LinkButton>
      </div>
    </div>
  );
}
