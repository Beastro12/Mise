import { config } from "../env";
import { MockSKaupatAdapter, NoneAdapter } from "./skaupat-mock";
import type { StoreAdapter } from "./types";

/**
 * S-kaupat adapter registry. Only "mock" and "none" exist: the real site could
 * not be inspected from the build environment (DECISIONS.md D1). A verified
 * HTTP adapter plugs in here as S_KAUPAT_ADAPTER=http.
 */
export function getSKaupatAdapter(): StoreAdapter {
  return config.sKaupatAdapter === "mock" ? new MockSKaupatAdapter() : new NoneAdapter();
}

/** Simple per-adapter rate limiter: min interval between calls + daily cap. Personal volume only. */
class RateLimiter {
  private last = 0;
  private day = "";
  private count = 0;
  constructor(
    private minIntervalMs: number,
    private dailyCap: number,
  ) {}
  async acquire(): Promise<void> {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.day) {
      this.day = today;
      this.count = 0;
    }
    if (this.count >= this.dailyCap) throw new Error("Daily store-data request cap reached; using cached data.");
    const wait = this.last + this.minIntervalMs - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    this.last = Date.now();
    this.count++;
  }
}

const g = globalThis as unknown as { __miseLimiters?: Map<string, RateLimiter> };
const limiters = (g.__miseLimiters ??= new Map());

export function limiterFor(adapterId: string): RateLimiter {
  if (!limiters.has(adapterId)) limiters.set(adapterId, new RateLimiter(1500, 300));
  return limiters.get(adapterId)!;
}
