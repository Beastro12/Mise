import "server-only";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

/**
 * Passcode guessing limit. Kept in the database (not memory) because serverless
 * instances don't share memory. After MAX failures within WINDOW, logins are
 * refused until the window ends. Your logged-in phones keep their cookie.
 */
const KEY = "login_failures";
export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_MAX_FAILURES = 10;

export type Failures = { count: number; since: number };

/** Pure: state after one more failure at `now`. */
export function addFailure(prev: Failures | null, now: number): Failures {
  if (!prev || now - prev.since >= LOGIN_WINDOW_MS) return { count: 1, since: now };
  return { count: prev.count + 1, since: prev.since };
}

/** Pure: are logins currently refused? */
export function isLocked(state: Failures | null, now: number): boolean {
  return !!state && state.count >= LOGIN_MAX_FAILURES && now - state.since < LOGIN_WINDOW_MS;
}

async function read(): Promise<Failures | null> {
  const db = await getDb();
  const [row] = await db.select().from(schema.settings).where(eq(schema.settings.key, KEY));
  return (row?.value as Failures | undefined) ?? null;
}

export async function loginLocked(now = Date.now()): Promise<boolean> {
  return isLocked(await read(), now);
}

export async function recordLoginFailure(now = Date.now()): Promise<void> {
  const value = addFailure(await read(), now);
  const db = await getDb();
  await db.insert(schema.settings).values({ key: KEY, value }).onConflictDoUpdate({ target: schema.settings.key, set: { value } });
}

export async function clearLoginFailures(): Promise<void> {
  const db = await getDb();
  await db.delete(schema.settings).where(eq(schema.settings.key, KEY));
}
