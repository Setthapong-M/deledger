import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import type { Calendar, MonthView } from "../src/lib/api-client";

async function chooseDate(page: Page, value: string, id: string) {
  await page.locator(`#${id}`).click();
  const picker = page.getByRole("group", { name: "Date picker" });
  await picker.getByRole("combobox", { name: "Year", exact: true }).selectOption(value.slice(0, 4));
  await picker.getByRole("combobox", { name: "Month", exact: true }).selectOption(String(Number(value.slice(5, 7)) - 1));
  await picker.locator(`[data-day="${value}"]`).click();
}

test("real UI historical start, restart and prepend preserve supplied balances", async ({ page }) => {
  test.setTimeout(60_000);
  const origin = "http://127.0.0.1:3014";
  await page.context().addCookies([{ name: "deledger_locale", value: "en", url: origin }]);
  await page.goto("/login");
  await page.getByLabel("Email or phone number").fill(`tracking-journey-${randomUUID()}@example.com`);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(page).toHaveURL(/\/start$/);
  const real: Calendar = (await (await page.request.get("/api/calendar")).json()).data;
  const monthAt = (offset: number) => {
    const date = new Date(`${real.realDate.slice(0, 7)}-01T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + offset);
    return date.toISOString().slice(0, 7);
  };
  const current = monthAt(1);
  const previous = monthAt(0);
  const start = monthAt(-1);
  const prepend = monthAt(-2);
  const stored = async (key: string): Promise<MonthView> => {
    const response = await page.request.get(`/api/months/${key}`);
    expect(response.ok()).toBe(true);
    return (await response.json()).data;
  };
  const correctEnding = async (key: string, amount: string) => {
    await page.goto(`/history?month=${key}`);
    await page.getByRole("button", { name: "Edit closing balance", exact: true }).click();
    await page.getByLabel("Amount", { exact: true }).fill(amount);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect((await stored(key)).summary.endingBalance).toBe(amount);
  };
  try {
    await page.getByRole("button", { name: "Change system date", exact: true }).click();
    await chooseDate(page, `${current}-09`, "clock-date");
    await page.getByRole("button", { name: "Acknowledge and change date" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.reload();
    await chooseDate(page, `${start}-15`, "tracking-start");
    await page.getByLabel("Balance on the start date").fill("1000.50");
    await page.getByLabel(/Income from/).fill("200.00");
    await page.getByRole("button", { name: "Start first month", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`history\\?month=${start}`));
    expect(await stored(start)).toMatchObject({ lifecycle: "closed", trackedFrom: `${start}-15`, openingSource: "supplied", summary: { startingBalance: "1000.50", income: "200.00" } });
    await correctEnding(start, "900.25");
    expect((await stored(previous)).summary.startingBalance).toBe("900.25");

    await page.goto("/month");
    await page.getByRole("button", { name: "Start fresh", exact: true }).click();
    await page.getByLabel("Balance on the start date").fill("2500.75");
    await page.getByLabel(/Income from/).fill("0.00");
    await page.getByRole("dialog").getByRole("button", { name: "Start fresh", exact: true }).click();
    await page.getByRole("button", { name: "Confirm fresh start", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await stored(current)).toMatchObject({ openingSource: "supplied", trackedFrom: `${current}-09`, summary: { startingBalance: "2500.75", income: "0.00" } });
    await correctEnding(previous, "600.25");
    expect((await stored(current)).summary.startingBalance).toBe("2500.75");

    await page.getByRole("button", { name: "Add earlier months", exact: true }).click();
    await chooseDate(page, `${prepend}-15`, "tracking-start");
    await page.getByLabel("Balance on the start date").fill("4000.00");
    await page.getByLabel(/Income from/).fill("0.00");
    await page.getByRole("dialog").getByRole("button", { name: "Add earlier months", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(await stored(prepend)).toMatchObject({ openingSource: "supplied", lifecycle: "closed", trackedFrom: `${prepend}-15` });
    await correctEnding(prepend, "3500.00");
    expect((await stored(start)).summary.startingBalance).toBe("1000.50");
    expect((await stored(current)).summary.startingBalance).toBe("2500.75");
  } finally {
    const latest: Calendar = (await (await page.request.get("/api/calendar")).json()).data;
    const reset = await page.request.patch("/api/local/clock", { headers: { origin }, data: { date: null, expectedClockRevision: latest.clockRevision, acknowledged: true } });
    expect(reset.ok()).toBe(true);
  }
});
