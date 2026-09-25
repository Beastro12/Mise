import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { config } from "../env";

export interface BlobStore {
  put(key: string, data: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer | null>;
}

class LocalBlobStore implements BlobStore {
  constructor(private root: string) {}
  private file(key: string) {
    const safe = key.replace(/[^a-zA-Z0-9._/-]/g, "_").replace(/\.\.+/g, ".");
    return path.join(this.root, safe);
  }
  async put(key: string, data: Buffer) {
    if (process.env.VERCEL) throw new Error("File uploads on Vercel need BLOB_STORE=supabase (the local disk is not persistent).");
    const f = this.file(key);
    await fs.mkdir(path.dirname(f), { recursive: true });
    await fs.writeFile(f, data);
  }
  async get(key: string) {
    try {
      return await fs.readFile(this.file(key));
    } catch {
      return null;
    }
  }
}

/** Supabase Storage (private bucket, accessed with the service role key server-side). */
class SupabaseBlobStore implements BlobStore {
  private bucket = process.env.SUPABASE_BUCKET || "aitta-originals";
  private async client() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("BLOB_STORE=supabase needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
    const { createClient } = await import("@supabase/supabase-js");
    return createClient(url, key, { auth: { persistSession: false } });
  }
  async put(key: string, data: Buffer, contentType: string) {
    const sb = await this.client();
    const { error } = await sb.storage.from(this.bucket).upload(key, data, { contentType, upsert: true });
    if (error) throw new Error(`Supabase upload failed: ${error.message}`);
  }
  async get(key: string) {
    const sb = await this.client();
    const { data, error } = await sb.storage.from(this.bucket).download(key);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
  }
}

let store: BlobStore | null = null;

export function getBlobStore(): BlobStore {
  if (!store) {
    store =
      config.blobStore === "supabase"
        ? new SupabaseBlobStore()
        : new LocalBlobStore(process.env.UPLOADS_DIR || path.join(process.cwd(), ".data", "uploads"));
  }
  return store;
}
