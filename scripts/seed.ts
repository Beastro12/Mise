/**
 * Seed reference data (stores, sections, synonyms, staples) and 4 recipes.
 * Idempotent: does nothing if the database is already seeded.
 */
import path from "node:path";
import fs from "node:fs";
import * as schema from "../src/db/schema";
import { seedDatabase } from "../src/db/seed";

async function main() {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const { drizzle } = await import("drizzle-orm/postgres-js");
    const client = postgres(url, { prepare: false, max: 1 });
    const res = await seedDatabase(drizzle(client, { schema }) as never);
    await client.end();
    console.log(res.seeded ? "Seeded." : "Already seeded; nothing to do.");
    return;
  }
  const dataDir = process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "pglite");
  fs.mkdirSync(dataDir, { recursive: true });
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const client = new PGlite(dataDir);
  const res = await seedDatabase(drizzle(client, { schema }) as never);
  await client.close();
  console.log(res.seeded ? "Seeded." : "Already seeded; nothing to do.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
