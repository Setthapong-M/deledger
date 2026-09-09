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
  setBusinessClock(() => new Date("2026-09-29T10:00:00Z"));
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

async function send(path: string, method = "GET", body?: unknown, session = cookie, extraHeaders: Record<string, string> = {}) {
  return fetch(`${origin}/api${path}`, {
    method,
    headers: {
      origin: environment.APP_ORIGIN,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(session ? { cookie: session } : {}),
      ...extraHeaders,
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

describe("local calendar through public HTTP", () => {
  it("exposes the shared calendar before onboarding and resets to the real date", async () => {
    const response = await send("/calendar");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const context = (await response.json()).data;
    expect(context).toMatchObject({
      businessDate: "2026-09-29", realDate: "2026-09-29", mode: "real", canSimulate: true,
      clockRevision: expect.any(String), minDate: "2024-09-29", maxDate: "2028-09-29",
    });
    const other = await login();
    const changed = await changeDate("2026-09-30");
    expect(changed).toMatchObject({ businessDate: "2026-09-30", realDate: "2026-09-29", mode: "simulated" });
    expect(changed.clockRevision).not.toBe(context.clockRevision);
    expect((await (await send("/calendar", "GET", undefined, other)).json()).data).toEqual(changed);
    expect(await data("/bootstrap")).toMatchObject({ state: "onboarding_required", month: null, businessDate: "2026-09-30" });
    expect(await changeDate(null)).toMatchObject({ businessDate: "2026-09-29", mode: "real" });
  });

  it("permits Manual Close only on the final day after complete coherent inputs and an explicit close request", async () => {
    let month = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "200.00" });
    month = await data("/months/2026-09/ending-balance", "PUT", { amount: "900.00", expectedRevision: month.revision });
    expect(month.allowedActions.manualClose).toBe(false);
    await expectError(await send("/months/2026-09/close", "POST", { expectedRevision: month.revision }), 422, "MANUAL_CLOSE_NOT_ALLOWED");
    await changeDate("2026-09-30");
    month = (await data("/months/current")).month;
    expect(month).toMatchObject({ lifecycle: "open", allowedActions: { manualClose: true } });
    const closed = await data("/months/2026-09/close", "POST", { expectedRevision: month.revision });
    expect(closed).toMatchObject({ lifecycle: "closed", closedBy: "manual", reconciliation: { state: "reconciled" } });
  });

  it("keeps incomplete and incoherent months ineligible for Manual Close on the final day", async () => {
    await changeDate("2026-09-30");
    let month = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    await expectError(await send("/months/2026-09/close", "POST", { expectedRevision: month.revision }), 422, "SUMMARY_INCOMPLETE");
    month = await data("/months/2026-09/ending-balance", "PUT", { amount: "1001.00", expectedRevision: month.revision });
    expect(month.allowedActions.manualClose).toBe(false);
    await expectError(await send("/months/2026-09/close", "POST", { expectedRevision: month.revision }), 422, "SUMMARY_INCONSISTENT");
  });

  it("automatically closes incomplete September and selects closed September after resetting from October", async () => {
    await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    await changeDate("2026-10-01");
    const october = (await data("/months/current")).month;
    expect(october).toMatchObject({ month: "2026-10", lifecycle: "open", summary: { startingBalance: null, income: null, endingBalance: null } });
    expect(await data("/months/2026-09")).toMatchObject({ lifecycle: "closed", closedBy: "automatic", reconciliation: { state: "needs_information" } });
    await changeDate(null);
    for (const path of ["/bootstrap", "/months/current"]) {
      expect(await data(path)).toMatchObject({ businessDate: "2026-09-29", state: "closed_until_boundary", month: { month: "2026-09", lifecycle: "closed" } });
    }
    expect(await data("/months/2026-10")).toEqual(october);
  });

  it.each(["2026-09-28", "2026-08-31"])("reports outside tracking at %s without offering duplicate onboarding", async date => {
    const month = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    await changeDate(date);
    for (const path of ["/bootstrap", "/months/current"]) {
      expect(await data(path)).toMatchObject({ state: "simulation_outside_tracking", businessDate: date, month: null });
    }
    await changeDate(null);
    expect((await data("/months/current")).month).toEqual(month);
  });

  it("does not catch up finances merely by reading or changing the clock", async () => {
    const september = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    await changeDate("2026-10-01");
    await data("/calendar");
    await changeDate(null);
    expect((await data("/months/current")).month).toEqual(september);
    await expectError(await send("/months/2026-10"), 404, "MONTH_NOT_FOUND");
  });

  it("rejects a stale finance token before catch-up or mutation", async () => {
    const september = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    const context = await data("/calendar");
    await changeDate("2026-10-01");
    await expectError(await send("/months/2026-09/income", "PUT", { amount: "999.00", expectedRevision: september.revision }, cookie, {
      "x-deledger-clock-revision": context.clockRevision,
    }), 409, "CLOCK_CONFLICT");
    await changeDate(null);
    expect((await data("/months/current")).month).toEqual(september);
    await expectError(await send("/months/2026-10"), 404, "MONTH_NOT_FOUND");
  });

  it("accepts only one concurrent change using the same clock revision", async () => {
    const context = await data("/calendar");
    const responses = await Promise.all(["2026-09-30", "2026-10-01"].map(date => send("/local/clock", "PATCH", {
      date, expectedClockRevision: context.clockRevision, acknowledged: true,
    })));
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    const winner = responses.find(response => response.status === 200)!;
    const loser = responses.find(response => response.status === 409)!;
    expect(await data("/calendar")).toEqual((await winner.json()).data);
    await expectError(loser, 409, "CLOCK_CONFLICT");
  });

  it("invalidates a real-mode finance token across Bangkok midnight before catch-up", async () => {
    setBusinessClock(() => new Date("2026-09-30T16:59:59Z"));
    const month = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    const context = await data("/calendar");
    setBusinessClock(() => new Date("2026-09-30T17:00:00Z"));
    await expectError(await send("/months/2026-09/income", "PUT", { amount: "999.00", expectedRevision: month.revision }, cookie, {
      "x-deledger-clock-revision": context.clockRevision,
    }), 409, "CLOCK_CONFLICT");
    expect(await data("/calendar")).toMatchObject({ businessDate: "2026-10-01", mode: "real" });
    await changeDate("2026-09-30");
    expect((await data("/months/current")).month).toEqual(month);
    await expectError(await send("/months/2026-10"), 404, "MONTH_NOT_FOUND");
  });

  it("keeps an authenticated session alive when accounting moves two years forward", async () => {
    const profile = await data("/profile");
    await changeDate("2028-09-29");
    expect(await data("/profile")).toEqual(profile);
    expect(await data("/bootstrap")).toMatchObject({ state: "onboarding_required", businessDate: "2028-09-29" });
    await changeDate(null);
    expect(await data("/profile")).toEqual(profile);
  });

  it("validates birthdays against real time even while accounting is simulated", async () => {
    await changeDate("2028-09-29");
    await expectError(await send("/profile", "PATCH", { dateOfBirth: "2026-09-30" }), 400, "INVALID_INPUT");
    await changeDate("2024-09-29");
    expect(await data("/profile", "PATCH", { dateOfBirth: "2026-09-28" })).toMatchObject({ dateOfBirth: "2026-09-28" });
  });

  it("hides clock changes in QAS before authentication or financial catch-up", async () => {
    const september = await data("/onboarding", "POST", { openingBalance: "1000.00", income: "0.00" });
    const calendar = await changeDate("2026-10-01");
    const keys = ["DELEDGER_ENV", "APP_ORIGIN", "CLOUDFLARE_TEAM_DOMAIN", "CLOUDFLARE_ACCESS_AUD"];
    const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]));
    try {
      Object.assign(process.env, { DELEDGER_ENV: "qas", APP_ORIGIN: "http://deledger.internal", CLOUDFLARE_TEAM_DOMAIN: "https://test.cloudflareaccess.com", CLOUDFLARE_ACCESS_AUD: "test-audience" });
      const response = await send("/local/clock?date=2028-01-01", "PATCH", { date: "2028-01-01", expectedClockRevision: calendar.clockRevision, acknowledged: true }, "", { "x-deledger-clock-revision": calendar.clockRevision, origin: "http://deledger.internal" });
      expect(response.status).toBe(404);
    } finally {
      for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key]; }
    }
    expect(await data("/calendar")).toEqual(calendar);
    await changeDate(null);
    expect((await data("/months/current")).month).toEqual(september);
    await expectError(await send("/months/2026-10"), 404, "MONTH_NOT_FOUND");
  });

  it.each(["2026-02-30", "2024-09-28", "2028-09-30"])("rejects invalid or out-of-range clock date %s without changing context", async date => {
    const context = await data("/calendar");
    await expectError(await send("/local/clock", "PATCH", { date, expectedClockRevision: context.clockRevision, acknowledged: true }), 400, "INVALID_INPUT");
    expect(await data("/calendar")).toEqual(context);
  });

  it("requires authentication, same-origin confirmation and a strict clock body", async () => {
    const context = await data("/calendar");
    const body = { date: "2026-10-01", expectedClockRevision: context.clockRevision, acknowledged: true };
    expect((await send("/calendar", "GET", undefined, "")).status).toBe(401);
    expect((await send("/local/clock", "PATCH", body, "")).status).toBe(401);
    expect((await send("/local/clock", "PATCH", body, cookie, { origin: "https://attacker.example" })).status).toBe(400);
    for (const invalid of [{ ...body, acknowledged: false }, { ...body, ownerId: randomUUID() }]) {
      await expectError(await send("/local/clock", "PATCH", invalid), 400, "INVALID_INPUT");
    }
    expect(await data("/calendar")).toEqual(context);
  });
});
