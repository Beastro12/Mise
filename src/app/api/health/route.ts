import { NextResponse } from "next/server";
import { getDb } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

const HINT = "Calories tables missing. In Vercel set DB_AUTO_MIGRATE=1 and redeploy.";

type Row = { food_entries: boolean; health_days: boolean; has_log: boolean };

// Drivers return either an array of rows (postgres-js) or { rows } (PGlite).
function rowsOf<T>(res: unknown): T[] {
  return Array.isArray(res) ? (res as T[]) : ((res as { rows?: T[] }).rows ?? []);
}

export async function GET() {
  const db = process.env.DATABASE_URL ? "postgres" : "pglite";
  try {
    const d = await getDb();
    const [row] = rowsOf<Row>(
      await d.execute(sql`select
        to_regclass('public.food_entries') is not null as food_entries,
        to_regclass('public.health_days') is not null as health_days,
        to_regclass('drizzle.__drizzle_migrations') is not null as has_log`),
    );
    let applied: number | null = null;
    if (row?.has_log) {
      const [c] = rowsOf<{ n: number }>(await d.execute(sql`select count(*)::int as n from drizzle.__drizzle_migrations`));
      applied = c?.n ?? null;
    }
    const tables = { food_entries: Boolean(row?.food_entries), health_days: Boolean(row?.health_days) };
    const ok = tables.food_entries && tables.health_days;
    const body = {
      ok,
      db,
      migrations: { applied },
      tables,
      autoMigrate: process.env.DB_AUTO_MIGRATE === "1",
      ouraToken: Boolean(process.env.OURA_ACCESS_TOKEN),
      ...(ok ? {} : { hint: HINT }),
    };
    return NextResponse.json(body, { status: ok ? 200 : 500 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, hint: HINT }, { status: 500 });
  }
}
