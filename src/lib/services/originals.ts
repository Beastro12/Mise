import "server-only";
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { getBlobStore } from "../storage";

const MAX_UPLOAD = 15 * 1024 * 1024;

export async function saveUpload(file: { data: Buffer; filename: string; mime: string }, kind: "image" | "file") {
  if (file.data.byteLength > MAX_UPLOAD) throw new Error("File is larger than 15 MB.");
  const ext = (file.filename.match(/\.[a-z0-9]{1,6}$/i)?.[0] ?? "").toLowerCase();
  const key = `${kind}s/${new Date().toISOString().slice(0, 7)}/${randomUUID()}${ext}`;
  await getBlobStore().put(key, file.data, file.mime || "application/octet-stream");
  const db = await getDb();
  const [row] = await db
    .insert(schema.originals)
    .values({ kind, storageKey: key, filename: file.filename, mime: file.mime })
    .returning();
  return row;
}

export async function saveUrlOriginal(url: string) {
  const db = await getDb();
  const [row] = await db.insert(schema.originals).values({ kind: "url", url }).returning();
  return row;
}

export async function getOriginals(ids: string[]) {
  if (!ids.length) return [];
  const db = await getDb();
  return db.select().from(schema.originals).where(inArray(schema.originals.id, ids));
}

export async function readOriginal(id: string): Promise<{ row: typeof schema.originals.$inferSelect; data: Buffer | null } | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.originals).where(eq(schema.originals.id, id));
  if (!row) return null;
  const data = row.storageKey ? await getBlobStore().get(row.storageKey) : null;
  return { row, data };
}
