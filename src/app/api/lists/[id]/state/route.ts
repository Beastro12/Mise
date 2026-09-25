import { NextResponse } from "next/server";
import { noStore, ownerRoute } from "@/lib/api";
import { getListState } from "@/lib/services/lists";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/lists/[id]/state">) {
  return ownerRoute(async () => {
    const { id } = await ctx.params;
    const state = await getListState(id);
    if (!state) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(state, noStore);
  });
}
