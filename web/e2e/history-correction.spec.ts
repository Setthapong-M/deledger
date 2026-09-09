import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/mode", route => route.fulfill({ json: { data: { environment: "local" } } }));
  await page.route("**/api/calendar", route => route.fulfill({ json: { data: { businessDate: "2026-08-31", realDate: "2026-08-31", mode: "real", canSimulate: true, clockRevision: "e2e-calendar-0", minDate: "2024-08-31", maxDate: "2028-08-31" } } }));
  await page.route("**/api/tracking/options", route => route.fulfill({ json: { data: {
      "businessDate": "2026-08-31",
      "earliestMonth": "2026-07",
      "earliestRevision": "1",
      "prepend": {
        "allowed": true,
        "reason": null,
        "minDate": "2024-07-01",
        "maxDate": "2026-06-30"
      },
      "restart": {
        "allowed": false,
        "reason": "RESTART_NOT_ALLOWED",
        "month": null,
        "expectedRevision": null,
        "minDate": null,
        "maxDate": null
      }
    } } }));
});


const month = (id: string) => ({ month: id, openingSource: "supplied", lifecycle: "closed", closedBy: "automatic", trackedFrom: `${id}-01`, isPartial: false, revision: "1", summary: { startingBalance: "20000.00", income: "30000.00", endingBalance: "15000.00", latestSnapshot: null, referenceKind: "ending_balance", referenceAmount: "15000.00", monthlySpending: "35000.00", provisionalSpending: null, detailTotal: "10000.00", unitemizedSpending: "25000.00" }, reconciliation: { state: "reconciled", issueCodes: [] }, setup: [], allowedActions: { editIncome: true, recordSnapshot: false, editEndingBalance: true, manageSetup: false, confirmDetails: false, manualClose: false }, affectedMonthKeys: [] });

test("history keeps the selected cover while refreshing a correction", async ({ page }) => {
  const selected = month("2026-08");
  await page.route("**/api/months", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ kind: "month", id: selected.month, view: selected }, { kind: "month", id: "2026-07", view: month("2026-07") }] }) }));
  await page.route("**/api/months/2026-08", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: selected }) }));
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "สิงหาคม 2569" })).toBeVisible();
  await page.getByRole("button", { name: "โหลดล่าสุด" }).click();
  await expect(page.getByRole("heading", { name: "สิงหาคม 2569" })).toBeVisible();
});

test("clears a populated history view when the session expires", async ({ page }) => {
  await page.route("**/api/auth/mode", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { environment: "local" } }) }));
  const selected = month("2026-08");
  await page.route("**/api/months", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: [{ kind: "month", id: selected.month, view: selected }] }) }));
  await page.route("**/api/months/2026-08", async (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ error: { code: "SESSION_INVALID", message: "ต้องเข้าสู่ระบบก่อน", field: null, current: null } }) }));
  await page.goto("/history");
  await expect(page.getByRole("heading", { name: "สิงหาคม 2569" })).toBeVisible();
  await page.getByRole("button", { name: "โหลดล่าสุด" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole("heading", { name: "เข้าสู่ระบบ" })).toBeVisible();
});
