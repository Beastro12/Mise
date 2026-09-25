import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Key for the Mac helper (product matching). Only a SHA-256 hash is stored;
 * the key itself is shown once when created. Creating a new key revokes the old.
 */
const KEY = "helper_key_hash";

const hash = (k: string) => createHash("sha256").update(k).digest("hex");

export async function createHelperKey(): Promise<string> {
  const key = `aitta_${randomBytes(24).toString("base64url")}`;
  const db = await getDb();
  await db
    .insert(schema.settings)
    .values({ key: KEY, value: { hash: hash(key), createdAt: new Date().toISOString() } })
    .onConflictDoUpdate({ target: schema.settings.key, set: { value: { hash: hash(key), createdAt: new Date().toISOString() } } });
  return key;
}

export async function helperKeyInfo(): Promise<{ createdAt: string } | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, KEY));
  return row ? { createdAt: (row.value as { createdAt: string }).createdAt } : null;
}

export async function revokeHelperKey() {
  const db = await getDb();
  await db.delete(schema.settings).where(eq(schema.settings.key, KEY));
}

/** True if the request carries the current helper key as a Bearer token. */
export async function isHelperRequest(req: Request): Promise<boolean> {
  const m = (req.headers.get("authorization") ?? "").match(/^Bearer\s+(\S+)$/i);
  if (!m) return false;
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, KEY));
  if (!row) return false;
  const a = Buffer.from(hash(m[1]), "hex");
  const b = Buffer.from((row.value as { hash: string }).hash, "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
