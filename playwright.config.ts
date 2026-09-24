import { defineConfig, devices } from "@playwright/test";
import os from "node:os";
import path from "node:path";

const PORT = 3200;
const dataDir = path.join(os.tmpdir(), `mise-e2e-${Date.now()}`);

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 180_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    ...devices["Pixel 7"],
    // Use the preinstalled Chromium when PLAYWRIGHT_CHROMIUM is set (CI/sandbox).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {},
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node tests/e2e/fixture-server.mjs",
      url: "http://127.0.0.1:4599/kermaperunat.html",
      reuseExistingServer: true,
    },
    {
      // Production build: the service worker only registers in production.
      command: `npm run build && npx next start -p ${PORT} -H 127.0.0.1`,
      url: `http://127.0.0.1:${PORT}/api/health`,
      timeout: 300_000,
      reuseExistingServer: false,
      env: {
        PGLITE_DIR: path.join(dataDir, "db"),
        UPLOADS_DIR: path.join(dataDir, "uploads"),
        APP_PASSCODE: "e2e-passcode",
        SESSION_SECRET: "e2e-secret",
        ALLOW_PRIVATE_FETCH: "1",
        S_KAUPAT_ADAPTER: "mock",
        ANTHROPIC_API_KEY: "",
        // E2E_DATABASE_URL runs the suite against a real Postgres (fresh, empty DB) instead of PGlite.
        DATABASE_URL: process.env.E2E_DATABASE_URL ?? "",
        DB_AUTO_MIGRATE: process.env.E2E_DATABASE_URL ? "1" : "",
      },
    },
  ],
});
