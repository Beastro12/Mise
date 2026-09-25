import { NextResponse } from "next/server";
import { requireAuth, UnauthorizedError } from "@/lib/auth-server";
import { readOriginal } from "@/lib/services/originals";

export const dynamic = "force-dynamic";

/** Serve a stored original (photo / file) to the owner. */
export async function GET(_req: Request, ctx: RouteContext<"/api/originals/[id]">) {
  try {
    await requireAuth();
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    throw e;
  }
  const { id } = await ctx.params;
  const o = await readOriginal(id);
  if (!o) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (o.row.kind === "url" && o.row.url) return NextResponse.redirect(o.row.url);
  if (!o.data) return NextResponse.json({ error: "File missing from storage" }, { status: 404 });
  return new NextResponse(new Uint8Array(o.data), {
    headers: {
      "content-type": o.row.mime || "application/octet-stream",
      "content-disposition": `inline; filename="${(o.row.filename ?? "file").replace(/"/g, "")}"`,
      "cache-control": "private, max-age=86400",
    },
  });
}
