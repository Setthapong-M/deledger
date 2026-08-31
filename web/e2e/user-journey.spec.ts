import { test, expect } from "@playwright/test";

const view = { month: "2026-08", lifecycle: "open", closedBy: null, trackedFrom: "2026-08-01", isPartial: false, revision: "0", summary: { startingBalance: "20000.00", income: "30000.00", endingBalance: null, latestSnapshot: null, referenceKind: null, referenceAmount: null, monthlySpending: null, provisionalSpending: null, detailTotal: "0.00", unitemizedSpending: null }, reconciliation: { state: "draft", issueCodes: [] }, setup: [{ id: "00000000-0000-4000-8000-000000000001", position: 1, name: "ค่าเช่า", kind: "fixed", fixedAmount: "6000.00", isPaused: false, detail: null }], allowedActions: { editIncome: true, recordSnapshot: true, editEndingBalance: true, manageSetup: true, confirmDetails: true, manualClose: false }, affectedMonthKeys: [] };

test("invited user can start a month and see the responsive ledger", async ({ page }) => {
  await page.route("**/api/onboarding", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: view }) }));
  await page.route("**/api/months/current", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { state: "ready", month: view } }) }));
  await page.goto("/start");
  await page.getByLabel("ยอดตั้งต้นที่รู้ตอนนี้").fill("20000");
  await page.getByLabel("รายรับของเดือนนี้").fill("30000");
  await page.getByRole("button", { name: "เริ่มเดือนแรก" }).click();
  await expect(page).toHaveURL(/\/month$/);
  await expect(page.getByRole("heading", { name: "เดือนของคุณ" })).toBeVisible();
  await expect(page.getByRole("button", { name: /^ค่าเช่า 6000/ })).toBeVisible();
});
