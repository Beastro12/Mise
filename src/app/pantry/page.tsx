import { listPantry } from "@/lib/services/pantry";
import { addPantryAction, updatePantryAction, usedUpAction } from "@/app/actions/pantry";
import { SECTIONS } from "@/lib/domain/sections";
import { formatQty } from "@/lib/domain/units";
import { SectionIcon } from "@/components/icons";
import { Button, Card, Empty, PageTitle, btn, cx, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PantryPage() {
  const items = await listPantry();
  return (
    <div>
      <PageTitle sub="What's at home. Subtracted when a list is generated.">Pantry</PageTitle>
      <Card>
        <form action={addPantryAction} className="flex gap-2">
          <input name="text" placeholder="e.g. 5 dl kermaa, or just suola" className={inputCls} data-testid="pantry-add" />
          <Button type="submit">Add</Button>
        </form>
      </Card>
      <div className="mt-8 space-y-7">
        {items.length === 0 ? <Empty>The pantry is empty.</Empty> : null}
        {SECTIONS.map((s) => {
          const inSection = items.filter((i) => i.category === s.key);
          if (!inSection.length) return null;
          return (
            <div key={s.key}>
              <div className="flex items-center gap-1.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
                <SectionIcon section={s.key} />
                {s.fi}
              </div>
              <ul className="divide-y divide-line border-y border-line" data-testid="pantry-list">
                {inSection.map((i) => (
                  <li key={i.id} className="px-1 py-2.5" data-testid="pantry-item" data-name={i.nameFi}>
                    <details>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                        <span className="font-medium">{i.nameFi.charAt(0).toUpperCase() + i.nameFi.slice(1)}</span>
                        <span className="text-sm text-muted tabular">{formatQty(i) || i.note || "some"}</span>
                      </summary>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <form action={updatePantryAction} className="flex items-center gap-1.5">
                          <input type="hidden" name="id" value={i.id} />
                          <input name="quantity" defaultValue={i.quantity ?? ""} placeholder="qty" inputMode="decimal" className={cx(inputCls, "w-20 py-1")} />
                          <input name="unit" defaultValue={i.unit ?? ""} placeholder="unit" className={cx(inputCls, "w-16 py-1")} />
                          <input name="note" defaultValue={i.note ?? ""} placeholder="note" className={cx(inputCls, "w-28 py-1")} />
                          <button className={btn.small}>Save</button>
                        </form>
                        <form action={usedUpAction}>
                          <input type="hidden" name="id" value={i.id} />
                          <button className={cx(btn.small, "text-danger")}>Used up</button>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
