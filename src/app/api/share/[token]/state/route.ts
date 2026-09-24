import { NextResponse } from "next/server";
import { noStore, publicRoute } from "@/lib/api";
import { getListByToken, getListState } from "@/lib/services/lists";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/share/[token]/state">) {
  return publicRoute(async () => {
    const { token } = await ctx.params;
    const data = await getListByToken(token);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(await getListState(data.list.id), noStore);
  });
}
