import { NextResponse } from "next/server";
import { noStore, ownerRoute } from "@/lib/api";
import { addManualItem, getList, moveCheckedToPantry, renewShareToken } from "@/lib/services/lists";
import { toClientList } from "@/lib/services/client-list";
import { parseIngredientLine } from "@/lib/domain/ingredient-parser";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/lists/[id]">) {
  return ownerRoute(async () => {
    const { id } = await ctx.params;
    const data = await getList(id);
    if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(toClientList(data, true), noStore);
  });
}

/** List-level actions: add item, move checked to pantry, renew share link. */
export async function POST(req: Request, ctx: RouteContext<"/api/lists/[id]">) {
  return ownerRoute(async () => {
    const { id } = await ctx.params;
    const body = (await req.json()) as { action: string; text?: string };
    if (body.action === "add") {
      const p = parseIngredientLine(String(body.text ?? ""));
      if (!p.name) throw new Error("Empty item");
      await addManualItem(id, { name: p.name, quantity: p.quantity, unit: p.unit });
      return NextResponse.json({ ok: true });
    }
    if (body.action === "toPantry") {
      const moved = await moveCheckedToPantry(id);
      return NextResponse.json({ ok: true, moved });
    }
    if (body.action === "renewToken") {
      await renewShareToken(id);
      return NextResponse.json({ ok: true });
    }
    throw new Error(`Unknown action ${body.action}`);
  });
}
