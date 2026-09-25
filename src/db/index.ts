import path from "node:path";
import fs from "node:fs";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import { seedDatabase } from "./seed";

export type DB = PgDatabase<PgQueryResultHKT, typeof schema>;

type DbState = { promise: Promise<DB> | null; close: (() => Promise<void>) | null };

const g = globalThis as unknown as { __aittaDb?: DbState };
const state: DbState = (g.__aittaDb ??= { promise: null, close: null });

const migrationsFolder = path.join(process.cwd(), "drizzle");

async function createDb(): Promise<DB> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    // prepare:false is required for Supabase's transaction pooler (port 6543).
    const client = postgres(url, { prepare: false, max: 5 });
    const db = drizzle(client, { schema });
    state.close = () => client.end();
    if (process.env.DB_AUTO_MIGRATE === "1") {
      const { migrate } = await import("drizzle-orm/postgres-js/migrator");
      await migrate(db, { migrationsFolder });
      await seedDatabase(db as unknown as DB);
    }
    return db as unknown as DB;
  }

  if (process.env.VERCEL) {
    throw new Error("DATABASE_URL is not set. On Vercel the app needs Postgres (Supabase); the embedded local database can't persist there.");
  }
  // Zero-setup local mode: embedded Postgres (PGlite) persisted on disk.
  const dataDir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dataDir);
  const db = drizzle(client, { schema });
  state.close = () => client.close();
  await migrate(db, { migrationsFolder });
  await seedDatabase(db as unknown as DB);
  return db as unknown as DB;
}

/** Lazily-initialised shared DB handle (one per server process). */
export function getDb(): Promise<DB> {
  if (!state.promise) {
    state.promise = createDb().catch((err) => {
      state.promise = null;
      throw err;
    });
  }
  return state.promise;
}

export { schema };
