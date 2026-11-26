import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

// The app reads .env.local. The e2e server runs against TEST_DATABASE_URL,
// never the demo database, because the specs write to it.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const PORT = 3200;
// Point at an already running app (for example `pnpm dev`) to skip the build.
const externalBaseUrl = process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: externalBaseUrl ? undefined : "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: externalBaseUrl ?? `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } } }],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `npx -y pnpm@10 build && npx -y pnpm@10 start --port ${PORT}`,
        port: PORT,
        timeout: 300_000,
        reuseExistingServer: !process.env.CI,
        stdout: "ignore",
        stderr: "pipe",
        env: {
          DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
          DEMO_FLAGS: "1",
          // Every spec signs in from the same IP; the limits have their own integration tests.
          RATE_LIMIT: "off",
        },
      },
});
