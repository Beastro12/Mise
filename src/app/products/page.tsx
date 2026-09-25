import Link from "next/link";
import { getMapping, listMappings, searchSMarketProducts, type ProductRow } from "@/lib/services/products";
import { clearMappingAction, manualProductAction, mapProductAction } from "@/app/actions/stores";
import { formatPrice } from "@/lib/domain/offers";
import { CANONICAL_UNITS } from "@/lib/domain/units";
import { Badge, Button, Card, Empty, Field, LinkButton, PageTitle, Section, btn, cx, inputCls } from "@/components/ui";

export const dynamic = "force-dynamic";

function ProductLine({ p }: { p: ProductRow }) {
  return (
    <div className="min-w-0">
      <div className="font-medium">
        {p.name} {p.source === "mock" ? <Badge tone="warn">MOCK</Badge> : p.source === "manual" ? <Badge>manual</Badge> : null}
      </div>
      <div className="text-xs text-muted tabular">
        {p.packSize ? `${String(p.packSize).replace(".", ",")} ${p.packUnit ?? ""} · ` : ""}
        {p.price != null ? formatPrice(p.price) : "no price"}
        {p.unitPrice != null ? ` · ${formatPrice(p.unitPrice)}/${p.unitPriceUnit}` : ""}
        {p.ean ? ` · EAN ${p.ean}` : ""}
        {p.source !== "mock" ? ` · id ${p.externalId}` : ""}
      </div>
    </div>
  );
}

export default async function ProductsPage(props: PageProps<"/products">) {
  const sp = await props.searchParams;
  const name = typeof sp.name === "string" ? sp.name.trim().toLowerCase() : "";
  const back = typeof sp.return === "string" && sp.return.startsWith("/") ? sp.return : "";
  const q = typeof sp.q === "string" && sp.q.trim() ? sp.q.trim() : name;
  const all = sp.all === "1";

  if (!name) {
    const maps = await listMappings();
    return (
      <div>
        <PageTitle sub="Ingredient → S-kaupat product. Chosen once per ingredient; used for pack counts, prices and the S-market export.">
          Product matches
        </PageTitle>
        {maps.length === 0 ? (
          <Empty>No matches yet. Open a shopping list item and tap “Match product”.</Empty>
        ) : (
          <ul className="divide-y divide-line rounded-3xl bg-surface px-4 shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]">
            {maps.map(({ map, product }) => (
              <li key={map.id} className="flex items-center justify-between gap-2 px-1 py-2.5">
                <div className="min-w-0">
                  <Link href={`/products?name=${encodeURIComponent(map.nameFi)}`} className="text-sm font-semibold hover:underline">
                    {map.nameFi}
                  </Link>
                  <ProductLine p={product} />
                </div>
                <form action={clearMappingAction}>
                  <input type="hidden" name="nameFi" value={map.nameFi} />
                  <input type="hidden" name="storeId" value={map.storeId} />
                  <button className={cx(btn.small, "text-danger")}>✕</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const [current, result] = await Promise.all([getMapping(name, "smarket"), searchSMarketProducts(q)]);
  const candidates = result.products.filter((p) => p.id !== current?.product.id);
  const shown = all ? candidates : candidates.slice(0, 3);

  return (
    <div>
      <PageTitle sub="Pick the S-market product for this ingredient. Remembered for next time." action={back ? <LinkButton href={back}>Back</LinkButton> : null}>
        {name}
      </PageTitle>

      {current ? (
        <Card className="mb-4">
          <div className="mb-1 text-xs font-bold text-primary">Current match</div>
          <ProductLine p={current.product} />
        </Card>
      ) : null}

      <form className="mb-3 flex gap-2">
        <input type="hidden" name="name" value={name} />
        {back ? <input type="hidden" name="return" value={back} /> : null}
        <input name="q" defaultValue={q} className={inputCls} placeholder="Search S-kaupat" />
        <Button variant="secondary">Search</Button>
      </form>

      <div className="mb-2 flex items-center gap-2 text-xs text-muted">
        Source: <Badge tone={result.adapter.status === "VERIFIED" ? "accent" : "warn"}>{result.adapter.status}</Badge> {result.adapter.description}
        {result.cached ? " · cached" : ""}
      </div>
      {result.error ? <p className="mb-2 text-sm text-warn">Store data unavailable ({result.error}); showing cached/manual products.</p> : null}

      {shown.length === 0 ? (
        <Empty>No candidates. Add the product by hand below (copy the details from the S-kaupat app).</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-3xl bg-surface px-4 shadow-[0_12px_28px_-22px_rgba(60,40,10,.45)]" data-testid="candidates">
          {shown.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 px-1 py-2.5">
              <ProductLine p={p} />
              <form action={mapProductAction}>
                <input type="hidden" name="nameFi" value={name} />
                <input type="hidden" name="storeId" value="smarket" />
                <input type="hidden" name="productId" value={p.id} />
                <input type="hidden" name="return" value={back} />
                <button className={btn.primary} data-testid="pick-product">
                  Use
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      {!all && candidates.length > 3 ? (
        <Link className="mt-2 inline-block text-sm underline" href={`/products?name=${encodeURIComponent(name)}&q=${encodeURIComponent(q)}&all=1${back ? `&return=${encodeURIComponent(back)}` : ""}`}>
          Show {candidates.length - 3} more
        </Link>
      ) : null}

      <Section title="Add product by hand">
        <Card>
          <form action={manualProductAction} className="space-y-3">
            <input type="hidden" name="nameFi" value={name} />
            <input type="hidden" name="return" value={back} />
            <Field label="Product name">
              <input name="name" required className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="S-kaupat product id">
                <input name="externalId" className={inputCls} />
              </Field>
              <Field label="EAN">
                <input name="ean" inputMode="numeric" className={inputCls} />
              </Field>
              <Field label="Pack size">
                <input name="packSize" inputMode="decimal" className={inputCls} />
              </Field>
              <Field label="Pack unit">
                <select name="packUnit" className={inputCls} defaultValue="g">
                  {CANONICAL_UNITS.map((u) => (
                    <option key={u}>{u}</option>
                  ))}
                </select>
              </Field>
              <Field label="Price €">
                <input name="price" inputMode="decimal" className={inputCls} />
              </Field>
              <Field label="Unit price €/kg or €/l">
                <input name="unitPrice" inputMode="decimal" className={inputCls} />
              </Field>
            </div>
            <input type="hidden" name="unitPriceUnit" value="" />
            <Button type="submit" variant="secondary">
              Save & use
            </Button>
          </form>
        </Card>
      </Section>
    </div>
  );
}
