import { test, expect, type Page } from "@playwright/test";
import type { MonthView } from "../src/lib/api-client";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/calendar", route => route.fulfill({ json: { data: { businessDate: "2026-08-31", realDate: "2026-08-31", mode: "real", canSimulate: true, clockRevision: "e2e-calendar-0", minDate: "2024-08-31", maxDate: "2028-08-31" } } }));
  await page.route("**/api/tracking/options", route => route.fulfill({ json: { data: {
      "businessDate": "2026-08-31",
      "earliestMonth": "2026-08",
      "earliestRevision": "4",
      "prepend": {
        "allowed": true,
        "reason": null,
        "minDate": "2024-08-01",
        "maxDate": "2026-07-31"
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


function sample(): MonthView {
  return {
    month: "2026-08", openingSource: "supplied", lifecycle: "open", closedBy: null, trackedFrom: "2026-08-01", isPartial: false, revision: "4",
    summary: { startingBalance: "20000.00", income: "30000.00", endingBalance: null, latestSnapshot: null, referenceKind: null, referenceAmount: null, monthlySpending: null, provisionalSpending: null, detailTotal: "0.00", unitemizedSpending: null },
    reconciliation: { state: "draft", issueCodes: [] },
    setup: ["Rent", "Food", "Travel"].map((name, position) => ({ id: name, name, position, kind: "variable", fixedAmount: null, isPaused: false, detail: null })),
    allowedActions: { editIncome: true, recordSnapshot: true, editEndingBalance: true, manageSetup: true, confirmDetails: true, manualClose: false }, affectedMonthKeys: [],
  };
}

async function open(page: Page, fail = false) {
  const view = sample();
  const writes: { orderedIds: string[]; expectedRevision: string }[] = [];
  await page.route("**/api/auth/mode", route => route.fulfill({ json: { data: { environment: "local" } } }));
  await page.route("**/api/months/current", route => route.fulfill({ json: { data: { state: "ready", businessDate: "2026-08-31", month: view } } }));
  await page.route("**/api/months/2026-08/recurring-expenses/order", async route => {
    const payload = route.request().postDataJSON();
    writes.push(payload);
    if (fail) { await route.fulfill({ status: 503, json: { error: { code: "SERVICE_UNAVAILABLE", message: "Unavailable" } } }); return; }
    view.setup = payload.orderedIds.map((id: string, position: number) => ({ ...view.setup.find(item => item.id === id)!, position }));
    view.revision = "5";
    await route.fulfill({ json: { data: view } });
  });
  await page.goto("/month");
  const list = page.getByRole("list", { name: "รายจ่ายประจำของเดือน" });
  await list.scrollIntoViewIfNeeded();
  return { list, writes };
}

async function dragFirst(page: Page) {
  const handle = page.getByRole("button", { name: "จัดลำดับ Rent", exact: true });
  const target = page.getByRole("button", { name: "จัดลำดับ Travel", exact: true });
  const from = (await handle.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 20, { steps: 15 });
}

test("previews reordered rows while dragging and saves once on drop", async ({ page }, testInfo) => {
  const { list, writes } = await open(page);
  await dragFirst(page);
  await expect(list.getByRole("listitem").locator("strong")).toHaveText(["Food", "Travel", "Rent"]);
  expect(writes).toEqual([]);
  await expect(list.locator('div[aria-hidden="true"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("drag-preview.png") });
  await page.mouse.up();
  await expect.poll(() => writes).toEqual([{ orderedIds: ["Food", "Travel", "Rent"], expectedRevision: "4" }]);
  await expect(list).toHaveAttribute("aria-busy", "false");
  await expect(list.getByRole("listitem").locator("strong")).toHaveText(["Food", "Travel", "Rent"]);
});

test("Escape restores the original order without saving", async ({ page }) => {
  const { list, writes } = await open(page);
  await dragFirst(page);
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await expect(list.getByRole("listitem").locator("strong")).toHaveText(["Rent", "Food", "Travel"]);
  expect(writes).toEqual([]);
  await expect(list.locator('div[aria-hidden="true"]')).toHaveCount(0);
});

test("failed saves restore server order and explain the failure", async ({ page }) => {
  const { list, writes } = await open(page, true);
  await dragFirst(page);
  await page.mouse.up();
  await expect(page.getByRole("status").filter({ hasText: "เชื่อมต่อไม่ได้" })).toContainText("เชื่อมต่อไม่ได้");
  await expect(list.getByRole("listitem").locator("strong")).toHaveText(["Rent", "Food", "Travel"]);
  expect(writes).toHaveLength(1);
});

test("keyboard ordering and reduced motion stay available", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  const { list, writes } = await open(page);
  const handle = page.getByRole("button", { name: "จัดลำดับ Rent", exact: true });
  await handle.focus();
  await page.keyboard.press("ArrowDown");
  await expect(list.getByRole("listitem").locator("strong")).toHaveText(["Food", "Rent", "Travel"]);
  expect(writes).toEqual([{ orderedIds: ["Food", "Rent", "Travel"], expectedRevision: "4" }]);
  await expect(handle).toBeFocused();
});

test("touch dragging previews and saves the new order", async ({ page, browserName }) => {
  test.skip(browserName !== "chromium", "Touch injection uses the Chromium protocol");
  const { list, writes } = await open(page);
  const from = (await page.getByRole("button", { name: "จัดลำดับ Rent", exact: true }).boundingBox())!;
  const to = (await page.getByRole("button", { name: "จัดลำดับ Travel", exact: true }).boundingBox())!;
  const session = await page.context().newCDPSession(page);
  const x = from.x + from.width / 2;
  const start = from.y + from.height / 2;
  const end = to.y + to.height / 2 + 20;
  await session.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: start }] });
  for (let step = 1; step <= 12; step++) {
    await session.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: start + (end - start) * step / 12 }] });
  }
  await expect(list.getByRole("listitem").locator("strong")).toHaveText(["Food", "Travel", "Rent"]);
  expect(writes).toEqual([]);
  await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => writes).toEqual([{ orderedIds: ["Food", "Travel", "Rent"], expectedRevision: "4" }]);
  await expect(list).toHaveAttribute("aria-busy", "false");
  await session.detach();
});
