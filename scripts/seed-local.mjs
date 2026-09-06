import { PrismaPg } from "../api/node_modules/@prisma/adapter-pg/dist/index.mjs";
import { PrismaClient } from "../api/src/generated/prisma/client.ts";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";


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
  return client.$transaction(async transaction => {
    const results = [];
    for (const user of seededUsers) {
      if (await transaction.app_user.findUnique({where: {id: user.id}})) {
        results.push({label: user.label, state: "skipped"});
        continue;
      }
      await transaction.app_user.create({data: {
        id: user.id, date_of_birth: user.dateOfBirth ? new Date(user.dateOfBirth) : null,
        ...(user.email ? {emails: {create: {normalized_email: user.email}}} : {}),
        ...(user.phone ? {phones: {create: {normalized_phone: user.phone}}} : {}),
      }});
      if (user.month) {
        const month = user.month;
        const month_start = new Date(month.monthStart);
        await transaction.reporting_month.create({data: {owner_id: user.id, month_start, tracked_from: new Date(month.trackedFrom), opening_source: "supplied", opening_balance_input: month.openingBalance, income_amount: month.income, ending_balance_amount: month.endingBalance, closed_at: new Date(month.closedAt), closed_by: "manual"}});
        for (const item of month.setup) {
          await transaction.monthly_recurring_expense.create({data: {owner_id: user.id, month_start, id: item.id, position: item.position, name: item.name, kind: item.kind, fixed_amount: item.fixedAmount}});
          await transaction.monthly_expense_detail.create({data: {owner_id: user.id, month_start, setup_item_id: item.id, confirmed_name: item.name, confirmed_kind: item.kind, confirmed_amount: item.detailAmount}});
        }
      }
      results.push({label: user.label, state: "seeded"});
    }
    return results;
  });
}

async function main() {
  if (process.env.DELEDGER_ENV !== "local") throw new Error("seed-local requires DELEDGER_ENV=local");
  const client = new PrismaClient({ adapter: new PrismaPg({ connectionString: localAdminDatabaseUrl() }) });
  try {
    const results = await seedLocal(client);
    for (const result of results) console.log(`${result.state} ${result.label}`);
  } finally {
    await client.$disconnect();
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
