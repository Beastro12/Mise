import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./env";

export const SESSION_COOKIE = "mise_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export function authEnabled(): boolean {
  return !!config.passcode;
}

function secret(): string {
  return config.sessionSecret || createHash("sha256").update(`mise-fi:${config.passcode ?? ""}`).digest("hex");
}

function mac(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function signSession(now = Date.now()): string {
  const payload = String(now);
  return `${payload}.${mac(payload)}`;
}

export function verifySession(value: string | undefined | null, now = Date.now()): boolean {
  if (!value) return false;
  const [payload, sig] = value.split(".");
  if (!payload || !sig) return false;
  const expected = mac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  const issued = Number(payload);
  return Number.isFinite(issued) && now - issued < SESSION_MAX_AGE * 1000;
}

export function checkPasscode(input: string): boolean {
  const expected = config.passcode;
  if (!expected) return true;
  const a = createHash("sha256").update(input).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
