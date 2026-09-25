import Link from "next/link";
import { listPlans } from "@/lib/services/plans";
import { createPlanAction } from "@/app/actions/plans";
import { mondayOf, todayHelsinki } from "@/lib/domain/offers";
import { Button, Card, Empty, Field, PageTitle, Section, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

function weekLabel(weekStart: string) {
  const [y, m, d] = weekStart.split("-").map(Number);
  return `Week of ${d}.${m}.${y}`;
}

export default async function PlansPage() {
  const plans = await listPlans();
  const thisMonday = mondayOf(todayHelsinki());
  return (
    <div>
      <PageTitle sub="Pick recipes yourself, or let the app propose a week.">Meal plans</PageTitle>
      <Card>
        <form action={createPlanAction} className="grid grid-cols-[1fr_auto] items-end gap-3">
          <Field label="Week starting">
            <input type="date" name="weekStart" defaultValue={thisMonday} className={inputCls} />
          </Field>
          <Field label="Servings">
            <input name="servings" defaultValue={2} inputMode="numeric" className={`${inputCls} w-20`} />
          </Field>
          <Button type="submit" className="col-span-2" data-testid="new-plan">
            New plan
          </Button>
        </form>
      </Card>
      <Section title="Plans">
        {plans.length === 0 ? (
          <Empty>No plans yet.</Empty>
        ) : (
          <ul className="divide-y divide-line border-y border-line">
            {plans.map((p) => (
              <li key={p.id}>
                <Link href={`/plan/${p.id}`} className="flex justify-between px-1 py-3.5 hover:bg-surface-2">
                  <span className="font-medium">{p.name || weekLabel(p.weekStart)}</span>
                  <span className="text-xs text-muted">{p.weekStart === thisMonday ? "this week" : p.mode}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className="mt-6 text-sm text-muted">
        <Link href="/history" className="underline">
          Cooking history
        </Link>
      </p>
    </div>
  );
}
