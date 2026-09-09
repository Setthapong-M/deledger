import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/mode", route => route.fulfill({ json: { data: { environment: "local" } } }));
  await page.route("**/api/calendar", route => route.fulfill({ json: { data: { businessDate: "2026-08-01", realDate: "2026-08-01", mode: "real", canSimulate: true, clockRevision: "e2e-calendar-0", minDate: "2024-08-01", maxDate: "2028-08-01" } } }));
  await page.route("**/api/tracking/options", route => route.fulfill({ json: { data: {
      "businessDate": "2026-08-01",
      "earliestMonth": null,
      "earliestRevision": null,
      "prepend": {
        "allowed": false,
        "reason": "ONBOARDING_REQUIRED",
        "minDate": null,
        "maxDate": null
      },
      "restart": {
        "allowed": false,
        "reason": "MONTH_NOT_FOUND",
        "month": null,
        "expectedRevision": null,
        "minDate": null,
        "maxDate": null
      }
    } } }));
});


const view = { month: "2026-08", openingSource: "supplied", lifecycle: "open", closedBy: null, trackedFrom: "2026-08-01", isPartial: false, revision: "0", summary: { startingBalance: "20000.00", income: "30000.00", endingBalance: null, latestSnapshot: null, referenceKind: null, referenceAmount: null, monthlySpending: null, provisionalSpending: null, detailTotal: "0.00", unitemizedSpending: null }, reconciliation: { state: "draft", issueCodes: [] }, setup: [{ id: "00000000-0000-4000-8000-000000000001", position: 1, name: "ค่าเช่า", kind: "fixed", fixedAmount: "6000.00", isPaused: false, detail: null }], allowedActions: { editIncome: true, recordSnapshot: true, editEndingBalance: true, manageSetup: true, confirmDetails: true, manualClose: false }, affectedMonthKeys: [] };

test("invited user can start a month and see the responsive ledger", async ({ page }) => {
  await page.route("**/api/bootstrap", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { state: "onboarding_required", businessDate: "2026-08-01", month: null } }) }));
  await page.route("**/api/onboarding", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: view }) }));
  await page.route("**/api/months/current", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { state: "ready", businessDate: "2026-08-01", month: view } }) }));
  await page.goto("/start");
  const openingBalance = page.getByLabel("เงินคงเหลือ ณ วันเริ่ม", { exact: true });
  const income = page.getByLabel(/^รายรับตั้งแต่ /);
  await openingBalance.click();
  await openingBalance.pressSequentially("20000");
  await income.click();
  await income.pressSequentially("30000");
  const startButton = page.getByRole("button", { name: "เริ่มเดือนแรก" });
  await expect(startButton).toBeEnabled();
  await startButton.click();
  await expect(page).toHaveURL(/\/month$/);
  await expect(page.getByRole("heading", { name: "เดือนนี้", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /^ค่าเช่า 6000/ })).toBeVisible();
});
