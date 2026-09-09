import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { Calendar, MonthView, TrackingOptions } from "../src/lib/api-client";

const calendar: Calendar = { businessDate: "2026-10-09", realDate: "2026-10-09", mode: "real", canSimulate: true, clockRevision: "test:1", minDate: "2024-10-09", maxDate: "2028-10-09" };
function month(key: string, supplied = false): MonthView {
  return {
    month: key, lifecycle: key === "2026-10" ? "open" : "closed", closedBy: key === "2026-10" ? null : "automatic", trackedFrom: `${key}-01`, openingSource: supplied ? "supplied" : "prior_ending", isPartial: false, revision: "0",
    summary: { startingBalance: supplied ? "1000.00" : null, income: null, endingBalance: null, latestSnapshot: null, referenceKind: null, referenceAmount: null, monthlySpending: null, provisionalSpending: null, detailTotal: "0.00", unitemizedSpending: null },
    reconciliation: { state: key === "2026-10" ? "draft" : "needs_information", issueCodes: [] }, setup: [],
    allowedActions: { editIncome: true, editEndingBalance: true, recordSnapshot: key === "2026-10", manageSetup: key === "2026-10", confirmDetails: key === "2026-10", manualClose: false }, affectedMonthKeys: [key],
  };
}

async function fixture(page: Page, initial: "ready" | "onboarding_required" = "ready") {
  let date = { ...calendar };
  let state: string = initial;
  let current = month("2026-10");
  let earliest = "2026-09";
  const records = new Map<string, MonthView>([["2026-09", month("2026-09", true)], ["2026-10", current]]);
  const writes: Array<{ path: string; body: Record<string, unknown>; clock: string | undefined }> = [];
  await page.context().addCookies([{ name: "deledger_locale", value: "en", url: "http://127.0.0.1:3014" }]);
  await page.route("**/api/**", async route => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method !== "GET") writes.push({ path, body: request.postDataJSON(), clock: request.headers()["x-deledger-clock-revision"] });
    let data: unknown;
    if (path === "/api/auth/mode") data = { environment: "local" };
    else if (path === "/api/calendar") data = date;
    else if (path === "/api/local/clock") {
      const body = request.postDataJSON();
      date = { ...date, businessDate: body.date ?? date.realDate, mode: body.date === null ? "real" : "simulated", clockRevision: "test:2" };
      state = date.businessDate < "2026-09-01" ? "simulation_outside_tracking" : "ready";
      data = date;
    } else if (path === "/api/bootstrap" || path === "/api/months/current") data = { state, month: state === "ready" ? current : null, businessDate: date.businessDate };
    else if (path === "/api/tracking/options") {
      data = {
        businessDate: date.businessDate, earliestMonth: earliest, earliestRevision: "0",
        prepend: { allowed: true, reason: null, minDate: "2024-09-01", maxDate: "2026-08-31" },
        restart: { allowed: current.openingSource === "prior_ending", reason: null, month: current.month, expectedRevision: current.revision, minDate: "2026-10-01", maxDate: date.businessDate },
      } satisfies TrackingOptions;
    } else if (path === "/api/onboarding" || path === "/api/months/backfill") {
      const body = request.postDataJSON();
      const selected = { ...month(body.startDate.slice(0, 7), true), trackedFrom: body.startDate, isPartial: !body.startDate.endsWith("-01"), summary: { ...month("2026-08").summary, startingBalance: body.openingBalance, income: body.income } };
      records.set(selected.month, selected);
      earliest = selected.month;
      state = "ready";
      data = path === "/api/onboarding" ? current : { month: selected, createdMonthKeys: [selected.month], affectedMonthKeys: [selected.month] };
    } else if (path === "/api/months/2026-10/restart") {
      const body = request.postDataJSON();
      current = { ...current, openingSource: "supplied", trackedFrom: body.startDate, isPartial: true, revision: "1", summary: { ...current.summary, startingBalance: body.openingBalance, income: body.income } };
      records.set(current.month, current);
      data = current;
    } else if (path.endsWith("/income") || path.endsWith("/ending-balance")) {
      const key = path.split("/")[3]!;
      const previous = records.get(key)!;
      const amount = request.postDataJSON().amount;
      const updated = { ...previous, revision: "1", summary: { ...previous.summary, ...(path.endsWith("/income") ? { income: amount } : { endingBalance: amount, referenceAmount: amount, referenceKind: "ending_balance" as const }) } };
      records.set(key, updated);
      data = updated;
    } else if (path === "/api/months") data = [{ kind: "month", id: "2026-10", view: current }, { kind: "month", id: "2026-09", view: records.get("2026-09") }];
    else if (path.startsWith("/api/months/")) data = records.get(path.split("/")[3]!);
    else { await route.fulfill({ status: 404, json: { error: { code: "MONTH_NOT_FOUND", message: "Fixture route not found" } } }); return; }
    await route.fulfill({ json: { data } });
  });
  return { writes };
}

async function chooseDate(page: Page, value: string, id = "tracking-start") {
  await page.locator(`#${id}`).click();
  const picker = page.getByRole("group", { name: "Date picker" });
  await picker.getByRole("combobox", { name: "Year", exact: true }).selectOption(value.slice(0, 4));
  await picker.getByRole("combobox", { name: "Month", exact: true }).selectOption(String(Number(value.slice(5, 7)) - 1));
  await picker.locator(`[data-day="${value}"]`).click();
}

test("historical onboarding selects its partial start month outside the history page", async ({ page }) => {
  const { writes } = await fixture(page, "onboarding_required");
  await page.goto("/start");
  await chooseDate(page, "2026-08-15");
  await page.getByLabel("Balance on the start date").fill("1000.50");
  await page.getByLabel(/Income from/).fill("0.00");
  await expect(page.getByText("2026-08 → 2026-10 · 3 months")).toBeVisible();
  await page.getByRole("button", { name: "Start first month", exact: true }).click();
  await expect(page).toHaveURL(/history\?month=2026-08/);
  await expect(page.getByRole("heading", { name: "August 2026" })).toBeVisible();
  await expect(page.getByText("Supplied starting balance", { exact: true })).toBeVisible();
  expect(writes.find(write => write.path === "/api/onboarding")).toEqual({ path: "/api/onboarding", body: { startDate: "2026-08-15", openingBalance: "1000.50", income: "0.00" }, clock: "test:1" });
});

test("backfill previews its range then allows a closed-month ending correction", async ({ page }) => {
  const { writes } = await fixture(page);
  await page.goto("/history");
  await page.getByRole("button", { name: "Add earlier months", exact: true }).click();
  await chooseDate(page, "2026-08-15");
  await page.getByLabel("Balance on the start date").fill("1000.50");
  await page.getByLabel(/Income from/).fill("0.00");
  await expect(page.getByText("2026-08 → 2026-08 · 1 months")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "Add earlier months", exact: true }).click();
  await expect(page.getByRole("heading", { name: "August 2026" })).toBeVisible();
  await page.getByRole("button", { name: "Edit closing balance" }).click();
  await page.getByLabel("Amount", { exact: true }).fill("900.25");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByRole("tabpanel")).toContainText("900.25");
  expect(writes.find(write => write.path === "/api/months/backfill")?.body).toEqual({ startDate: "2026-08-15", openingBalance: "1000.50", income: "0.00", expectedEarliestMonth: "2026-09", expectedEarliestRevision: "0" });
  expect(writes.at(-1)?.clock).toBe("test:1");
});

test("current restart confirms the independent supplied balance", async ({ page }) => {
  const { writes } = await fixture(page);
  await page.goto("/month");
  await page.getByRole("button", { name: "Start fresh", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Earlier records stay, but will not set your new starting balance");
  await page.getByLabel("Balance on the start date").fill("2500.75");
  await page.getByLabel(/Income from/).fill("0.00");
  await page.getByRole("dialog").getByRole("button", { name: "Start fresh", exact: true }).click();
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm fresh start" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("Supplied starting balance", { exact: true })).toBeVisible();
  expect(writes.at(-1)).toEqual({ path: "/api/months/2026-10/restart", body: { startDate: "2026-10-09", openingBalance: "2500.75", income: "0.00", expectedRevision: "0" }, clock: "test:1" });
});

test("local date change confirms no rollback and shows outside-tracking instead of onboarding", async ({ page }) => {
  const { writes } = await fixture(page);
  await page.goto("/month");
  await page.getByRole("button", { name: "Change system date", exact: true }).click();
  await chooseDate(page, "2026-08-15", "clock-date");
  await expect(page.getByRole("dialog")).toContainText("does not undo records");
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Acknowledge and change date" }).click();
  await expect(page.getByRole("heading", { name: /outside your tracked period/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Start your first month" })).toHaveCount(0);
  await page.getByRole("button", { name: "Return to real date" }).click();
  await page.getByRole("button", { name: "Acknowledge and change date" }).click();
  await expect(page.getByRole("heading", { name: "This month", exact: true })).toBeVisible();
  expect(writes.at(-1)?.body).toEqual({ date: null, expectedClockRevision: "test:2", acknowledged: true });
});

test("real Next proxy rejects a rendered stale clock token without changing financial facts", async ({ page }) => {
  const origin = "http://127.0.0.1:3014";
  await page.goto("/login");
  await page.getByLabel("อีเมลหรือเบอร์โทร").fill(`flexible-${randomUUID()}@example.com`);
  await page.getByRole("button", { name: "ดำเนินการต่อ" }).click();
  await expect(page).toHaveURL(/\/start$/);
  const observedResponse = await page.request.get("/api/calendar");
  expect(observedResponse.ok()).toBe(true);
  const observed: Calendar = (await observedResponse.json()).data;
  expect(observed.canSimulate).toBe(true);
  try {
    const onboard = await page.request.post("/api/onboarding", { headers: { origin, "x-deledger-clock-revision": observed.clockRevision! }, data: { startDate: observed.businessDate, openingBalance: "1000.50", income: "0.00" } });
    expect(onboard.ok()).toBe(true);
    const original: MonthView = (await onboard.json()).data;
    expect(observed.mode).toBe("real");
    const changed = await page.request.patch("/api/local/clock", { headers: { origin }, data: { date: observed.businessDate, expectedClockRevision: observed.clockRevision, acknowledged: true } });
    expect(changed.ok()).toBe(true);
    const stale = await page.request.put(`/api/months/${original.month}/income`, { headers: { origin, "x-deledger-clock-revision": observed.clockRevision! }, data: { amount: "999.99", expectedRevision: original.revision } });
    expect(stale.status()).toBe(409);
    expect((await stale.json()).error.code).toBe("CLOCK_CONFLICT");
    const latestCalendar: Calendar = (await (await page.request.get("/api/calendar")).json()).data;
    const restored = await page.request.patch("/api/local/clock", { headers: { origin }, data: { date: null, expectedClockRevision: latestCalendar.clockRevision, acknowledged: true } });
    expect(restored.ok()).toBe(true);
    const unchanged: MonthView = (await (await page.request.get(`/api/months/${original.month}`)).json()).data;
    expect(unchanged.summary.income).toBe("0.00");
    expect(unchanged.revision).toBe(original.revision);
  } finally {
    const latest: Calendar = (await (await page.request.get("/api/calendar")).json()).data;
    const reset = await page.request.patch("/api/local/clock", { headers: { origin }, data: { date: null, expectedClockRevision: latest.clockRevision, acknowledged: true } });
    expect(reset.ok()).toBe(true);
  }
});
