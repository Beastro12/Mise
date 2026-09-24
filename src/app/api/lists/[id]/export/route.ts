import { NextResponse } from "next/server";
import { ownerRoute } from "@/lib/api";
import { exportSMarket } from "@/lib/services/lists";

export const dynamic = "force-dynamic";

/** "Export S-market list": seam for the future S-kaupat cart automation. */
export async function GET(_req: Request, ctx: RouteContext<"/api/lists/[id]/export">) {
  return ownerRoute(async () => {
    const { id } = await ctx.params;
    const data = await exportSMarket(id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="s-market-list-${id.slice(0, 8)}.json"`,
        "cache-control": "no-store",
      },
    });
  });
}
