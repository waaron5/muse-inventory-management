import { defineConfig, devices } from "@playwright/test";

// The smoke runs its own server against its own database, never the one in
// .env.local, and with no Resend key, so sign-in codes and bug reports land in
// the local outbox.
export const e2eDatabaseURL =
  process.env.E2E_DATABASE_URL ?? "postgres://postgres@localhost:5433/muse";
const port = 3100;
/** What Vercel Cron would send, so a spec can run the daily giveaway itself. */
export const e2eCronSecret = "e2e-cron-secret";

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: `http://localhost:${port}`, trace: "retain-on-failure" },
  // Every spec runs in both themes, through the system setting (Appearance: System).
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["iPhone 15"], defaultBrowserType: "chromium" } },
    { name: "desktop-dark", use: { ...devices["Desktop Chrome"], colorScheme: "dark" } },
    { name: "phone-dark", use: { ...devices["iPhone 15"], defaultBrowserType: "chromium", colorScheme: "dark" } },
  ],
  webServer: {
    command: `pnpm start --port ${port}`,
    url: `http://localhost:${port}/sign-in`,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: e2eDatabaseURL,
      BETTER_AUTH_URL: `http://localhost:${port}`,
      RESEND_API_KEY: "",
      MAINTAINER_EMAIL: "maintainer@example.com",
      CRON_SECRET: e2eCronSecret,
      AI_CONNECTIONS: "1",
    },
  },
});
