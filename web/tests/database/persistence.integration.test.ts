import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestPool } from "@/test/postgres";
import { ownerA, monthA } from "@/test/factories";
import { getMonthProjection } from "@/server/repositories/months";
import { toMonthView } from "@/server/domain/month-view";

const pool = createTestPool();

describe("PostgreSQL persistence contract", () => {
  beforeAll(async () => {
    await pool.query("SELECT 1");
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
  });

  afterAll(async () => {
    await pool.end();
  });

  it("has both required extensions and seven financial tables", async () => {
    const extensions = await pool.query<{ extname: string }>("SELECT extname FROM pg_extension WHERE extname IN ('pgcrypto', 'pg_cron') ORDER BY extname");
    expect(extensions.rows.map((row) => row.extname)).toEqual(["pg_cron", "pgcrypto"]);
    const tables = await pool.query<{ tablename: string }>("SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('app_user', 'user_identity_email', 'user_archive_period', 'reporting_month', 'balance_snapshot', 'monthly_recurring_expense', 'monthly_expense_detail') ORDER BY tablename");
    expect(tables.rows.map((row) => row.tablename)).toEqual(["app_user", "balance_snapshot", "monthly_expense_detail", "monthly_recurring_expense", "reporting_month", "user_archive_period", "user_identity_email"]);
  });

  it("separates role ownership and keeps web role non-privileged", async () => {
    const role = await pool.query<{ rolsuper: boolean; rolbypassrls: boolean; rolcreaterole: boolean; rolcreatedb: boolean }>("SELECT rolsuper, rolbypassrls, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = 'deledger_web'");
    expect(role.rows[0]).toEqual({ rolsuper: false, rolbypassrls: false, rolcreaterole: false, rolcreatedb: false });
    const owned = await pool.query<{ relname: string }>("SELECT c.relname FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner WHERE r.rolname = 'deledger_web' AND c.relkind IN ('r', 'p')");
    expect(owned.rows).toEqual([]);
  });

  it("enforces amount, source and closure constraints", async () => {
    await pool.query("INSERT INTO app_user (id) VALUES ($1)", [ownerA]);
    await expect(pool.query("INSERT INTO reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input) VALUES ($1, '2026-08-01', '2026-08-01', 'prior_ending', '1.00')", [ownerA])).rejects.toMatchObject({ code: "23514" });
    await pool.query("INSERT INTO reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input) VALUES ($1, $2, $2, 'supplied', '20000.00')", [ownerA, monthA]);
    await expect(pool.query("INSERT INTO monthly_recurring_expense (owner_id, month_start, position, name, kind, fixed_amount) VALUES ($1, $2, 1, 'Bad', 'variable', '2.00')", [ownerA, monthA])).rejects.toMatchObject({ code: "23514" });
    await pool.query("INSERT INTO monthly_recurring_expense (owner_id, month_start, position, name, kind, fixed_amount) VALUES ($1, $2, 1, 'Rent', 'fixed', '6000.00')", [ownerA, monthA]);
    await expect(pool.query("INSERT INTO reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input, closed_by) VALUES ($1, '2026-09-01', '2026-09-01', 'supplied', '0.00', 'manual')", [ownerA])).rejects.toMatchObject({ code: "23514" });
  });

  it("uses deferred dense position uniqueness and restricts child deletion", async () => {
    await pool.query("INSERT INTO app_user (id) VALUES ($1)", [ownerA]);
    await pool.query("INSERT INTO reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input) VALUES ($1, $2, $2, 'supplied', '20000.00')", [ownerA, monthA]);
    await pool.query("INSERT INTO monthly_recurring_expense (owner_id, month_start, position, name, kind, fixed_amount) VALUES ($1, $2, 1, 'Rent', 'fixed', '6000.00')", [ownerA, monthA]);
    await pool.query("INSERT INTO monthly_recurring_expense (owner_id, month_start, position, name, kind, fixed_amount) VALUES ($1, $2, 2, 'Internet', 'fixed', '500.00')", [ownerA, monthA]);
    const item = await pool.query<{ id: string }>("SELECT id FROM monthly_recurring_expense WHERE owner_id = $1 AND month_start = $2 AND position = 1", [ownerA, monthA]);
    await pool.query("BEGIN");
    await pool.query("UPDATE monthly_recurring_expense SET position = CASE WHEN position = 1 THEN 2 ELSE 1 END WHERE owner_id = $1 AND month_start = $2", [ownerA, monthA]);
    await pool.query("COMMIT");
    await pool.query("INSERT INTO monthly_expense_detail (owner_id, month_start, setup_item_id, confirmed_name, confirmed_kind, confirmed_amount) VALUES ($1, $2, $3, 'Rent', 'fixed', '6000.00')", [ownerA, monthA, item.rows[0]?.id]);
    await expect(pool.query("DELETE FROM monthly_recurring_expense WHERE owner_id = $1 AND month_start = $2 AND id = $3", [ownerA, monthA, item.rows[0]?.id])).rejects.toMatchObject({ code: "23001" });
  });

  it("derives the Month View projection from stored inputs", async () => {
    await pool.query("INSERT INTO app_user (id) VALUES ($1)", [ownerA]);
    await pool.query("INSERT INTO reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input, income_amount, ending_balance_amount, closed_at, closed_by) VALUES ($1, $2, $2, 'supplied', '20000.00', '30000.00', '35000.00', clock_timestamp(), 'manual')", [ownerA, monthA]);
    const client = await pool.connect();
    try {
      const projection = await getMonthProjection(client, ownerA, monthA);
      expect(projection?.monthlySpending).toBe("15000.00");
      const view = projection && toMonthView(projection, { editIncome: false, recordSnapshot: false, editEndingBalance: false, manageSetup: false, confirmDetails: false, manualClose: false });
      expect(view?.summary.detailTotal).toBe("0.00");
      expect(view?.summary.unitemizedSpending).toBe("15000.00");
      expect(view?.lifecycle).toBe("closed");
    } finally {
      client.release();
    }
  });
});
