// Things that live only on your Mac: the browser profile and the helper config.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

export const AITTA_DIR = process.env.AITTA_HOME || path.join(os.homedir(), ".aitta");
const CONFIG = path.join(AITTA_DIR, "config.json");

/** {appUrl, helperKey} from env (AITTA_URL, AITTA_HELPER_KEY) or ~/.aitta/config.json. */
export function readConfig() {
  let file = {};
  try {
    file = JSON.parse(fs.readFileSync(CONFIG, "utf8"));
  } catch {
    // no config yet
  }
  return { appUrl: process.env.AITTA_URL || file.appUrl || null, helperKey: process.env.AITTA_HELPER_KEY || file.helperKey || null };
}

/** Saved readable only by you (chmod 600). The key only lets the helper read unmatched items and save products. */
export function writeConfig(cfg) {
  fs.mkdirSync(AITTA_DIR, { recursive: true, mode: 0o700 });
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2), { mode: 0o600 });
  fs.chmodSync(CONFIG, 0o600);
  return CONFIG;
}

/** Real browser window with a remembered S-kaupat login (never the password itself). */
export async function openBrowser({ useChrome = true } = {}) {
  const { chromium } = await import("@playwright/test");
  const profile = path.join(AITTA_DIR, "skaupat-profile");
  const ctx = await chromium.launchPersistentContext(profile, {
    headless: false,
    viewport: null,
    ...(useChrome ? { channel: "chrome" } : {}),
  });
  const page = ctx.pages()[0] ?? (await ctx.newPage());
  return { ctx, page };
}

/**
 * Terminal prompts. If input ends (Ctrl-D, or a pipe runs dry) a pending
 * question fails with a clear message instead of the script exiting silently.
 */
export async function prompter() {
  const readline = await import("node:readline/promises");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let closed = false;
  const onClose = new Promise((_, reject) => rl.once("close", () => ((closed = true), reject(new Error("Input ended; stopped without finishing.")))));
  onClose.catch(() => {});
  const ask = (q) => {
    if (closed) return Promise.reject(new Error("Input ended; stopped without finishing."));
    return Promise.race([rl.question(`\n👉 ${q} `), onClose]);
  };
  return { ask, close: () => rl.close() };
}
