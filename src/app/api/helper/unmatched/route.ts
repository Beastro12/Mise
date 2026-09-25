import { NextResponse } from "next/server";
import { publicRoute, noStore } from "@/lib/api";
import { isHelperRequest } from "@/lib/helper-auth";
import { getList, listLists } from "@/lib/services/lists";

export const dynamic = "force-dynamic";

/**
 * S-market items on a list that still need a real S-kaupat product
 * (none matched, or only a MOCK one). ?list=<id>, default = most recent list.
 */
export async function GET(req: Request) {
  return publicRoute(async () => {
    if (!(await isHelperRequest(req))) return NextResponse.json({ error: "Invalid helper key" }, { status: 401 });
    const listId = new URL(req.url).searchParams.get("list") || (await listLists())[0]?.id;
    const data = listId ? await getList(listId) : null;
    if (!data) return NextResponse.json({ error: "No shopping list yet" }, { status: 404 });
    const products = new Map(data.products.map((p) => [p.id, p]));
    const items = data.items
      .filter((i) => i.storeId === "smarket" && (i.state === "none" || i.state === "refill"))
      .filter((i) => !i.productId || products.get(i.productId)?.source === "mock")
      .map((i) => ({ nameFi: i.nameFi, displayName: i.displayName, quantity: i.quantity, unit: i.unit, household: !!i.householdItemId }));
    const unique = [...new Map(items.map((i) => [i.nameFi, i])).values()];
    return NextResponse.json({ list: { id: data.list.id, name: data.list.name }, items: unique }, noStore);
  });
}
