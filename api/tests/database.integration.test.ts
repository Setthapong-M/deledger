import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { prisma, identityPrisma, disconnectDatabase } from "../src/server/db/pool.js";
import { withDatabaseTransaction, withClient, withUserTransaction } from "../src/server/db/transaction.js";
import { recordSnapshot, addRecurringExpense, confirmExpenseDetail } from "../src/server/services/month-write.js";
import { loginLocal } from "../src/server/services/local-auth.js";
import { lockOwner, setTransactionOwner } from "../src/server/db/rls.js";

const enabled = Boolean(process.env.DATABASE_URL && process.env.IDENTITY_DATABASE_URL);
afterAll(disconnectDatabase);
describe.skipIf(!enabled)("database isolation and atomicity", () => {
  it("denies ownerless access and cross-owner reads/writes, and clears owner context after commit", async () => {
    const first = randomUUID(), second = randomUUID();
    await identityPrisma.app_user.createMany({ data: [{ id: first }, { id: second }] });
    expect(await prisma.app_user.findMany()).toEqual([]);
    await withDatabaseTransaction(first, randomUUID(), async ({ client }) => {
      expect((await client.app_user.findMany()).map(row => row.id)).toEqual([first]);
      expect(await client.app_user.findUnique({ where: { id: second } })).toBeNull();
      expect((await client.app_user.updateMany({ where: { id: second }, data: { date_of_birth: new Date("2000-01-01") } })).count).toBe(0);
    });
    expect(await prisma.app_user.findMany()).toEqual([]);
    await expect(prisma.$transaction(async client => {
      await setTransactionOwner(client, first);
      await client.reporting_month.create({ data: { owner_id: second, month_start: new Date("2026-09-01"), tracked_from: new Date("2026-09-01"), opening_source: "supplied", opening_balance_input: "100.00" } });
    })).rejects.toThrow();
  });
  it("keeps financial snapshots immutable while allowing supported service writes", async () => {
    const ownerId = randomUUID();
    const monthStart = "2026-09-01";
    const month = { owner_id: ownerId, month_start: new Date(monthStart) };
    await identityPrisma.app_user.create({ data: { id: ownerId } });
    await withDatabaseTransaction(ownerId, randomUUID(), async context => {
      await context.client.reporting_month.create({ data: { ...month, tracked_from: new Date(monthStart), opening_source: "supplied", opening_balance_input: "100.00" } });
      await recordSnapshot(context, { monthStart, expectedRevision: "0", observedOn: "2026-09-01", amount: "80.00" });
      await addRecurringExpense(context, { monthStart, expectedRevision: "1", name: "Rent", kind: "fixed", fixedAmount: "20.00" });
      const item = await context.client.monthly_recurring_expense.findFirstOrThrow({ where: month });
      await confirmExpenseDetail(context, { monthStart, expectedRevision: "2", setupItemId: item.id });
    });
    await expect(withDatabaseTransaction(ownerId, randomUUID(), ({ client }) => client.balance_snapshot.updateMany({ where: month, data: { amount: "99.00" } }))).rejects.toThrow();
    await expect(withDatabaseTransaction(ownerId, randomUUID(), ({ client }) => client.balance_snapshot.deleteMany({ where: month }))).rejects.toThrow();
    await expect(withDatabaseTransaction(ownerId, randomUUID(), ({ client }) => client.monthly_expense_detail.updateMany({ where: month, data: { confirmed_amount: "99.00" } }))).rejects.toThrow();
    await withDatabaseTransaction(ownerId, randomUUID(), async ({ client }) => {
      expect((await client.balance_snapshot.findFirstOrThrow({ where: month })).amount.toFixed(2)).toBe("80.00");
      expect((await client.monthly_expense_detail.findFirstOrThrow({ where: month })).confirmed_amount.toFixed(2)).toBe("20.00");
    });
  });
  it("retries a complete transaction after a database deadlock", async () => {
    const first = randomUUID(), second = randomUUID();
    await identityPrisma.app_user.createMany({ data: [{ id: first }, { id: second }] });
    let arrivals = 0;
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const changeBoth = (own: string, other: string) => withClient(async client => {
      await lockOwner(client, own);
      arrivals++;
      if (arrivals === 2) release();
      await barrier;
      await client.app_user.update({ where: { id: other }, data: { date_of_birth: new Date("1990-01-01") } });
    });
    await Promise.all([changeBoth(first, second), changeBoth(second, first)]);
    expect(arrivals).toBe(3);
    expect((await identityPrisma.app_user.findUniqueOrThrow({ where: { id: first } })).date_of_birth?.toISOString()).toBe("1990-01-01T00:00:00.000Z");
    expect((await identityPrisma.app_user.findUniqueOrThrow({ where: { id: second } })).date_of_birth?.toISOString()).toBe("1990-01-01T00:00:00.000Z");
  });
  it("rolls back writes on failure and runs authenticated operations under the restricted role", async () => {
    const session = await withClient(client => loginLocal(client, `${randomUUID()}@example.com`));
    const request = new Request("http://localhost/api/profile", { headers: { cookie: `deledger_local_session=${session.token}` } });
    let owner = "";
    await expect(withUserTransaction(request, randomUUID(), { mode: "local" }, async ({ client, ownerId }) => {
      owner = ownerId;
      expect(await client.$queryRaw`SELECT current_user AS role`).toEqual([{ role: "deledger_web" }]);
      await client.app_user.update({ where: { id: ownerId }, data: { date_of_birth: new Date("2000-01-01") } });
      throw new Error("abort operation");
    })).rejects.toThrow("abort operation");
    expect((await identityPrisma.app_user.findUniqueOrThrow({ where: { id: owner } })).date_of_birth).toBeNull();
    expect(await prisma.app_user.findMany()).toEqual([]);
  });
});
