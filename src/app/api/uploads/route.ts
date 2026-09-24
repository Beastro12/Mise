import { NextResponse } from "next/server";
import { requireAuth, UnauthorizedError } from "@/lib/auth-server";
import { saveUpload } from "@/lib/services/originals";

export const dynamic = "force-dynamic";

/** Multipart upload of one file (photo, PDF, docx, txt, md). Returns the original id. */
export async function POST(req: Request) {
  try {
    await requireAuth();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "No file" }, { status: 400 });
    const kind = file.type.startsWith("image/") ? "image" : "file";
    const row = await saveUpload({ data: Buffer.from(await file.arrayBuffer()), filename: file.name || "upload", mime: file.type }, kind);
    return NextResponse.json({ id: row.id, kind: row.kind, filename: row.filename });
  } catch (e) {
    if (e instanceof UnauthorizedError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
