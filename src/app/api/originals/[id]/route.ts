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
  // The stored type came from the uploader. Only show known-safe types inline;
  // anything else (HTML, SVG, …) downloads, so it can't run script on this origin.
  const mime = (o.row.mime ?? "").split(";")[0].trim().toLowerCase();
  const inline = INLINE_TYPES.has(mime);
  const name = o.row.filename ?? "file";
  const headers: Record<string, string> = {
    "content-type": inline ? mime : "application/octet-stream",
    "content-disposition": `${inline ? "inline" : "attachment"}; filename="${name.replace(/[^\w.\- ]/g, "_")}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "x-content-type-options": "nosniff",
    "cache-control": "private, max-age=86400",
  };
  // Chrome won't render a PDF under a sandbox policy; its viewer is isolated anyway.
  if (mime !== "application/pdf") headers["content-security-policy"] = "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox";
  return new NextResponse(new Uint8Array(o.data), { headers });
}

const INLINE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif", "application/pdf", "text/plain", "text/markdown"]);
