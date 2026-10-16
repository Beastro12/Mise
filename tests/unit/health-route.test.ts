import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { getDb } from "@/db";
import { GET } from "@/app/api/health/route";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "aitta-health-"));
process.env.PGLITE_DIR = dir;
delete process.env.DATABASE_URL;

describe("GET /api/health", () => {
  afterAll(() => {
    delete process.env.DATABASE_URL;
    delete process.env.OURA_ACCESS_TOKEN;
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reports a usable deploy", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.tables).toEqual({ food_entries: true, health_days: true });
    expect(body.migrations.applied).toBeGreaterThanOrEqual(3);
  });

  it("never echoes env values", async () => {
    await getDb(); // handle is cached, so the fake URL is never connected to
    process.env.DATABASE_URL = "postgres://u:SECRETPW@h/db";
    process.env.OURA_ACCESS_TOKEN = "oura-SECRET-tok";
    try {
      const res = await GET();
      const text = JSON.stringify(await res.json());
      expect(text).not.toContain("SECRETPW");
      expect(text).not.toContain("oura-SECRET-tok");
    } finally {
      delete process.env.DATABASE_URL;
      delete process.env.OURA_ACCESS_TOKEN;
    }
  });

  it("fails with a hint when a table is missing", async () => {
    await (await getDb()).execute(sql`drop table health_days`);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body.ok).toBe(false);
    expect(body.hint).toContain("DB_AUTO_MIGRATE");
  });
});
