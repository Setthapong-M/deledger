import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { loginLocal, loginLocalWithTransaction } from "../src/server/services/local-auth.js";
import { readProfile, updateProfile } from "../src/server/services/profile.js";
import { withClient, withUserTransaction } from "../src/server/db/transaction.js";
import { disconnectDatabase, identityPrisma } from "../src/server/db/pool.js";
import { revokeLocalSession } from "../src/server/auth/local.js";

import { setBusinessClock } from "../src/server/domain/clock.js";
afterEach(() => setBusinessClock(() => new Date()));

const enabled = Boolean(process.env.DATABASE_URL && process.env.IDENTITY_DATABASE_URL);
afterAll(disconnectDatabase);
const request = (token: string) => new Request("http://localhost/api/profile", { headers: { cookie: `deledger_local_session=${token}` } });
const profile = (token: string) => withUserTransaction(request(token), randomUUID(), { mode: "local" }, ({ client, ownerId }) => readProfile(client, ownerId));

describe.skipIf(!enabled)("local identity through authenticated transactions", () => {
  it("replaces the same contact kind and reserves the old contact without losing the login session", async () => {
    const oldEmail = `${randomUUID()}@example.com`;
    const newEmail = `${randomUUID()}@example.com`;
    const session = await withClient(client => loginLocal(client, oldEmail));
    const result = await withUserTransaction(request(session.token), randomUUID(), { mode: "local" }, ({ client, ownerId }) => updateProfile(client, ownerId, { email: newEmail }, true));
    expect(result.email).toBe(newEmail);
    expect((await profile(session.token)).email).toBe(newEmail);
    await expect(withClient(client => loginLocal(client, oldEmail))).rejects.toMatchObject({ code: "IDENTITY_CONFLICT" });
    const returning = await withClient(client => loginLocal(client, newEmail));
    expect((await profile(returning.token)).email).toBe(newEmail);
  });
  it("rolls back a contact replacement conflict and rejects removal of the final contact", async () => {
    const email = `${randomUUID()}@example.com`;
    const reserved = `${randomUUID()}@example.com`;
    const session = await withClient(client => loginLocal(client, email));
    await withClient(client => loginLocal(client, reserved));
    await expect(withUserTransaction(request(session.token), randomUUID(), { mode: "local" }, ({ client, ownerId }) => updateProfile(client, ownerId, { email: reserved }, true))).rejects.toMatchObject({ code: "PROFILE_CONFLICT" });
    expect((await profile(session.token)).email).toBe(email);
    await expect(withUserTransaction(request(session.token), randomUUID(), { mode: "local" }, ({ client, ownerId }) => updateProfile(client, ownerId, { email: null }, true))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    expect((await profile(session.token)).email).toBe(email);
  });
  it("allows only one User to claim a contact concurrently and preserves the losing profile", async () => {
    const emails = [`${randomUUID()}@example.com`, `${randomUUID()}@example.com`];
    const sessions = await Promise.all(emails.map(email => withClient(client => loginLocal(client, email))));
    const claimed = `${randomUUID()}@example.com`;
    const changes = await Promise.allSettled(sessions.map(session => withUserTransaction(request(session.token), randomUUID(), { mode: "local" }, ({ client, ownerId }) => updateProfile(client, ownerId, { email: claimed }, true))));
    expect(changes.filter(change => change.status === "fulfilled")).toHaveLength(1);
    const losing = changes.findIndex(change => change.status === "rejected");
    expect(changes[losing]).toMatchObject({ status: "rejected", reason: { code: "PROFILE_CONFLICT" } });
    expect((await profile(sessions[losing]!.token)).email).toBe(emails[losing]);
  });
  it("reuses a contact claimed by a profile while local login is starting", async () => {
    const session = await withClient(client => loginLocal(client, `${randomUUID()}@example.com`));
    const claimed = `${randomUUID()}@example.com`;
    let login!: ReturnType<typeof loginLocal>;
    let owner = "";
    await withUserTransaction(request(session.token), randomUUID(), { mode: "local" }, async ({ client, ownerId }) => {
      owner = ownerId;
      await updateProfile(client, ownerId, { email: claimed }, true);
      login = loginLocalWithTransaction(claimed);
      void login.catch(() => undefined);
      let waiting = false;
      for (let attempt = 0; attempt < 100; attempt++) {
        const rows = await identityPrisma.$queryRaw<Array<{ waiting: boolean }>>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE usename = current_user AND wait_event_type = 'Lock') AS waiting`;
        if (rows[0]?.waiting) { waiting = true; break; }
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
    });
    const returning = await login;
    expect(await withUserTransaction(request(returning.token), randomUUID(), { mode: "local" }, async ({ ownerId }) => ownerId)).toBe(owner);
  });
  it("validates birth dates against the Bangkok business clock", async () => {
    const session = await withClient(client => loginLocal(client, `${randomUUID()}@example.com`));
    setBusinessClock(() => new Date("2000-12-31T16:59:59Z"));
    await expect(withUserTransaction(request(session.token), randomUUID(), { mode: "local" }, ({ client, ownerId }) => updateProfile(client, ownerId, { dateOfBirth: "2001-01-01" }, true))).rejects.toMatchObject({ code: "INVALID_INPUT" });
    setBusinessClock(() => new Date("2000-12-31T17:00:00Z"));
    const updated = await withUserTransaction(request(session.token), randomUUID(), { mode: "local" }, ({ client, ownerId }) => updateProfile(client, ownerId, { dateOfBirth: "2001-01-01" }, true));
    expect(updated.dateOfBirth).toBe("2001-01-01");
  });
  it("serializes simultaneous login for one identifier and invalidates revoked sessions", async () => {
    const email = `${randomUUID()}@example.com`;
    const sessions = await Promise.all([withClient(client => loginLocal(client, email)), withClient(client => loginLocal(client, email))]);
    const ids = await Promise.all(sessions.map(session => withUserTransaction(request(session.token), randomUUID(), { mode: "local" }, async ({ ownerId }) => ownerId)));
    expect(ids[0]).toBe(ids[1]);
    await withClient(client => revokeLocalSession(client, sessions[0]!.token));
    await expect(profile(sessions[0]!.token)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  });
});
