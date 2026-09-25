import { listHousehold } from "@/lib/services/household";
import { addHouseholdAction, boughtTodayAction, deleteHouseholdAction, toggleHouseholdAction, updateHouseholdAction } from "@/app/actions/household";
import { HOUSEHOLD_SUGGESTIONS, isDue, nextDue } from "@/lib/domain/household";
import { daysBetween, todayHelsinki } from "@/lib/domain/offers";
import { formatQty } from "@/lib/domain/units";
import { Badge, Button, Card, Empty, Field, PageTitle, Section, btn, cx, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

function dueText(next: string | null, today: string) {
  if (!next) return "not bought yet";
  const d = daysBetween(today, next);
  if (d < 0) return `ran out ${-d} d ago`;
  if (d === 0) return "runs out today";
  return `in ${d} d`;
}

export default async function HouseholdPage() {
  const items = await listHousehold();
  const today = todayHelsinki();
  const have = new Set(items.map((i) => i.nameFi));
  const suggestions = HOUSEHOLD_SUGGESTIONS.filter((s) => !have.has(s.nameFi));
  return (
    <div>
      <PageTitle sub="Toilet paper, coffee, dish soap… Anything due before your next shop is suggested on the week's list.">Refills</PageTitle>
      <Card>
        <form action={addHouseholdAction} className="space-y-3">
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <Field label="Item">
              <input name="text" placeholder="e.g. 1 pkt wc-paperi" className={inputCls} data-testid="household-add" />
            </Field>
            <Field label="Every (days)">
              <input name="interval" defaultValue={14} inputMode="numeric" className={cx(inputCls, "w-24")} />
            </Field>
          </div>
          <Button type="submit">Add refill</Button>
        </form>
        {suggestions.length ? (
          <div className="mt-4 flex flex-wrap gap-1.5">
            {suggestions.map((s) => (
              <form key={s.nameFi} action={addHouseholdAction}>
                <input type="hidden" name="text" value={`${s.quantity ?? ""} ${s.unit ?? ""} ${s.nameFi}`.trim()} />
                <input type="hidden" name="name" value={s.name} />
                <input type="hidden" name="nameFi" value={s.nameFi} />
                <input type="hidden" name="interval" value={s.intervalDays} />
                <button className={btn.small} data-testid="household-suggestion">
                  + {s.name}
                </button>
              </form>
            ))}
          </div>
        ) : null}
      </Card>

      <Section title="Your refills">
        {items.length === 0 ? (
          <Empty>No refills yet. Tap a suggestion above to start.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-3xl bg-surface px-4 shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]">
            {items.map((i) => {
              const next = nextDue(i);
              const due = isDue(i, today);
              return (
                <li key={i.id} className={cx("py-3", !i.active && "opacity-50")} data-testid="household-item" data-name={i.nameFi}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold">
                      {i.name} <span className="font-normal text-muted">{formatQty(i)}</span>
                    </span>
                    {due && i.active ? <Badge tone="lidl">due</Badge> : <span className="text-xs text-muted">{dueText(next, today)}</span>}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    <form action={updateHouseholdAction} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={i.id} />
                      <span className="text-xs text-muted">every</span>
                      <input
                        name="interval"
                        defaultValue={i.intervalDays}
                        inputMode="numeric"
                        aria-label="Interval days"
                        className="w-12 rounded-full border border-line bg-surface px-2 py-0.5 text-center text-sm"
                      />
                      <button className={btn.quiet}>days</button>
                    </form>
                    <form action={boughtTodayAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className={btn.quiet}>Bought today</button>
                    </form>
                    <form action={toggleHouseholdAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <input type="hidden" name="active" value={i.active ? "0" : "1"} />
                      <button className={btn.quiet}>{i.active ? "Pause" : "Resume"}</button>
                    </form>
                    <form action={deleteHouseholdAction}>
                      <input type="hidden" name="id" value={i.id} />
                      <button className={cx(btn.quiet, "hover:text-danger")} aria-label="Delete">
                        ✕
                      </button>
                    </form>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>
    </div>
  );
}
