import Link from "next/link";
import { listRules, listStaples } from "@/lib/services/settings";
import { addStapleAction, removeRuleAction, removeStapleAction, setRuleAction } from "@/app/actions/stores";
import { Button, Card, Empty, PageTitle, Section, StoreBadge, btn, cx, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const [staples, rules] = await Promise.all([listStaples(), listRules()]);
  return (
    <div>
      <PageTitle>Staples & rules</PageTitle>

      <Section title="Staples">
        <p className="mb-2 text-sm text-muted">These go to a “Have it?” question instead of straight onto the list.</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {staples.map((s) => (
            <form key={s} action={removeStapleAction}>
              <input type="hidden" name="nameFi" value={s} />
              <button className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-sm hover:line-through">{s} ✕</button>
            </form>
          ))}
        </div>
        <form action={addStapleAction} className="flex gap-2">
          <input name="nameFi" placeholder="Finnish name, e.g. sokeri" className={inputCls} />
          <Button variant="secondary">Add</Button>
        </form>
      </Section>

      <Section title="Store rules">
        {rules.length === 0 ? (
          <Empty>No rules. On a list item choose “Always buy X at Lidl”.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-3xl bg-surface px-4 shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]">
            {rules.map((r) => (
              <li key={r.nameFi} className="flex items-center justify-between px-1 py-2.5">
                <span>
                  {r.nameFi} → <StoreBadge storeId={r.storeId} />
                </span>
                <form action={removeRuleAction}>
                  <input type="hidden" name="nameFi" value={r.nameFi} />
                  <button className={cx(btn.small, "text-danger")}>✕</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <Card className="mt-3">
          <form action={setRuleAction} className="flex gap-2">
            <input name="nameFi" placeholder="ingredient (Finnish)" className={inputCls} />
            <select name="storeId" className={`${inputCls} w-32`}>
              <option value="lidl">Lidl</option>
              <option value="smarket">S-market</option>
            </select>
            <Button variant="secondary">Add</Button>
          </form>
        </Card>
      </Section>

      <p className="mt-6 text-sm">
        <Link href="/settings/synonyms" className="underline">
          Edit ingredient synonyms →
        </Link>
      </p>
    </div>
  );
}
