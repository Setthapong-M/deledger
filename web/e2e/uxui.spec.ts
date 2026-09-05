import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { MonthView } from "../src/lib/api-client";

function monthView(): MonthView {
  return {
    month: "2026-08", lifecycle: "open", closedBy: null, trackedFrom: "2026-08-01", isPartial: false, revision: "7",
    summary: { startingBalance: "20000.00", income: "30000.00", endingBalance: null, latestSnapshot: { id: "snapshot-1", amount: "15000.00", observedOn: "2026-08-20" }, referenceKind: "snapshot", referenceAmount: "15000.00", monthlySpending: null, provisionalSpending: "35000.00", detailTotal: "6000.00", unitemizedSpending: "29000.00" },
    reconciliation: { state: "draft", issueCodes: [] },
    setup: [{ id: "00000000-0000-4000-8000-000000000001", position: 1, name: "ค่าเช่า", kind: "fixed", fixedAmount: "6000.00", isPaused: false, detail: null }],
    allowedActions: { editIncome: true, recordSnapshot: true, editEndingBalance: true, manageSetup: true, confirmDetails: true, manualClose: false }, affectedMonthKeys: [],
  };
}

async function mockMonth(page: Page, view: MonthView) {
  await page.route("**/api/auth/mode", (route) => route.fulfill({ json: { data: { environment: "local" } } }));
  await page.route("**/api/months/current", (route) => route.fulfill({ json: { data: { state: "ready", month: view } } }));
  await page.goto("/month");
  await expect(page.getByRole("heading", { name: "สิงหาคม 2569" })).toBeVisible();
}

for (const theme of ["light", "dark"] as const) {
  test(`monthly overview is accessible and separates estimates in ${theme} theme`, async ({ page }, testInfo) => {
    await page.context().addCookies([{ name: "deledger_theme", value: theme, url: "http://127.0.0.1:3014" }]);
    await mockMonth(page, monthView());
    await expect(page.locator("html")).toHaveAttribute("data-theme", theme);
    const overview = page.getByRole("region", { name: "สิงหาคม 2569" });
    await expect(overview).toContainText("รายจ่ายโดยประมาณ");
    await expect(overview).toContainText("35,000.00");
    await overview.getByText("ดูวิธีคำนวณ").click();
    await expect(overview).toContainText("ต้องยืนยันยอดปลายแยกต่างหาก");
    await expect(page.getByRole("button", { name: "ปิดเดือน", exact: true })).toHaveCount(0);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`month-${theme}.png`), fullPage: true, style: "nextjs-portal { visibility: hidden; }" });
    await testInfo.attach(`month-${theme}`, { path: testInfo.outputPath(`month-${theme}.png`), contentType: "image/png" });
  });
}

test("close review preserves the close payload and supports cancellation and keyboard focus", async ({ page }) => {
  const view = monthView();
  view.summary.endingBalance = "15000.00";
  view.summary.monthlySpending = "35000.00";
  view.summary.provisionalSpending = null;
  view.summary.referenceKind = "ending_balance";
  view.reconciliation.state = "reconciled";
  view.allowedActions.manualClose = true;
  const submissions: unknown[] = [];
  await page.route("**/api/months/2026-08/close", async (route) => {
    submissions.push(route.request().postDataJSON());
    await route.fulfill({ json: { data: { ...view, lifecycle: "closed", allowedActions: { ...view.allowedActions, manualClose: false } } } });
  });
  await mockMonth(page, view);
  const close = page.getByRole("button", { name: "ปิดเดือน", exact: true });
  await close.click();
  const dialog = page.getByRole("dialog", { name: "ปิดเดือนนี้?" });
  await expect(dialog).toContainText("35,000.00");
  await expect(dialog).toContainText("15,000.00");
  await expect(dialog).toContainText("ตรวจสอบแล้ว");
  await expect(dialog.getByRole("button", { name: "ปิดหน้าต่าง" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "ยืนยันปิดเดือน" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(close).toBeFocused();
  expect(submissions).toEqual([]);
  await close.click();
  await dialog.getByRole("button", { name: "ยกเลิก", exact: true }).click();
  expect(submissions).toEqual([]);
  await close.click();
  await dialog.getByRole("button", { name: "ยืนยันปิดเดือน" }).click();
  await expect(close).toHaveCount(0);
  expect(submissions).toEqual([{ expectedRevision: "7" }]);
});

test("missing inputs remain empty and server permissions control actions at 320px", async ({ page }) => {
  const view = monthView();
  view.summary.provisionalSpending = null;
  view.summary.income = null;
  view.summary.latestSnapshot = null;
  view.summary.referenceKind = null;
  view.summary.referenceAmount = null;
  view.reconciliation.state = "needs_information";
  view.isPartial = true;
  view.allowedActions = { editIncome: false, recordSnapshot: false, editEndingBalance: false, manageSetup: false, confirmDetails: false, manualClose: false };
  await page.setViewportSize({ width: 320, height: 720 });
  await mockMonth(page, view);
  await expect(page.getByText("ยังมีข้อมูลไม่พอสำหรับคำนวณรายจ่าย")).toBeVisible();
  const needsInformation = page.getByText("ข้อมูลไม่ครบ", { exact: true }).locator("..");
  await expect(needsInformation).toHaveCSS("border-top-style", "dashed");
  await expect(needsInformation).toHaveCSS("border-top-width", "2px");
  await expect(page.getByRole("button", { name: "แก้ไขรายรับ" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "เพิ่มรายการ" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /^ค่าเช่า/ })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});

test("history labels provisional spending and treats tracking gaps as a separate state", async ({ page }) => {
  const view = monthView();
  await page.route("**/api/auth/mode", (route) => route.fulfill({ json: { data: { environment: "local" } } }));
  await page.route("**/api/months", (route) => route.fulfill({ json: { data: [
    { kind: "month", id: view.month, view },
    { kind: "tracking_gap", id: "gap:1", archivedAt: "2026-06-03T00:00:00Z", restoredAt: "2026-08-01T00:00:00Z" },
  ] } }));
  await page.goto("/history");
  await expect(page.getByRole("article")).toContainText("รายจ่ายโดยประมาณ");
  await expect(page.getByRole("tab", { name: /สิงหาคม/ })).toContainText("กำลังกรอก");
  await page.getByRole("tab", { name: /ช่วงข้อมูลขาด/ }).click();
  await expect(page.getByRole("article")).toContainText("ช่วงหยุดติดตาม");
  await expect(page.getByRole("article")).not.toContainText("ข้อมูลไม่ครบ");
});

test("mobile navigation stays reachable without covering the last action", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockMonth(page, monthView());
  const navigation = page.getByRole("navigation", { name: "เมนูหลัก" });
  await expect(navigation.getByRole("link", { name: "เดือนนี้" })).toHaveAttribute("aria-current", "page");
  const lastAction = page.getByRole("button", { name: "พักใช้ ค่าเช่า" });
  await lastAction.scrollIntoViewIfNeeded();
  const actionBox = await lastAction.boundingBox();
  const navigationBox = await navigation.boundingBox();
  expect(actionBox).not.toBeNull();
  expect(navigationBox).not.toBeNull();
  expect(actionBox!.y + actionBox!.height).toBeLessThanOrEqual(navigationBox!.y);
  await page.route("**/api/months", (route) => route.fulfill({ json: { data: [] } }));
  await navigation.getByRole("link", { name: "ประวัติ" }).click();
  await expect(page).toHaveURL(/\/history$/);
  await expect(navigation.getByRole("link", { name: "ประวัติ" })).toHaveAttribute("aria-current", "page");
});

test("selected navigation and reconciled badges retain the project colors on interaction", async ({ page }) => {
  await page.context().addCookies([{ name: "deledger_theme", value: "light", url: "http://127.0.0.1:3014" }]);
  const view = monthView();
  view.reconciliation.state = "reconciled";
  view.summary.endingBalance = "15000.00";
  view.summary.monthlySpending = "35000.00";
  view.summary.provisionalSpending = null;
  view.summary.referenceKind = "ending_balance";
  await mockMonth(page, view);
  const selected = page.getByRole("navigation").getByRole("link", { name: "เดือนนี้" });
  await selected.hover({ force: true });
  await expect(selected).toHaveCSS("background-color", "rgb(181, 198, 156)");
  const reconciled = page.getByText("ตรวจสอบแล้ว", { exact: true }).locator("..");
  await expect(reconciled).toHaveCSS("background-color", "rgb(181, 198, 156)");
  await expect(reconciled).toHaveCSS("color", "rgb(38, 38, 38)");
});

test("inconsistent months keep a distinct border without relying on color", async ({ page }) => {
  const view = monthView();
  view.reconciliation.state = "inconsistent";
  await mockMonth(page, view);
  const inconsistent = page.getByText("ยอดไม่สอดคล้อง", { exact: true }).locator("..");
  await expect(inconsistent).toHaveCSS("border-top-style", "double");
  await expect(inconsistent).toHaveCSS("border-top-width", "3px");
});

test("responsive utility precedence preserves the 760px and 900px boundaries", async ({ page }) => {
  await mockMonth(page, monthView());
  for (const [width, padding, position] of [[760, "20px", "fixed"], [761, "24px", "static"], [900, "24px", "static"], [901, "32px", "static"]] as const) {
    await page.setViewportSize({ width, height: 844 });
    await expect(page.getByRole("banner")).toHaveCSS("padding-left", padding);
    await expect(page.getByRole("navigation")).toHaveCSS("position", position);
  }
});
