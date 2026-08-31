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
let startOnboarding: typeof import("@/server/services/lifecycle").startOnboarding;
let resumeTracking: typeof import("@/server/services/lifecycle").resumeTracking;
let readBootstrap: typeof import("@/server/services/bootstrap").readBootstrap;

describe("lifecycle services", () => {
  beforeAll(async () => {
    ({ withDatabaseTransaction } = await import("@/server/db/transaction"));
    ({ startOnboarding, resumeTracking } = await import("@/server/services/lifecycle"));
    ({ readBootstrap } = await import("@/server/services/bootstrap"));
  });

  afterAll(async () => {
    await admin.end();
  });

  it("creates one supplied Partial Month during onboarding and reports ready bootstrap", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await admin.query("INSERT INTO app_user (id) VALUES ($1)", [ownerA]);
    const view = await withDatabaseTransaction(ownerA, "lifecycle-onboard", async ({ client, ownerId }) => startOnboarding(client, ownerId, { openingBalance: "20000", income: "30000" }));
    expect(view.month).toMatch(/^\d{4}-\d{2}$/);
    expect(view.lifecycle).toBe("open");
    expect(view.isPartial).toBe(true);
    expect(view.summary.startingBalance).toBe("20000.00");
    expect(view.summary.income).toBe("30000.00");
    expect((await admin.query("SELECT count(*)::int AS count FROM reporting_month WHERE owner_id = $1", [ownerA])).rows[0]?.count).toBe(1);
    const bootstrap = await withDatabaseTransaction(ownerA, "lifecycle-bootstrap", async ({ client, ownerId }) => readBootstrap(client, ownerId));
    expect(bootstrap.state).toBe("ready");
    expect(bootstrap.month?.month).toBe(view.month);
  });

  it("requires onboarding only once and resumes with a fresh supplied Partial Month plus setup snapshot", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await admin.query("INSERT INTO app_user (id, resume_required_at) VALUES ($1, clock_timestamp())", [ownerA]);
    const previousMonth = "2026-07-01";
    await admin.query("INSERT INTO reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input, income_amount, ending_balance_amount, closed_at, closed_by) VALUES ($1, $2, $2, 'supplied', '15000.00', '30000.00', '10000.00', clock_timestamp(), 'automatic')", [ownerA, previousMonth]);
    await admin.query("INSERT INTO monthly_recurring_expense (owner_id, month_start, position, name, kind, fixed_amount, is_paused) VALUES ($1, $2, 1, 'ค่าเช่า', 'fixed', '6000.00', false), ($1, $2, 2, 'ค่าไฟ', 'variable', NULL, true)", [ownerA, previousMonth]);
    const view = await withDatabaseTransaction(ownerA, "lifecycle-resume", async ({ client, ownerId }) => resumeTracking(client, ownerId, { openingBalance: "25000.00", income: "30000.00" }));
    expect(view.isPartial).toBe(true);
    expect(view.summary.startingBalance).toBe("25000.00");
    expect(view.setup).toHaveLength(2);
    expect(view.setup.map((item) => [item.name, item.position, item.isPaused])).toEqual([["ค่าเช่า", 1, false], ["ค่าไฟ", 2, true]]);
    const state = await admin.query<{ resume_required_at: string | null }>("SELECT resume_required_at FROM app_user WHERE id = $1", [ownerA]);
    expect(state.rows[0]?.resume_required_at).toBeNull();
  });

  it("returns onboarding_required for an active invited User without a Reporting Month", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await admin.query("INSERT INTO app_user (id) VALUES ($1)", [ownerB]);
    const bootstrap = await withDatabaseTransaction(ownerB, "lifecycle-empty", async ({ client, ownerId }) => readBootstrap(client, ownerId));
    expect(bootstrap).toEqual({ state: "onboarding_required", month: null });
  });
});
