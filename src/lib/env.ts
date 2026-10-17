/** Central place for runtime configuration read from environment variables. */

export const config = {
  get passcode(): string | null {
    return process.env.APP_PASSCODE?.trim() || null;
  },
  get sessionSecret(): string | null {
    return process.env.SESSION_SECRET?.trim() || null;
  },
  get anthropicKey(): string | null {
    return process.env.ANTHROPIC_API_KEY?.trim() || null;
  },
  get anthropicModel(): string {
    return process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-5";
  },
  /** "mock" | "none". Defaults to mock in development, none in production. */
  get sKaupatAdapter(): "mock" | "none" {
    const v = process.env.S_KAUPAT_ADAPTER?.trim();
    if (v === "mock" || v === "none") return v;
    return process.env.NODE_ENV === "production" ? "none" : "mock";
  },
  get blobStore(): "local" | "supabase" {
    return process.env.BLOB_STORE === "supabase" ? "supabase" : "local";
  },
  /** Oura API v2 token for daily activity sync (optional; file import works without it). */
  get ouraToken(): string | null {
    return process.env.OURA_ACCESS_TOKEN?.trim() || null;
  },
  /** Allow fetching private/loopback hosts on URL import (tests only). */
  get allowPrivateFetch(): boolean {
    return process.env.ALLOW_PRIVATE_FETCH === "1";
  },
};
