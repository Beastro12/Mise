import { listCurrentOffers, defaultValidity } from "@/lib/services/offers";
import { addOfferAction, clearExpiredOffersAction, deleteOfferAction, renameOfferAction } from "@/app/actions/stores";
import { formatPrice, isActive, todayHelsinki } from "@/lib/domain/offers";
import { aiAvailable } from "@/lib/ai/client";
import { OffersImport } from "@/components/offers-import";
import { Badge, Button, Card, Empty, Field, PageTitle, Section, btn, cx, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";
// Claude extraction of several pages can take a while (server actions inherit this).
export const maxDuration = 300;

const fmt = (d: string) => {
  const [, m, day] = d.split("-").map(Number);
  return `${day}.${m}.`;
};

export default async function LidlOffersPage() {
  const today = todayHelsinki();
  const offers = await listCurrentOffers(today);
  const v = defaultValidity(today);
  return (
    <div>
      <PageTitle sub="Items move to Lidl only when they match one of these offers (and it's cheaper, if the S-market price is known).">
        Lidl offers
      </PageTitle>
      <Card>
        <OffersImport from={v.from} to={v.to} aiReady={aiAvailable()} />
      </Card>

      <Section title={`Current & upcoming (${offers.length})`} action={<form action={clearExpiredOffersAction}><button className={btn.small}>Clear expired</button></form>}>
        {offers.length === 0 ? (
          <Empty>No offers yet. Import this week&apos;s leaflet above.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-3xl bg-surface px-4 shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]" data-testid="offers">
            {offers.map((o) => (
              <li key={o.id} className="px-1 py-2.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{o.productName}</span>
                  <span className="shrink-0 tabular">{formatPrice(o.price)}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                  <Badge tone={isActive(o, today) ? "lidl" : "neutral"}>
                    {fmt(o.validFrom)}–{fmt(o.validTo)}
                  </Badge>
                  {o.unitPrice ? <span>{formatPrice(o.unitPrice)}/{o.unitPriceUnit}</span> : null}
                  <span>{o.source === "mock" ? "MOCK" : o.source.replace("_", " ")}</span>
                  <form action={renameOfferAction} className="flex items-center gap-1">
                    <input type="hidden" name="id" value={o.id} />
                    <input name="nameFi" defaultValue={o.nameFi} aria-label="Finnish name" className={cx(inputCls, "w-32 px-2 py-0.5 text-xs")} />
                    <button className={btn.small}>set</button>
                  </form>
                  <form action={deleteOfferAction}>
                    <input type="hidden" name="id" value={o.id} />
                    <button className={cx(btn.small, "text-danger")}>✕</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">The Finnish name decides which shopping-list items an offer matches.</p>
      </Section>

      <Section title="Add one offer">
        <Card>
          <form action={addOfferAction} className="space-y-3">
            <Field label="Product">
              <input name="productName" required placeholder="Kermaviili 10 % 200 g" className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Price €">
                <input name="price" required inputMode="decimal" placeholder="0,49" className={inputCls} />
              </Field>
              <Field label="Finnish name" hint="blank = automatic">
                <input name="nameFi" placeholder="kermaviili" className={inputCls} />
              </Field>
              <Field label="Valid from">
                <input type="date" name="validFrom" defaultValue={v.from} className={inputCls} />
              </Field>
              <Field label="Valid to">
                <input type="date" name="validTo" defaultValue={v.to} className={inputCls} />
              </Field>
            </div>
            <Button type="submit" variant="secondary">
              Add offer
            </Button>
          </form>
        </Card>
      </Section>
    </div>
  );
}
