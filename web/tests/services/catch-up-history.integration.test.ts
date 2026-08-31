import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPool } from "@/test/postgres";
import { ownerA, ownerB } from "@/test/factories";

process.env.APP_ORIGIN = "http://deledger.internal";
process.env.BUSINESS_TIME_ZONE = "Asia/Bangkok";
process.env.DATABASE_URL = "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test";
process.env.CLOUDFLARE_TEAM_DOMAIN = "https://team.cloudflareaccess.com";
process.env.CLOUDFLARE_ACCESS_AUD = "deledger-test-audience";

const admin = createTestPool();
let withDatabaseTransaction: typeof import("@/server/db/transaction").withDatabaseTransaction;
let catchUpCurrentOwner: typeof import("@/server/services/catch-up").catchUpCurrentOwner;
let catchUpAll: typeof import("@/server/services/catch-up").catchUpAll;
let listHistory: typeof import("@/server/services/history").listHistory;

async function seedUser(ownerId: string, resumeRequired = false): Promise<void> {
  await admin.query("INSERT INTO app_user (id, resume_required_at) VALUES ($1, CASE WHEN $2 THEN clock_timestamp() ELSE NULL END)", [ownerId, resumeRequired]);
  await admin.query("INSERT INTO reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input, income_amount) VALUES ($1, '2026-07-01', '2026-07-01', 'supplied', '20000.00', '30000.00')", [ownerId]);
  await admin.query("INSERT INTO monthly_recurring_expense (owner_id, month_start, position, name, kind, fixed_amount, is_paused) VALUES ($1, '2026-07-01', 1, 'ค่าเช่า', 'fixed', '6000.00', false)", [ownerId]);
}

describe("automatic catch-up and history continuity", () => {
  beforeAll(async () => {
    ({ withDatabaseTransaction } = await import("@/server/db/transaction"));
    ({ catchUpCurrentOwner, catchUpAll } = await import("@/server/services/catch-up"));
    ({ listHistory } = await import("@/server/services/history"));
  });

  afterAll(async () => {
    await admin.end();
  });

  it("closes due months, creates one current open month and copies setup idempotently", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await seedUser(ownerA);
    const result = await withDatabaseTransaction(ownerA, "catch-up-active", async ({ client }) => catchUpCurrentOwner(client));
    expect(result).toBe(2);
    const months = await admin.query<{ month_start: string; closed_at: string | null; opening_source: string }>("SELECT month_start::text, closed_at, opening_source FROM reporting_month WHERE owner_id = $1 ORDER BY month_start", [ownerA]);
    expect(months.rows.map((row) => [row.month_start, row.closed_at === null, row.opening_source])).toEqual([["2026-07-01", false, "supplied"], ["2026-08-01", true, "prior_ending"]]);
    const setup = await admin.query<{ id: string; position: number }>("SELECT id::text, position FROM monthly_recurring_expense WHERE owner_id = $1 AND month_start = '2026-08-01'", [ownerA]);
    expect(setup.rows).toHaveLength(1);
    await withDatabaseTransaction(ownerA, "catch-up-repeat", async ({ client }) => catchUpCurrentOwner(client));
    expect((await admin.query("SELECT count(*)::int AS count FROM reporting_month WHERE owner_id = $1", [ownerA])).rows[0]?.count).toBe(2);
  });

  it("does not create future months while resume is required", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await seedUser(ownerA, true);
    await withDatabaseTransaction(ownerA, "catch-up-resume", async ({ client }) => catchUpCurrentOwner(client));
    const months = await admin.query<{ month_start: string; closed_at: string | null }>("SELECT month_start::text, closed_at FROM reporting_month WHERE owner_id = $1 ORDER BY month_start", [ownerA]);
    expect(months.rows).toHaveLength(1);
    expect(months.rows[0]?.closed_at).not.toBeNull();
  });

  it("closes only the last due open month while archived and preserves the gap", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await seedUser(ownerB);
    await admin.query("INSERT INTO user_archive_period (owner_id, archived_at) VALUES ($1, '2026-07-15T12:00:00+07:00')", [ownerB]);
    const client = await admin.connect();
    let result: number;
    try {
      result = await catchUpAll(client);
    } finally {
      client.release();
    }
    expect(result).toBeGreaterThanOrEqual(1);
    const months = await admin.query<{ month_start: string; closed_at: string | null }>("SELECT month_start::text, closed_at FROM reporting_month WHERE owner_id = $1 ORDER BY month_start", [ownerB]);
    expect(months.rows).toHaveLength(1);
    expect(months.rows[0]?.closed_at).not.toBeNull();
  });

  it("exposes a restored archive interval as a Tracking Gap without monetary guesses", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await seedUser(ownerA);
    await admin.query("UPDATE reporting_month SET closed_at = clock_timestamp(), closed_by = 'automatic' WHERE owner_id = $1", [ownerA]);
    await admin.query("INSERT INTO reporting_month (owner_id, month_start, tracked_from, opening_source) VALUES ($1, '2026-08-01', '2026-08-01', 'prior_ending')", [ownerA]);
    await admin.query("INSERT INTO user_archive_period (owner_id, archived_at, restored_at) VALUES ($1, '2026-07-15T12:00:00+07:00', '2026-08-03T12:00:00+07:00')", [ownerA]);
    const entries = await withDatabaseTransaction(ownerA, "history-gap", async ({ client, ownerId }) => listHistory(client, ownerId));
    const gap = entries.find((entry) => entry.kind === "tracking_gap");
    expect(gap?.kind).toBe("tracking_gap");
    expect(gap?.archivedAt).toContain("2026-07-15");
    expect(gap?.restoredAt).toContain("2026-08-03");
  });
});
