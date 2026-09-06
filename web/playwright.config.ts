import { defineConfig, devices } from "@playwright/test";

const projects = [
  { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  { name: "firefox", use: { ...devices["Desktop Firefox"] } },
  { name: "webkit", use: { ...devices["Desktop Safari"] } },
  { name: "mobile-webkit", use: { ...devices["iPhone 13"] } },
];
const selectedProjects = process.env.DELEDGER_E2E_PROJECTS ? new Set(process.env.DELEDGER_E2E_PROJECTS.split(",")) : null;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:3014",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    extraHTTPHeaders: { "x-deledger-test": "1" },
  },
  webServer: [
    {
      command: "NODE_ENV=test DELEDGER_ENV=local APP_ORIGIN=http://127.0.0.1:3014 BUSINESS_TIME_ZONE=Asia/Bangkok BACKUP_MODE=disabled DATABASE_URL=postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test IDENTITY_DATABASE_URL=postgresql://deledger_identity:test-identity-password@127.0.0.1:55432/deledger_test HOSTNAME=127.0.0.1 PORT=3015 pnpm --dir ../api exec tsx src/main.ts",
      url: "http://127.0.0.1:3015/api/health/live", reuseExistingServer: false, timeout: 120_000,
    },
    {
      command: "DELEDGER_ENV=local API_ORIGIN=http://127.0.0.1:3015 pnpm dev --hostname 127.0.0.1 --port 3014",
      url: "http://127.0.0.1:3014", reuseExistingServer: false, timeout: 120_000,
    },
  ],
  projects: selectedProjects ? projects.filter((project) => selectedProjects.has(project.name)) : projects,
});
