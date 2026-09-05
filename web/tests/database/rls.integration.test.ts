import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPool, webDatabaseUrl } from "@/test/postgres";
import { ownerA, ownerB, monthA } from "@/test/factories";

const admin = createTestPool();
const web = createTestPool(webDatabaseUrl);

async function setOwner(ownerId: string | null): Promise<void> {
  await web.query("SELECT set_config('deledger.user_id', $1, true)", [ownerId ?? ""]);
}

describe("PostgreSQL row-level isolation", () => {
  beforeAll(async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_phone, user_identity_email, app_user CASCADE");
    await admin.query("INSERT INTO app_user (id) VALUES ($1), ($2)", [ownerA, ownerB]);
    await admin.query("INSERT INTO user_identity_phone (normalized_phone, owner_id) VALUES ('+66810000001', $1)", [ownerB]);
    await admin.query("INSERT INTO reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input) VALUES ($1, $3, $3, 'supplied', '20000.00'), ($2, $3, $3, 'supplied', '10000.00')", [ownerA, ownerB, monthA]);
    await admin.query("INSERT INTO monthly_recurring_expense (owner_id, month_start, position, name, kind, fixed_amount) VALUES ($1, $3, 1, 'A rent', 'fixed', '6000.00'), ($2, $3, 1, 'B rent', 'fixed', '7000.00')", [ownerA, ownerB, monthA]);
    await admin.query("INSERT INTO monthly_expense_detail (owner_id, month_start, setup_item_id, confirmed_name, confirmed_kind, confirmed_amount) SELECT owner_id, month_start, id, name, kind, fixed_amount FROM monthly_recurring_expense WHERE owner_id = $1", [ownerB]);
  });

  afterAll(async () => {
    await web.end();
    await admin.end();
  });

  it("hides guessed owners and rejects writes across every granted table", async () => {
    await web.query("BEGIN");
    try {
      await setOwner(ownerA);
      const hidden = await web.query("SELECT id FROM app_user WHERE id = $1 UNION ALL SELECT owner_id FROM user_identity_phone WHERE owner_id = $1 UNION ALL SELECT owner_id FROM reporting_month WHERE owner_id = $1 UNION ALL SELECT owner_id FROM balance_snapshot WHERE owner_id = $1 UNION ALL SELECT owner_id FROM monthly_recurring_expense WHERE owner_id = $1 UNION ALL SELECT owner_id FROM monthly_expense_detail WHERE owner_id = $1", [ownerB]);
      expect(hidden.rows).toHaveLength(0);

      expect((await web.query("UPDATE app_user SET resume_required_at = clock_timestamp() WHERE id = $1", [ownerB])).rowCount).toBe(0);
      expect((await web.query("UPDATE reporting_month SET income_amount = '1.00' WHERE owner_id = $1 AND month_start = $2", [ownerB, monthA])).rowCount).toBe(0);
      expect((await web.query("UPDATE monthly_recurring_expense SET name = 'nope' WHERE owner_id = $1 AND month_start = $2", [ownerB, monthA])).rowCount).toBe(0);
      expect((await web.query("DELETE FROM monthly_expense_detail WHERE owner_id = $1 AND month_start = $2", [ownerB, monthA])).rowCount).toBe(0);

      await expect(web.query("INSERT INTO reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input) VALUES ($1, '2026-09-01', '2026-09-01', 'supplied', '1.00')", [ownerB])).rejects.toMatchObject({ code: "42501" });
      await expect(web.query("INSERT INTO monthly_recurring_expense (owner_id, month_start, position, name, kind, fixed_amount) VALUES ($1, $2, 2, 'nope', 'fixed', '1.00')", [ownerB, monthA])).rejects.toMatchObject({ code: "42501" });
      await expect(web.query("INSERT INTO user_identity_phone (normalized_phone, owner_id) VALUES ('+66810000002', $1)", [ownerB])).rejects.toMatchObject({ code: "42501" });
    } finally {
      await web.query("ROLLBACK");
    }
  });

  it("returns no rows without a transaction-local owner context", async () => {
    await web.query("BEGIN");
    try {
      await setOwner(null);
      expect((await web.query("SELECT id FROM app_user")).rows).toHaveLength(0);
      expect((await web.query("SELECT normalized_phone FROM user_identity_phone")).rows).toHaveLength(0);
      expect((await web.query("SELECT owner_id FROM reporting_month")).rows).toHaveLength(0);
      await expect(web.query("INSERT INTO balance_snapshot (owner_id, month_start, observed_on, amount) VALUES ($1, $2, $2, '1.00')", [ownerB, monthA])).rejects.toMatchObject({ code: "42501" });
    } finally {
      await web.query("ROLLBACK");
    }
  });

  it("uses fixed search paths on every security-definer function", async () => {
    const functions = await admin.query<{ proname: string; prosecdef: boolean; proconfig: string[] | null }>("SELECT p.proname, p.prosecdef, p.proconfig FROM pg_proc AS p JOIN pg_namespace AS n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname IN ('resolve_current_identity', 'current_business_date', 'current_owner_id', 'catch_up_owner_reporting_months', 'catch_up_reporting_months', 'catch_up_current_owner_reporting_months', 'operator_invite', 'operator_archive', 'operator_restore', 'operator_transfer_email') ORDER BY p.proname");
    expect(functions.rows.length).toBe(10);
    for (const row of functions.rows) {
      expect(row.prosecdef).toBe(true);
      expect(row.proconfig?.some((value) => value === "search_path=pg_catalog, public")).toBe(true);
    }
  });
});
