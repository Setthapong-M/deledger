import { randomUUID } from "node:crypto";
import { afterAll, afterEach, expect, it } from "vitest";
import { disconnectDatabase } from "../src/server/db/pool.js";
import { withClient, withUserTransaction } from "../src/server/db/transaction.js";
import { currentBusinessDate } from "../src/server/domain/calendar.js";
import { setBusinessClock } from "../src/server/domain/clock.js";
import { changeLocalDate, readCalendarContext, withCalendarGate } from "../src/server/domain/local-calendar.js";
import { runScheduledCatchUp } from "../src/scheduler.js";
import { loginLocal } from "../src/server/services/local-auth.js";
import { startOnboarding } from "../src/server/services/lifecycle.js";

afterAll(disconnectDatabase);
afterEach(async () => {
  await withCalendarGate(true, async () => { changeLocalDate(null, readCalendarContext(true).clockRevision!); });
  setBusinessClock(() => new Date());
});

it.skipIf(!process.env.IDENTITY_DATABASE_URL)("serializes a clock change and scheduler behind an in-flight user write", async () => {
  setBusinessClock(() => new Date("2026-09-30T10:00:00Z"));
  const session = await withClient(client => loginLocal(client, `${randomUUID()}@example.com`));
  const request = new Request("http://localhost/api/onboarding", { headers: { cookie: `deledger_local_session=${session.token}` } });
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>(resolve => { entered = resolve; });
  const waiting = new Promise<void>(resolve => { release = resolve; });
  const write = withUserTransaction(request, randomUUID(), { mode: "local" }, async ({ client, ownerId }) => {
    await startOnboarding(client, ownerId, { openingBalance: "1000.00", income: "0.00" });
    entered();
    await waiting;
    expect(currentBusinessDate()).toBe("2026-09-30");
    return ownerId;
  });
  await started;
  const change = withCalendarGate(true, async () => changeLocalDate("2026-10-01", readCalendarContext(true).clockRevision!));
  const scheduled = runScheduledCatchUp();
  release();
  const [ownerId] = await Promise.all([write, change, scheduled]);
  const rows = await withClient(client => client.reporting_month.findMany({ where: { owner_id: ownerId }, orderBy: { month_start: "asc" } }));
  expect(rows.map(row => [row.month_start.toISOString().slice(0, 7), row.closed_by])).toEqual([["2026-09", "automatic"], ["2026-10", null]]);
});

it.skipIf(!process.env.IDENTITY_DATABASE_URL)("retries a rolled-back financial operation with its admitted date across midnight", async () => {
  setBusinessClock(() => new Date("2026-09-30T16:59:59Z"));
  const session = await withClient(client => loginLocal(client, `${randomUUID()}@example.com`));
  const token = readCalendarContext(true).clockRevision!;
  const request = new Request("http://localhost/api/onboarding", { headers: { cookie: `deledger_local_session=${session.token}`, "x-deledger-clock-revision": token } });
  const dates: string[] = [];
  const result = await withUserTransaction(request, randomUUID(), { mode: "local" }, async ({ client, ownerId }) => {
    dates.push(currentBusinessDate());
    const month = await startOnboarding(client, ownerId, { openingBalance: "1000.00", income: "0.00" });
    if (dates.length === 1) {
      setBusinessClock(() => new Date("2026-09-30T17:00:01Z"));
      throw Object.assign(new Error("injected retryable transaction failure"), { code: "P2034" });
    }
    expect(await client.reporting_month.count({ where: { owner_id: ownerId } })).toBe(1);
    return month;
  });
  expect(dates).toEqual(["2026-09-30", "2026-09-30"]);
  expect(result).toMatchObject({ month: "2026-09", lifecycle: "open", revision: "0", trackedFrom: "2026-09-30" });
  await expect(withUserTransaction(request, randomUUID(), { mode: "local" }, async () => null)).rejects.toMatchObject({ code: "CLOCK_CONFLICT" });
});
