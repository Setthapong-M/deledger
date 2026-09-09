import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createApplication } from "../src/app.js";
import { disconnectDatabase } from "../src/server/db/pool.js";
import { setBusinessClock } from "../src/server/domain/clock.js";

const environment = {
  DELEDGER_ENV: "local", NODE_ENV: "test", APP_ORIGIN: "http://127.0.0.1:3014",
  BUSINESS_TIME_ZONE: "Asia/Bangkok",
  DATABASE_URL: "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test",
  IDENTITY_DATABASE_URL: "postgresql://deledger_identity:test-identity-password@127.0.0.1:55432/deledger_test",
};
Object.assign(process.env, environment);
let app: Awaited<ReturnType<typeof createApplication>>;
let origin: string;
let cookie: string;

beforeAll(async () => {
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
});
beforeEach(async () => {
  setBusinessClock(() => new Date("2026-10-09T10:00:00Z"));
  cookie = await login();
});
afterEach(async () => {
  try {
    await changeDate(null);
  } finally {
    setBusinessClock(() => new Date());
  }
});
afterAll(async () => { await app?.close(); await disconnectDatabase(); });

async function send(path: string, method = "GET", body?: unknown, session = cookie) {
  return fetch(`${origin}/api${path}`, {
    method,
    headers: {
      origin: environment.APP_ORIGIN,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(session ? { cookie: session } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
async function data(path: string, method = "GET", body?: unknown) {
  const response = await send(path, method, body);
  expect(response.status).toBe(200);
  return (await response.json()).data;
}
async function login() {
  const response = await send("/auth/login", "POST", { identifier: `${randomUUID()}@example.com` }, "");
  expect(response.status).toBe(200);
  return response.headers.get("set-cookie")!.split(";", 1)[0]!;
}
async function changeDate(date: string | null) {
  const context = await data("/calendar");
  return data("/local/clock", "PATCH", { date, expectedClockRevision: context.clockRevision, acknowledged: true });
}
async function expectError(response: Response, status: number, code: string) {
  expect(response.status).toBe(status);
  expect((await response.json()).error.code).toBe(code);
}

describe("flexible tracking through public HTTP", () => {
  it("onboards from August 15, closes intervening months and returns October without inventing inputs", async () => {
    const current = await data("/onboarding", "POST", { startDate: "2026-08-15", openingBalance: "1000.01", income: "200.02" });
    expect(current).toMatchObject({ month: "2026-10", lifecycle: "open", openingSource: "prior_ending", summary: { startingBalance: null, income: null, endingBalance: null, latestSnapshot: null } });
    expect(await data("/months/2026-08")).toMatchObject({
      month: "2026-08", trackedFrom: "2026-08-15", isPartial: true, lifecycle: "closed", closedBy: "automatic", openingSource: "supplied",
      summary: { startingBalance: "1000.01", income: "200.02", endingBalance: null, latestSnapshot: null },
      reconciliation: { state: "needs_information" }, setup: [],
    });
    expect(await data("/months/2026-09")).toMatchObject({ lifecycle: "closed", closedBy: "automatic", openingSource: "prior_ending", summary: { startingBalance: null, income: null, endingBalance: null, latestSnapshot: null }, setup: [] });
    expect(await data("/bootstrap")).toMatchObject({ businessDate: "2026-10-09", state: "ready", month: { month: "2026-10" } });
  });

  it.each([
    ["2026-02-30", "INVALID_INPUT"],
    ["2026-10-10", "INVALID_INPUT"],
    ["2024-10-01", "DATE_RANGE_TOO_LARGE"],
  ])("rejects historical onboarding at %s atomically", async (startDate, code) => {
    await expectError(await send("/onboarding", "POST", { startDate, openingBalance: "1000.00", income: "0.00" }), 400, code);
    expect(await data("/bootstrap")).toMatchObject({ state: "onboarding_required", month: null });
    expect(await data("/months")).toEqual([]);
  });

  it("accepts exactly 24 Reporting Months including current", async () => {
    expect(await data("/onboarding", "POST", { startDate: "2024-11-01", openingBalance: "1.00", income: "0.00" })).toMatchObject({ month: "2026-10", lifecycle: "open" });
    const history = await data("/months?limit=24");
    expect(history).toHaveLength(24);
    expect(await data("/months/2024-11")).toMatchObject({ trackedFrom: "2024-11-01", openingSource: "supplied", lifecycle: "closed" });
  });

  it("retains today's onboarding behavior when startDate is omitted", async () => {
    expect(await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" })).toMatchObject({
      month: "2026-10", trackedFrom: "2026-10-09", lifecycle: "open", openingSource: "supplied", summary: { startingBalance: "1000.00", income: "0.00" },
    });
  });

  it("prepends August without changing supplied September, its revision or its setup", async () => {
    await changeDate("2026-09-09");
    let september = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    september = await data("/months/2026-09/recurring-expenses", "POST", { name: "Rent", kind: "fixed", fixedAmount: "100.00", expectedRevision: september.revision });
    const options = await data("/tracking/options");
    expect(options).toMatchObject({ earliestMonth: "2026-09", earliestRevision: september.revision });
    const result = await data("/months/backfill", "POST", {
      startDate: "2026-08-15", openingBalance: "10000.00", income: "0.00",
      expectedEarliestMonth: options.earliestMonth, expectedEarliestRevision: options.earliestRevision,
    });
    expect(result.createdMonthKeys).toEqual(["2026-08"]);
    expect(result.affectedMonthKeys).toEqual(["2026-08"]);
    const august = await data("/months/2026-08");
    expect(august).toMatchObject({ trackedFrom: "2026-08-15", lifecycle: "closed", openingSource: "supplied", setup: [] });
    expect(await data("/months/2026-09")).toEqual(september);
    const corrected = await data("/months/2026-08/ending-balance", "PUT", { amount: "9000.00", expectedRevision: august.revision });
    expect(corrected.affectedMonthKeys).not.toContain("2026-09");
    expect(await data("/months/2026-09")).toEqual(september);
  });

  it("rejects an obsolete earliest-month revision without creating history", async () => {
    let october = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    const options = await data("/tracking/options");
    october = await data("/months/2026-10/income", "PUT", { amount: "1.00", expectedRevision: october.revision });
    await expectError(await send("/months/backfill", "POST", {
      startDate: "2026-09-01", openingBalance: "1000.00", income: "0.00",
      expectedEarliestMonth: options.earliestMonth, expectedEarliestRevision: options.earliestRevision,
    }), 409, "HISTORY_BOUNDARY_CONFLICT");
    await expectError(await send("/months/2026-09"), 404, "MONTH_NOT_FOUND");
    expect(await data("/months/2026-10")).toEqual(october);
  });

  it("rejects a prepend spanning the simulated current month before writing any part of the range", async () => {
    await changeDate("2026-11-09");
    const november = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    await changeDate("2026-09-09");
    await expectError(await send("/months/backfill", "POST", {
      startDate: "2026-08-01", openingBalance: "1000.00", income: "0.00",
      expectedEarliestMonth: "2026-11", expectedEarliestRevision: november.revision,
    }), 409, "HISTORY_BOUNDARY_CONFLICT");
    expect(await data("/bootstrap")).toMatchObject({ state: "simulation_outside_tracking", month: null });
    for (const key of ["2026-08", "2026-09", "2026-10"]) {
      await expectError(await send(`/months/${key}`), 404, "MONTH_NOT_FOUND");
    }
    await changeDate("2026-11-09");
    expect((await data("/months/current")).month).toEqual(november);
  });

  it.each(["2026-10-01", "2026-10-09"])("restarts untouched October at %s preserving copied paused setup and stopping prior corrections", async startDate => {
    await changeDate("2026-09-09");
    let september = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    september = await data("/months/2026-09/recurring-expenses", "POST", { name: "Rent", kind: "fixed", fixedAmount: "100.00", expectedRevision: september.revision });
    await data(`/months/2026-09/recurring-expenses/${september.setup[0].id}`, "PATCH", { isPaused: true, expectedRevision: september.revision });
    await changeDate(null);
    const october = (await data("/months/current")).month;
    expect(october).toMatchObject({ revision: "0", openingSource: "prior_ending", summary: { startingBalance: null, income: null, endingBalance: null } });
    expect(october.setup).toHaveLength(1);
    expect(october.setup[0]).toMatchObject({ name: "Rent", isPaused: true, detail: null });
    const oldSeptember = await data("/months/2026-09");
    const restarted = await data("/months/2026-10/restart", "POST", { startDate, openingBalance: "5000.00", income: "200.00", expectedRevision: october.revision });
    expect(restarted).toMatchObject({ trackedFrom: startDate, openingSource: "supplied", lifecycle: "open", revision: "1", summary: { startingBalance: "5000.00", income: "200.00", endingBalance: null } });
    expect(restarted.setup).toEqual(october.setup);
    expect(await data("/months/2026-09")).toEqual({ ...oldSeptember, affectedMonthKeys: [] });
    const corrected = await data("/months/2026-09/ending-balance", "PUT", { amount: "900.00", expectedRevision: oldSeptember.revision });
    expect(corrected.affectedMonthKeys).not.toContain("2026-10");
    expect(await data("/months/2026-10")).toEqual(restarted);
    await data("/months/2026-10/ending-balance", "PUT", { amount: "4500.00", expectedRevision: restarted.revision });
    await changeDate("2026-11-01");
    expect((await data("/months/current")).month).toMatchObject({ month: "2026-11", openingSource: "prior_ending", summary: { startingBalance: "4500.00" } });
  });

  it.each(["income", "snapshot", "setup"])("refuses restart after an explicit %s edit and preserves that month", async edit => {
    await data("/onboarding", "POST", { startDate: "2026-09-01", openingBalance: "1000.00", income: "0.00" });
    let october = (await data("/months/current")).month;
    if (edit === "income") {
      october = await data("/months/2026-10/income", "PUT", { amount: "0.00", expectedRevision: october.revision });
    } else if (edit === "snapshot") {
      october = await data("/months/2026-10/snapshots", "POST", { observedOn: "2026-10-09", amount: "0.00", expectedRevision: october.revision });
    } else {
      october = await data("/months/2026-10/recurring-expenses", "POST", { name: "Rent", kind: "fixed", fixedAmount: "100.00", expectedRevision: october.revision });
    }
    await expectError(await send("/months/2026-10/restart", "POST", { startDate: "2026-10-09", openingBalance: "5000.00", income: "0.00", expectedRevision: october.revision }), 409, "RESTART_NOT_ALLOWED");
    expect(await data("/months/2026-10")).toEqual(october);
  });

  it("allows only one restart for a rendered revision", async () => {
    const october = await data("/onboarding", "POST", { startDate: "2026-09-01", openingBalance: "1000.00", income: "0.00" });
    const body = { startDate: "2026-10-09", openingBalance: "5000.00", income: "0.00", expectedRevision: october.revision };
    const restarted = await data("/months/2026-10/restart", "POST", body);
    await expectError(await send("/months/2026-10/restart", "POST", body), 409, "REVISION_CONFLICT");
    expect(await data("/months/2026-10")).toEqual(restarted);
  });

  it("keeps another User's months inaccessible through tracking endpoints", async () => {
    const october = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    const other = await login();
    expect((await (await send("/bootstrap", "GET", undefined, other)).json()).data).toMatchObject({ state: "onboarding_required", month: null });
    await expectError(await send("/months/2026-10", "GET", undefined, other), 404, "MONTH_NOT_FOUND");
    const response = await send("/months/2026-10/restart", "POST", { startDate: "2026-10-09", openingBalance: "9999.00", income: "0.00", expectedRevision: october.revision }, other);
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(response.status).toBeLessThan(500);
    expect(await data("/months/2026-10")).toEqual(october);
  });
});
