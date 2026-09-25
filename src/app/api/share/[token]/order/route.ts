import { NextResponse } from "next/server";
import { noStore, publicRoute } from "@/lib/api";
import { getListByToken, orderForHelper } from "@/lib/services/lists";
import { getDeliveryPrefs } from "@/lib/services/settings";

export const dynamic = "force-dynamic";

/** Order feed for the S-kaupat helper on your Mac; authorised by the list's share token. */
export async function GET(_req: Request, ctx: RouteContext<"/api/share/[token]/order">) {
  return publicRoute(async () => {
    const { token } = await ctx.params;
    const data = await getListByToken(token);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await orderForHelper(data.list.id, await getDeliveryPrefs()), noStore);
  });
}
