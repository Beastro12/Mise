import { NextResponse } from "next/server";
import { noStore, publicRoute } from "@/lib/api";
import { getListByToken } from "@/lib/services/lists";
import { toClientList } from "@/lib/services/client-list";

export const dynamic = "force-dynamic";

/** Shared (spouse) view of one list, authorised by the unguessable token only. */
export async function GET(_req: Request, ctx: RouteContext<"/api/share/[token]">) {
  return publicRoute(async () => {
    const { token } = await ctx.params;
    const data = await getListByToken(token);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toClientList(data, false), noStore);
  });
}
