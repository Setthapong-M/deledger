import pg from "pg";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { Pool } = pg;

const seededUsers = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    label: "demo-email",
    email: "demo.email@local.test",
    phone: null,
    dateOfBirth: null,
    month: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    label: "demo-phone",
    email: null,
    phone: "+66810000001",
    dateOfBirth: "1988-04-12",
    month: null,
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    label: "demo-linked",
    email: "demo.linked@local.test",
    phone: "+66810000002",
    dateOfBirth: "1992-11-03",
    month: {
      monthStart: "2026-08-01",
      trackedFrom: "2026-08-01",
      openingBalance: "100000.00",
      income: "50000.00",
      endingBalance: "115000.00",
      closedAt: "2026-08-31T23:59:00+07:00",
      setup: [
        { id: "00000000-0000-4000-8000-000000000201", position: 1, name: "ค่าเช่า", kind: "fixed", fixedAmount: "20000.00", detailAmount: "20000.00" },
        { id: "00000000-0000-4000-8000-000000000202", position: 2, name: "อาหาร", kind: "variable", fixedAmount: null, detailAmount: "15000.00" },
      ],
    },
  },
];

export function localAdminDatabaseUrl(environment = process.env) {
  const value = environment.LOCAL_ADMIN_DATABASE_URL ?? environment.DATABASE_URL;
  if (!value) throw new Error("LOCAL_ADMIN_DATABASE_URL is required");
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("LOCAL_ADMIN_DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (parsed.protocol !== "postgresql:" || !["127.0.0.1", "localhost"].includes(parsed.hostname) || parsed.pathname !== "/deledger_local" || parsed.username !== "postgres") {
    throw new Error("seed-local accepts only the local postgres administrator database");
  }
  return value;
}

export async function seedLocal(client) {
  const results = [];
  await client.query("BEGIN");
  try {
    for (const user of seededUsers) results.push(await seedUser(client, user));
    await client.query("COMMIT");
    return results;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

async function seedUser(client, user) {
  const existing = await client.query("SELECT 1 FROM public.app_user WHERE id = $1", [user.id]);
  if (existing.rowCount !== 0) return { label: user.label, state: "skipped" };
  await assertContactAvailable(client, "user_identity_email", "normalized_email", user.email, user.id);
  await assertContactAvailable(client, "user_identity_phone", "normalized_phone", user.phone, user.id);
  await client.query("INSERT INTO public.app_user (id, date_of_birth) VALUES ($1, $2)", [user.id, user.dateOfBirth]);
  if (user.email) await client.query("INSERT INTO public.user_identity_email (normalized_email, owner_id) VALUES ($1, $2)", [user.email, user.id]);
  if (user.phone) await client.query("INSERT INTO public.user_identity_phone (normalized_phone, owner_id) VALUES ($1, $2)", [user.phone, user.id]);
  if (user.month) await seedMonth(client, user.id, user.month);
  return { label: user.label, state: "seeded" };
}

async function assertContactAvailable(client, table, column, value, ownerId) {
  if (!value) return;
  const result = await client.query(`SELECT owner_id FROM public.${table} WHERE ${column} = $1`, [value]);
  if (result.rows[0] && result.rows[0].owner_id !== ownerId) throw new Error(`seed contact ${value} already belongs to another User`);
}

async function seedMonth(client, ownerId, month) {
  await client.query(
    "INSERT INTO public.reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input, income_amount, ending_balance_amount, closed_at, closed_by) VALUES ($1, $2, $3, 'supplied', $4, $5, $6, $7, 'manual')",
    [ownerId, month.monthStart, month.trackedFrom, month.openingBalance, month.income, month.endingBalance, month.closedAt],
  );
  for (const item of month.setup) {
    await client.query(
      "INSERT INTO public.monthly_recurring_expense (owner_id, month_start, id, position, name, kind, fixed_amount) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [ownerId, month.monthStart, item.id, item.position, item.name, item.kind, item.fixedAmount],
    );
    await client.query(
      "INSERT INTO public.monthly_expense_detail (owner_id, month_start, setup_item_id, confirmed_name, confirmed_kind, confirmed_amount) VALUES ($1, $2, $3, $4, $5, $6)",
      [ownerId, month.monthStart, item.id, item.name, item.kind, item.detailAmount],
    );
  }
}

async function main() {
  if (process.env.DELEDGER_ENV !== "local") throw new Error("seed-local requires DELEDGER_ENV=local");
  const pool = new Pool({ connectionString: localAdminDatabaseUrl() });
  const client = await pool.connect();
  try {
    const results = await seedLocal(client);
    for (const result of results) console.log(`${result.state} ${result.label}`);
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
