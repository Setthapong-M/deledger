import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPool } from "@/test/postgres";
import { ownerA } from "@/test/factories";

process.env.APP_ORIGIN = "http://deledger.internal";
process.env.BUSINESS_TIME_ZONE = "Asia/Bangkok";
process.env.DATABASE_URL = "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test";
process.env.CLOUDFLARE_TEAM_DOMAIN = "https://team.cloudflareaccess.com";
process.env.CLOUDFLARE_ACCESS_AUD = "deledger-test-audience";

const admin = createTestPool();
let withDatabaseTransaction: typeof import("@/server/db/transaction").withDatabaseTransaction;
let updateIncome: typeof import("@/server/services/month-write").updateIncome;
let updateEndingBalance: typeof import("@/server/services/month-write").updateEndingBalance;
let recordSnapshot: typeof import("@/server/services/month-write").recordSnapshot;
let addRecurringExpense: typeof import("@/server/services/month-write").addRecurringExpense;
let editRecurringExpense: typeof import("@/server/services/month-write").editRecurringExpense;
let pauseRecurringExpense: typeof import("@/server/services/month-write").pauseRecurringExpense;
let reorderRecurringExpenses: typeof import("@/server/services/month-write").reorderRecurringExpenses;
let confirmExpenseDetail: typeof import("@/server/services/month-write").confirmExpenseDetail;
let cancelExpenseDetail: typeof import("@/server/services/month-write").cancelExpenseDetail;
let manualClose: typeof import("@/server/services/month-write").manualClose;

const month = "2026-08-01";

async function seed(opening = "20000.00", income = "30000.00", ending: string | null = null): Promise<void> {
  await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
  await admin.query("INSERT INTO app_user (id) VALUES ($1)", [ownerA]);
  await admin.query("INSERT INTO reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input, income_amount, ending_balance_amount) VALUES ($1, $2, '2026-08-03', 'supplied', $3, $4, $5)", [ownerA, month, opening, income, ending]);
}

describe("atomic monthly operations", () => {
  beforeAll(async () => {
    ({ withDatabaseTransaction } = await import("@/server/db/transaction"));
    ({ updateIncome, updateEndingBalance, recordSnapshot, addRecurringExpense, editRecurringExpense, pauseRecurringExpense, reorderRecurringExpenses, confirmExpenseDetail, cancelExpenseDetail, manualClose } = await import("@/server/services/month-write"));
  });

  afterAll(async () => {
    await admin.end();
  });

  it("writes summary inputs, snapshots, setup and confirmation facts with one revision per operation", async () => {
    await seed();
    const view = await withDatabaseTransaction(ownerA, "month-ops", async ({ client, ownerId }) => {
      let current = await updateIncome({ client, ownerId, requestId: "month-ops" }, { monthStart: month, expectedRevision: "0", income: "31000" });
      expect(current.revision).toBe("1");
      current = await updateEndingBalance({ client, ownerId, requestId: "month-ops" }, { monthStart: month, expectedRevision: "1", endingBalance: "40000" });
      expect(current.revision).toBe("2");
      current = await recordSnapshot({ client, ownerId, requestId: "month-ops" }, { monthStart: month, expectedRevision: "2", observedOn: "2026-08-15", amount: "39000" });
      expect(current.summary.provisionalSpending).toBeNull();
      current = await addRecurringExpense({ client, ownerId, requestId: "month-ops" }, { monthStart: month, expectedRevision: "3", name: "ค่าเช่า", kind: "fixed", fixedAmount: "6000" });
      current = await addRecurringExpense({ client, ownerId, requestId: "month-ops" }, { monthStart: month, expectedRevision: "4", name: "ค่าไฟ", kind: "variable" });
      const fixed = current.setup.find((item) => item.name === "ค่าเช่า")!;
      const variable = current.setup.find((item) => item.name === "ค่าไฟ")!;
      current = await confirmExpenseDetail({ client, ownerId, requestId: "month-ops" }, { monthStart: month, expectedRevision: "5", setupItemId: fixed.id });
      expect(current.setup.find((item) => item.id === fixed.id)?.detail?.confirmedAmount).toBe("6000.00");
      current = await confirmExpenseDetail({ client, ownerId, requestId: "month-ops" }, { monthStart: month, expectedRevision: "6", setupItemId: variable.id, amount: "2500" });
      expect(current.summary.detailTotal).toBe("8500.00");
      current = await confirmExpenseDetail({ client, ownerId, requestId: "month-ops" }, { monthStart: month, expectedRevision: "7", setupItemId: variable.id, amount: "3000", replace: true });
      expect(current.summary.detailTotal).toBe("9000.00");
      current = await cancelExpenseDetail({ client, ownerId, requestId: "month-ops" }, { monthStart: month, expectedRevision: "8", setupItemId: fixed.id });
      expect(current.summary.detailTotal).toBe("3000.00");
      current = await pauseRecurringExpense({ client, ownerId, requestId: "month-ops" }, { monthStart: month, expectedRevision: "9", setupItemId: variable.id, paused: true });
      expect(current.setup.find((item) => item.id === variable.id)?.isPaused).toBe(true);
      current = await reorderRecurringExpenses({ client, ownerId, requestId: "month-ops" }, { monthStart: month, expectedRevision: "10", setupItemIds: [variable.id, fixed.id] });
      expect(current.setup.map((item) => item.id)).toEqual([variable.id, fixed.id]);
      return current;
    });
    expect(view.revision).toBe("11");
  });

  it("blocks stale revisions and setup edits after confirmation", async () => {
    await seed();
    const error = await withDatabaseTransaction(ownerA, "month-conflict", async ({ client, ownerId }) => {
      const first = await addRecurringExpense({ client, ownerId, requestId: "month-conflict" }, { monthStart: month, expectedRevision: "0", name: "ค่าเช่า", kind: "fixed", fixedAmount: "6000" });
      const item = first.setup[0]!;
      await confirmExpenseDetail({ client, ownerId, requestId: "month-conflict" }, { monthStart: month, expectedRevision: "1", setupItemId: item.id });
      await expect(editRecurringExpense({ client, ownerId, requestId: "month-conflict" }, { monthStart: month, expectedRevision: "2", setupItemId: item.id, name: "แก้ไม่ได้", kind: "fixed", fixedAmount: "7000" })).rejects.toMatchObject({ code: "SETUP_ITEM_CONFIRMED" });
      try {
        await updateIncome({ client, ownerId, requestId: "month-conflict" }, { monthStart: month, expectedRevision: "0", income: "1.00" });
      } catch (caught) {
        return caught;
      }
      return null;
    });
    expect(error).toMatchObject({ code: "REVISION_CONFLICT" });
    expect((error as { current?: { revision?: string } }).current?.revision).toBe("2");
  });

  it("manual-closes only the final Bangkok day and does not create a future month", async () => {
    await seed("20000.00", "30000.00", "35000.00");
    const view = await withDatabaseTransaction(ownerA, "month-close", async ({ client, ownerId }) => manualClose({ client, ownerId, requestId: "month-close" }, { monthStart: month, expectedRevision: "0" }));
    expect(view.lifecycle).toBe("closed");
    expect(view.closedBy).toBe("manual");
    expect((await admin.query("SELECT count(*)::int AS count FROM reporting_month WHERE owner_id = $1 AND month_start = '2026-09-01'", [ownerA])).rows[0]?.count).toBe(0);
  });

  it("rejects snapshots after closure and outside the tracked interval", async () => {
    await seed();
    await expect(withDatabaseTransaction(ownerA, "month-invalid-snapshot", async ({ client, ownerId }) => recordSnapshot({ client, ownerId, requestId: "month-invalid-snapshot" }, { monthStart: month, expectedRevision: "0", observedOn: "2026-08-01", amount: "100" }))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await seed("20000.00", "30000.00", "35000.00");
    await withDatabaseTransaction(ownerA, "month-close-before-snapshot", async ({ client, ownerId }) => manualClose({ client, ownerId, requestId: "month-close-before-snapshot" }, { monthStart: month, expectedRevision: "0" }));
    await expect(withDatabaseTransaction(ownerA, "month-closed-snapshot", async ({ client, ownerId }) => recordSnapshot({ client, ownerId, requestId: "month-closed-snapshot" }, { monthStart: month, expectedRevision: "1", observedOn: "2026-08-15", amount: "100" }))).rejects.toMatchObject({ code: "MONTH_NOT_OPEN" });
  });
});
