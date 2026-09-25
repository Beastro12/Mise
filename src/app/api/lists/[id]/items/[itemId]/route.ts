import { NextResponse } from "next/server";
import { ownerRoute } from "@/lib/api";
import { answerRefill, answerStaple, deleteItem, setChecked, setItemStore } from "@/lib/services/lists";

export const dynamic = "force-dynamic";

/** Item actions for the owner: check, store (with optional remember), staple answer, delete. */
export async function POST(req: Request, ctx: RouteContext<"/api/lists/[id]/items/[itemId]">) {
  return ownerRoute(async () => {
    const { id, itemId } = await ctx.params;
    const body = (await req.json()) as { action: string; checked?: boolean; storeId?: string; remember?: boolean; have?: boolean; add?: boolean };
    switch (body.action) {
      case "check":
        await setChecked(id, itemId, !!body.checked);
        break;
      case "store":
        await setItemStore(id, itemId, body.storeId === "lidl" ? "lidl" : "smarket", !!body.remember);
        break;
      case "staple":
        await answerStaple(id, itemId, !!body.have);
        break;
      case "refill":
        await answerRefill(id, itemId, !!body.add);
        break;
      case "delete":
        await deleteItem(id, itemId);
        break;
      default:
        throw new Error(`Unknown action ${body.action}`);
    }
    return NextResponse.json({ ok: true });
  });
}
