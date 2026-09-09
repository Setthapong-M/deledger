import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import type { MonthView } from "../src/lib/api-client";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/calendar", route => route.fulfill({ json: { data: { businessDate: "2026-08-31", realDate: "2026-08-31", mode: "real", canSimulate: true, clockRevision: "e2e-calendar-0", minDate: "2024-08-31", maxDate: "2028-08-31" } } }));
  await page.route("**/api/tracking/options", route => route.fulfill({ json: { data: {
      "businessDate": "2026-08-31",
      "earliestMonth": "2026-08",
      "earliestRevision": "7",
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


const month: MonthView = {
  month: "2026-08", openingSource: "supplied", lifecycle: "open", closedBy: null, trackedFrom: "2026-08-01", isPartial: false, revision: "7",
  summary: { startingBalance: "20000.00", income: "30000.00", endingBalance: null, latestSnapshot: { id: "check-in", observedOn: "2026-08-20", amount: "15000.00" }, referenceKind: "snapshot", referenceAmount: "15000.00", monthlySpending: null, provisionalSpending: "35000.00", detailTotal: "0.00", unitemizedSpending: "35000.00" },
  reconciliation: { state: "draft", issueCodes: [] },
  setup: [{ id: "rent", position: 1, name: "ค่าเช่า", kind: "fixed", fixedAmount: "6000.00", isPaused: false, detail: null }],
  allowedActions: { editIncome: true, recordSnapshot: true, editEndingBalance: true, manageSetup: true, confirmDetails: true, manualClose: false },
  affectedMonthKeys: [],
};

test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/mode", route => route.fulfill({ json: { data: { environment: "local" } } }));
  await page.route("**/api/months/current", route => route.fulfill({ json: { data: { state: "ready", businessDate: "2026-08-31", month } } }));
  await page.route("**/api/months", route => route.fulfill({ json: { data: [{ kind: "month", id: month.month, view: month }] } }));
  await page.route("**/api/profile", route => route.fulfill({ json: { data: { email: "sample@example.com", phone: null, dateOfBirth: null } } }));
});

test("language persists across navigation and reload while dates and icons stay accessible", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/month");
  await expect(page.getByRole("heading", { name: "สิงหาคม 2569" })).toBeVisible();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "August 2026" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Edit income", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record a balance check-in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "ค่าเช่า 6000.00", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "History", exact: true }).click();
  await expect(page.getByRole("article")).toContainText("Estimated spending");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("heading", { name: "August 2026" })).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).toContain("Google Sans");
  await page.evaluate(() => document.fonts.ready);
  await expect.poll(() => page.evaluate(() => [...document.fonts].some(font => font.family.includes("Google Sans") && font.status === "loaded" && font.unicodeRange.toUpperCase().includes("E01")))).toBe(true);
  await page.setViewportSize({ width: 320, height: 720 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole("button", { name: "ภาษาไทย", exact: true }).click();
  await expect(page.getByRole("heading", { name: "สิงหาคม 2569" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("balance check-in uses the shared date input and accepts formatted pasted money", async ({ page }) => {
  await page.goto("/month");
  await page.getByRole("button", { name: "บันทึกยอดเงินระหว่างเดือน", exact: true }).click();
  const dialog = page.getByRole("dialog");
  const date = dialog.locator('#dialog-date');
  await date.click();
  const calendar = dialog.getByRole("group", { name: "ปฏิทินเลือกวันที่" });
  await calendar.getByRole("combobox", { name: "ปี", exact: true }).selectOption("2026");
  await calendar.getByRole("combobox", { name: "เดือน", exact: true }).selectOption("7");
  await calendar.locator('[data-day="2026-08-20"]').click();
  await expect(date).toContainText("20 ส.ค. 2569");
  const amount = dialog.getByRole("textbox", { name: "ยอดเงิน", exact: true });
  await amount.fill("25");
  await amount.selectText();
  await amount.evaluate(element => {
    const clipboardData = new DataTransfer();
    clipboardData.setData("text/plain", "฿1,250.50");
    const event = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(event, "clipboardData", { value: clipboardData });
    element.dispatchEvent(event);
  });
  await expect(amount).toHaveValue("1250.50");
  await expect(amount).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("birthday uses the custom calendar with localized dates and keyboard dismissal", async ({ page }, testInfo) => {
  await page.goto("/profile");
  await expect(page.getByLabel("อีเมล", { exact: true })).toHaveValue("sample@example.com");
  const birthday = page.getByLabel("วันเกิด", { exact: true });
  await expect(page.locator('input[type="date"]')).toHaveCount(0);
  const icon = birthday.locator('svg[data-icon="calendar"]');
  await expect(icon).toBeVisible();
  await birthday.click();
  const calendar = page.getByRole("group", { name: "ปฏิทินเลือกวันที่" });
  await calendar.getByRole("combobox", { name: "ปี", exact: true }).selectOption("2000");
  await calendar.getByRole("combobox", { name: "เดือน", exact: true }).selectOption("0");
  await calendar.locator('[data-day="2000-01-02"]').click();
  await expect(birthday).toContainText("2 ม.ค. 2543");
  await birthday.click();
  const fieldBox = (await birthday.boundingBox())!;
  const iconBox = (await icon.boundingBox())!;
  expect(iconBox.x).toBeGreaterThan(fieldBox.x);
  expect(iconBox.x + iconBox.width).toBeLessThan(fieldBox.x + fieldBox.width);
  await page.screenshot({ path: testInfo.outputPath("birthday-icon.png") });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(calendar).toHaveCount(0);
  await expect(birthday).toBeFocused();
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByLabel("Date of birth", { exact: true })).toContainText("2 Jan 2000");
});

test("switching language preserves unsaved profile inputs and translates an existing server error", async ({ page }) => {
  await page.route("**/api/profile", route => route.fulfill(route.request().method() === "PATCH"
    ? { status: 409, json: { error: { code: "PROFILE_CONFLICT", message: "ข้อความจากเซิร์ฟเวอร์", field: "email" } } }
    : { json: { data: { email: "sample@example.com", phone: null, dateOfBirth: null } } }));
  await page.goto("/profile");
  await expect(page.getByLabel("อีเมล", { exact: true })).toHaveValue("sample@example.com");
  await page.getByLabel("อีเมล", { exact: true }).fill("edited@example.com");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByLabel("Email", { exact: true })).toHaveValue("edited@example.com");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("alert").first()).toContainText("These contact details aren’t available");
  await page.getByRole("button", { name: "ภาษาไทย", exact: true }).click();
  await expect(page.getByRole("alert").first()).toContainText("ข้อมูลติดต่อนี้ใช้ไม่ได้");
  await expect(page.getByLabel("อีเมล", { exact: true })).toHaveValue("edited@example.com");
});
