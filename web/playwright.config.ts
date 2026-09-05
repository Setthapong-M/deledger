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
  webServer: {
    command: "DELEDGER_ENV=local APP_ORIGIN=http://127.0.0.1:3014 BUSINESS_TIME_ZONE=Asia/Bangkok DATABASE_URL=postgresql://deledger_web:deledger_web@127.0.0.1:55433/deledger_local pnpm dev --hostname 127.0.0.1 --port 3014",
    url: "http://127.0.0.1:3014",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: selectedProjects ? projects.filter((project) => selectedProjects.has(project.name)) : projects,
});
