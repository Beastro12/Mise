import { NextResponse } from "next/server";
import { publicRoute } from "@/lib/api";
import { getListByToken, setChecked } from "@/lib/services/lists";

export const dynamic = "force-dynamic";

/** The share link may only check items off (and uncheck them). */
export async function POST(req: Request, ctx: RouteContext<"/api/share/[token]/items/[itemId]">) {
  return publicRoute(async () => {
    const { token, itemId } = await ctx.params;
    const data = await getListByToken(token);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const body = (await req.json()) as { action: string; checked?: boolean };
    if (body.action !== "check") return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    await setChecked(data.list.id, itemId, !!body.checked);
    return NextResponse.json({ ok: true });
  });
}
