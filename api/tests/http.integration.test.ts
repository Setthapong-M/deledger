import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../src/app.js";

import { randomUUID } from "node:crypto";
import { setBusinessClock } from "../src/server/domain/clock.js";
import { disconnectDatabase } from "../src/server/db/pool.js";

const environment = {
  DELEDGER_ENV: "local", NODE_ENV: "test", APP_ORIGIN: "http://127.0.0.1:3014",
  BUSINESS_TIME_ZONE: "Asia/Bangkok",
  DATABASE_URL: "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test",
  IDENTITY_DATABASE_URL: "postgresql://deledger_identity:test-identity-password@127.0.0.1:55432/deledger_test",
};

Object.assign(process.env, environment);
let app: Awaited<ReturnType<typeof createApplication>>;
let origin: string;
beforeAll(async () => {
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
});
afterAll(async () => { await app?.close(); await disconnectDatabase(); });
afterEach(() => setBusinessClock(() => new Date()));

describe("Nest public HTTP contract", () => {
  it("serves liveness without authentication and keeps responses private", async () => {
    const response = await fetch(`${origin}/api/health/live`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ data: { status: "ok" } });
  });
});

async function send(path: string, method = "GET", body?: unknown, cookie?: string, extraHeaders: Record<string, string> = {}) {
  return fetch(`${origin}/api${path}`, { method, headers: {
    origin: environment.APP_ORIGIN, ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(cookie ? { cookie } : {}), ...extraHeaders,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function login() {
  const response = await send("/auth/login", "POST", { identifier: `${randomUUID()}@example.com` });
  expect(response.status).toBe(200);
  expect(response.headers.get("set-cookie")).toContain("HttpOnly; SameSite=Lax");
  return response.headers.get("set-cookie")!.split(";", 1)[0]!;
}

it("authenticates, onboards, writes and reports conflicts over real HTTP", async () => {
  setBusinessClock(() => new Date("2026-08-31T10:00:00Z"));
  const cookie = await login();
  expect(await (await send("/bootstrap", "GET", undefined, cookie)).json()).toEqual({ data: { state: "onboarding_required", month: null, businessDate: "2026-08-31" } });
  const created = await send("/onboarding", "POST", { openingBalance: "1000.01", income: "200.02" }, cookie);
  expect(created.status).toBe(200);
  const { data: month } = await created.json();
  expect(month.month).toBe("2026-08");
  const current = await send("/months/current", "GET", undefined, cookie);
  expect(current.status).toBe(200);
  expect((await current.json()).data.month.month).toBe("2026-08");
  expect(month.summary.startingBalance).toBe("1000.01");
  const snapshotResponse = await send("/months/2026-08/snapshots", "POST", { observedOn: "2026-08-31", amount: "900.01", expectedRevision: month.revision }, cookie);
  expect(snapshotResponse.status).toBe(200);
  const { data: snapshot } = await snapshotResponse.json();
  expect(snapshot.summary.provisionalSpending).toBe("300.02");
  expect(snapshot.summary.endingBalance).toBeNull();
  const ending = await send("/months/2026-08/ending-balance", "PUT", { amount: "900.00", expectedRevision: snapshot.revision }, cookie);
  expect(ending.status).toBe(200);
  const { data: updated } = await ending.json();
  expect(updated.summary.monthlySpending).toBe("300.03");
  const stale = await send("/months/2026-08/income", "PUT", { amount: "999.00", expectedRevision: month.revision }, cookie);
  expect(stale.status).toBe(409);
  expect((await stale.json()).error.current.revision).toBe(updated.revision);
  const closed = await send("/months/2026-08/close", "POST", { expectedRevision: updated.revision }, cookie);
  expect(closed.status).toBe(200);
  expect((await closed.json()).data.reconciliation.state).toBe("reconciled");
  const history = await send("/months", "GET", undefined, cookie);
  expect((await history.json()).data[0].view.lifecycle).toBe("closed");
});

it("rejects forged identity, cross-origin writes, unknown body fields and revoked sessions", async () => {
  const unauthenticated = await send("/profile", "GET", undefined, undefined, { "x-user-id": randomUUID() });
  expect(unauthenticated.status).toBe(401);
  const cookie = await login();
  const remote = await send("/profile", "PATCH", { dateOfBirth: "2000-01-01" }, cookie, { origin: "https://attacker.example" });
  expect(remote.status).toBe(400);
  const invalid = await send("/onboarding", "POST", { openingBalance: "1.00", income: "0.00", ownerId: randomUUID() }, cookie);
  expect(invalid.status).toBe(400);
  const other = await login();
  const left = (await (await send("/profile", "GET", undefined, cookie)).json()).data;
  const right = (await (await send("/profile", "GET", undefined, other)).json()).data;
  expect(left.email).not.toBe(right.email);
  const logout = await send("/auth/logout", "POST", {}, cookie);
  expect(logout.status).toBe(200);
  expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  expect((await send("/profile", "GET", undefined, cookie)).status).toBe(401);
});

it("uses identical validation and revision-required envelopes after the Nest adapter", async () => {
  const cookie = await login();
  const missingRevision = await send(`/months/2026-08/details/${randomUUID()}`, "DELETE", undefined, cookie);
  expect(missingRevision.status).toBe(428);
  expect((await missingRevision.json()).error.code).toBe("REVISION_REQUIRED");
  const malformed = await fetch(`${origin}/api/onboarding`, { method: "POST", headers: { cookie, origin: environment.APP_ORIGIN, "content-type": "application/json" }, body: "{" });
  expect(malformed.status).toBe(400);
  const notJson = await fetch(`${origin}/api/onboarding`, { method: "POST", headers: { cookie, origin: environment.APP_ORIGIN, "content-type": "text/plain" }, body: "{}" });
  expect(notJson.status).toBe(400);
  const wrongMoney = await send("/onboarding", "POST", { openingBalance: 1, income: "0.00" }, cookie);
  expect(wrongMoney.status).toBe(400);
});
