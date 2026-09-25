import Link from "next/link";
import { getSectionOrder, listStores } from "@/lib/services/settings";
import { moveSectionAction, updateSMarketAction } from "@/app/actions/stores";
import { SECTIONS } from "@/lib/domain/sections";
import type { StoreId } from "@/db/schema";
import { Button, Card, Field, PageTitle, Section, btn, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function StoresPage() {
  const stores = await listStores();
  const smarket = stores.find((s) => s.id === "smarket")!;
  const orders = { smarket: await getSectionOrder("smarket"), lidl: await getSectionOrder("lidl") };
  return (
    <div>
      <PageTitle sub="Everything defaults to S-market; items move to Lidl only on a cheaper Lidl offer.">Stores</PageTitle>
      <Card>
        <form action={updateSMarketAction} className="space-y-3">
          <Field label="S-market / Prisma store" hint="The store you pick in S-kaupat, e.g. “S-market Nummi, Turku”.">
            <input name="name" defaultValue={smarket.name} className={inputCls} />
          </Field>
          <Field label="S-kaupat store id (optional)" hint="Used by a future verified S-kaupat adapter; stored with exported products.">
            <input name="externalId" defaultValue={smarket.externalId ?? ""} className={inputCls} />
          </Field>
          <Button type="submit">Save</Button>
        </form>
      </Card>
      <Card className="mt-3">
        <div className="font-medium">Lidl Vähäheikkilä</div>
        <div className="text-sm text-muted">Vähäheikkiläntie 58, 20810 Turku</div>
        <Link href="/stores/lidl" className="mt-2 inline-block text-sm underline">
          Weekly offers →
        </Link>
      </Card>
      {(["smarket", "lidl"] as StoreId[]).map((sid) => (
        <Section key={sid} title={`Walking order · ${sid === "lidl" ? "Lidl" : "S-market"}`}>
          <ol className="divide-y divide-line rounded-3xl bg-surface px-4 shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]" data-testid={`order-${sid}`}>
            {orders[sid].map((key, i) => (
              <li key={key} className="flex items-center justify-between px-1 py-2.5">
                <span>
                  <span className="mr-2 text-xs text-muted tabular">{i + 1}.</span>
                  {SECTIONS.find((s) => s.key === key)?.fi}
                </span>
                <span className="flex gap-1">
                  <form action={moveSectionAction}>
                    <input type="hidden" name="storeId" value={sid} />
                    <input type="hidden" name="section" value={key} />
                    <input type="hidden" name="dir" value="up" />
                    <button className={btn.small} disabled={i === 0} aria-label={`Move ${key} up`}>
                      ↑
                    </button>
                  </form>
                  <form action={moveSectionAction}>
                    <input type="hidden" name="storeId" value={sid} />
                    <input type="hidden" name="section" value={key} />
                    <input type="hidden" name="dir" value="down" />
                    <button className={btn.small} disabled={i === orders[sid].length - 1} aria-label={`Move ${key} down`}>
                      ↓
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ol>
        </Section>
      ))}
    </div>
  );
}
