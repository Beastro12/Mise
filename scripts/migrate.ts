/**
 * Apply SQL migrations in ./drizzle to DATABASE_URL (Supabase / any Postgres).
 * Without DATABASE_URL it migrates the local PGlite database instead.
 */
import path from "node:path";
import fs from "node:fs";

async function main() {
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const { migrate } = await import("drizzle-orm/postgres-js/migrator");
    const client = postgres(url, { prepare: false, max: 1 });
    await migrate(drizzle(client), { migrationsFolder });
    await client.end();
    console.log("Migrated", url.replace(/:[^:@/]+@/, ":****@"));
    return;
  }
  const dataDir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const client = new PGlite(dataDir);
  await migrate(drizzle(client), { migrationsFolder });
  await client.close();
  console.log("Migrated local PGlite at", dataDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
