import Link from "next/link";
import { notFound } from "next/navigation";
import { getList } from "@/lib/services/lists";
import { searchSMarketProducts } from "@/lib/services/products";
import { mapProductAction } from "@/app/actions/stores";
import { formatPrice } from "@/lib/domain/offers";
import { Badge, Empty, LinkButton, PageTitle, btn } from "@/components/ui";

export const dynamic = "force-dynamic";

/**
 * First-time matching for a list: every S-market item without a product,
 * each with its top 3 candidates. Picking one remembers it for next time.
 */
export default async function MatchQueuePage(props: PageProps<"/products/match">) {
  const sp = await props.searchParams;
  const listId = typeof sp.list === "string" ? sp.list : "";
  const data = listId ? await getList(listId) : null;
  if (!data) notFound();
  const here = `/products/match?list=${listId}`;
  const unmatched = data.items.filter((i) => i.storeId === "smarket" && i.state === "none" && !i.productId);
  const rows = await Promise.all(unmatched.slice(0, 25).map(async (i) => ({ item: i, res: await searchSMarketProducts(i.nameFi) })));
  const adapter = rows[0]?.res.adapter;

  return (
    <div>
      <PageTitle sub="Pick the S-market product for each new ingredient. Remembered per ingredient." action={<LinkButton href={`/list/${listId}`}>Back to list</LinkButton>}>
        Match products
      </PageTitle>
      {adapter ? (
        <p className="mb-3 text-xs text-muted">
          Source: <Badge tone={adapter.status === "VERIFIED" ? "accent" : "warn"}>{adapter.status}</Badge> {adapter.description}
        </p>
      ) : null}
      {rows.length === 0 ? <Empty>Every S-market item already has a product.</Empty> : null}
      <ul className="border-t border-line">
        {rows.map(({ item, res }) => (
          <li key={item.id} className="border-b border-line py-4">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="font-semibold">{item.nameFi}</span>
              <Link className="text-xs underline" href={`/products?name=${encodeURIComponent(item.nameFi)}&return=${encodeURIComponent(here)}`}>
                search / add by hand
              </Link>
            </div>
            {res.products.length === 0 ? (
              <p className="text-sm text-muted">No candidates.</p>
            ) : (
              <ul className="space-y-1.5">
                {res.products.slice(0, 3).map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0">
                      {p.name} {p.source === "mock" ? <Badge tone="warn">MOCK</Badge> : null}
                      <span className="block text-xs text-muted tabular">
                        {p.packSize ? `${String(p.packSize).replace(".", ",")} ${p.packUnit ?? ""}` : ""}
                        {p.price != null ? ` · ${formatPrice(p.price)}` : ""}
                      </span>
                    </span>
                    <form action={mapProductAction}>
                      <input type="hidden" name="nameFi" value={item.nameFi} />
                      <input type="hidden" name="storeId" value="smarket" />
                      <input type="hidden" name="productId" value={p.id} />
                      <input type="hidden" name="return" value={here} />
                      <button className={btn.small}>Use</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
