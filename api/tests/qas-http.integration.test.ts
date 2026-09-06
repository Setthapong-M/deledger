import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApplication } from "../src/app.js";
import { archive, invite } from "../src/operator.js";
import { disconnectDatabase, identityPrisma } from "../src/server/db/pool.js";
import { withClient, withUserTransaction } from "../src/server/db/transaction.js";
import { digestLocalSessionToken, revokeLocalSession } from "../src/server/auth/local.js";
import { updateProfile } from "../src/server/services/profile.js";
import { lockOwner } from "../src/server/db/rls.js";
import { loginLocal } from "../src/server/services/local-auth.js";
import { resetAccessJwksCache } from "../src/server/auth/access-jwt.js";
import { createJwksTestServer, type JwksTestServer } from "./support/jwks-server.js";

const savedEnvironment = { ...process.env };
let app: Awaited<ReturnType<typeof createApplication>>;
let jwks: JwksTestServer;
let origin: string;
beforeAll(async () => {
  await disconnectDatabase();
  jwks = await createJwksTestServer();
  await jwks.addKey("qas-integration");
  Object.assign(process.env, {
    NODE_ENV: "test", DELEDGER_ENV: "qas", APP_ORIGIN: "http://deledger.internal", BUSINESS_TIME_ZONE: "Asia/Bangkok",
    DATABASE_URL: "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test",
    IDENTITY_DATABASE_URL: "postgresql://deledger_identity:test-identity-password@127.0.0.1:55432/deledger_test",
    CLOUDFLARE_TEAM_DOMAIN: jwks.url, CLOUDFLARE_ACCESS_AUD: "deledger-test-audience",
  });
  app = await createApplication();
  await app.listen(0, "127.0.0.1");
  origin = await app.getUrl();
});
afterAll(async () => {
  await app?.close();
  await jwks?.close();
  await disconnectDatabase();
  resetAccessJwksCache();
  for (const key of Object.keys(process.env)) if (!(key in savedEnvironment)) delete process.env[key];
  Object.assign(process.env, savedEnvironment);
});
async function send(path: string, token?: string, method = "GET", body?: unknown, extra: Record<string, string> = {}) {
  return fetch(`${origin}/api${path}`, { method, headers: {
    origin: "http://deledger.internal", ...(token ? { "Cf-Access-Jwt-Assertion": token } : {}),
    ...(body === undefined ? {} : { "content-type": "application/json" }), ...extra,
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function invited() {
  const email = `${randomUUID()}@example.com`;
  const ownerId = await invite(email);
  const token = await jwks.sign("qas-integration", { email });
  return { email, ownerId, token };
}

describe("QAS authentication through real Nest HTTP", () => {
  it("accepts invited signed identity and ignores forged owner headers", async () => {
    const first = await invited(), second = await invited();
    const response = await send("/profile", first.token, "GET", undefined, { "x-user-id": second.ownerId, "x-owner-id": second.ownerId, "cf-access-authenticated-user-email": second.email });
    expect(response.status).toBe(200);
    expect((await response.json()).data.email).toBe(first.email);
    expect(jwks.requestCount()).toBeGreaterThan(0);
  });
  it("requires Access even with a valid local session and disables local login", async () => {
    const session = await withClient(client => loginLocal(client, `${randomUUID()}@example.com`));
    const response = await send("/profile", undefined, "GET", undefined, { cookie: `deledger_local_session=${session.token}` });
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("ACCESS_TOKEN_MISSING");
    const disabled = await send("/auth/login", undefined, "POST", { identifier: `${randomUUID()}@example.com` });
    expect(disabled.status).toBe(403);
    expect((await disabled.json()).error.code).toBe("LOCAL_AUTH_DISABLED");
  });
  it("rejects uninvited and archived identities", async () => {
    const token = await jwks.sign("qas-integration", { email: `${randomUUID()}@example.com` });
    const missing = await send("/profile", token);
    expect(missing.status).toBe(403);
    expect((await missing.json()).error.code).toBe("USER_NOT_INVITED");
    const user = await invited();
    await archive(user.ownerId);
    const suspended = await send("/profile", user.token);
    expect(suspended.status).toBe(403);
    expect((await suspended.json()).error.code).toBe("USER_ARCHIVED");
  });
  it("keeps contacts read-only while permitting birthday changes", async () => {
    const user = await invited();
    const contacts = await send("/profile", user.token, "PATCH", { email: `${randomUUID()}@example.com` });
    expect(contacts.status).toBe(403);
    expect((await contacts.json()).error.code).toBe("PROFILE_CONTACT_READ_ONLY");
    const birthday = await send("/profile", user.token, "PATCH", { dateOfBirth: "1990-02-28" });
    expect(birthday.status).toBe(200);
    expect((await birthday.json()).data).toEqual({ email: user.email, phone: null, dateOfBirth: "1990-02-28" });
  });
  it("rejects expired, wrong-audience, wrong-type and tampered JWTs", async () => {
    const user = await invited();
    const tokens = [
      await jwks.sign("qas-integration", { email: user.email, exp: Math.floor(Date.now() / 1000) - 60 }),
      await jwks.sign("qas-integration", { email: user.email, aud: "different-application" }),
      await jwks.sign("qas-integration", { email: user.email, type: "service" }),
      `${user.token.slice(0, -20)}${"A".repeat(20)}`,
    ];
    for (const token of tokens) {
      const response = await send("/profile", token);
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("ACCESS_TOKEN_INVALID");
    }
  });
});


it("rejects expired and tampered local sessions and links Thai phone to the same User", async () => {
  const email = `${randomUUID()}@example.com`;
  const session = await withClient(client => loginLocal(client, email));
  const request = (token: string) => new Request("http://localhost/api/profile", { headers: { cookie: `deledger_local_session=${token}` } });
  const phone = `08${String(BigInt(`0x${randomUUID().replaceAll("-", "")}`) % 100000000n).padStart(8, "0")}`;
  const original = await withUserTransaction(request(session.token), randomUUID(), { mode: "local" }, async ({ client, ownerId }) => {
    await updateProfile(client, ownerId, { phone }, true);
    return ownerId;
  });
  const phoneSession = await withClient(client => loginLocal(client, phone));
  expect(await withUserTransaction(request(phoneSession.token), randomUUID(), { mode: "local" }, async ({ ownerId }) => ownerId)).toBe(original);
  await expect(withUserTransaction(request("A".repeat(43)), randomUUID(), { mode: "local" }, async () => undefined)).rejects.toMatchObject({ code: "SESSION_INVALID" });
  await identityPrisma.local_session.update({ where: { token_digest: digestLocalSessionToken(session.token) }, data: { issued_at: new Date(Date.now() - 120000), expires_at: new Date(Date.now() - 60000) } });
  await expect(withUserTransaction(request(session.token), randomUUID(), { mode: "local" }, async () => undefined)).rejects.toMatchObject({ code: "SESSION_INVALID" });
});

it("rechecks local contact after waiting for a concurrent profile replacement", async () => {
  const email = `${randomUUID()}@example.com`;
  const session = await withClient(client => loginLocal(client, email));
  const ownerId = (await identityPrisma.local_session.findUniqueOrThrow({ where: { token_digest: digestLocalSessionToken(session.token) } })).owner_id;
  let attempted!: Promise<unknown>;
  await withClient(async client => {
    await lockOwner(client, ownerId);
    attempted = withClient(tx => loginLocal(tx, email));
    void attempted.catch(() => undefined);
    await waitForOwnerLock();
    await updateProfile(client, ownerId, { email: `${randomUUID()}@example.com` }, true);
  });
  await expect(attempted).rejects.toMatchObject({ code: "IDENTITY_CONFLICT" });
});

async function waitForOwnerLock(): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt++) {
    const rows = await identityPrisma.$queryRaw<Array<{ waiting: boolean }>>`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE usename = current_user AND wait_event_type = 'Lock' AND query LIKE '%SELECT id FROM public.app_user%') AS waiting`;
    if (rows[0]?.waiting) return;
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  throw new Error("authenticated transaction did not wait on User lock");
}

it.each(["archive", "logout"] as const)("revalidates a waiting request after concurrent %s", async action => {
  const session = await withClient(client => loginLocal(client, `${randomUUID()}@example.com`));
  const ownerId = (await identityPrisma.local_session.findUniqueOrThrow({ where: { token_digest: digestLocalSessionToken(session.token) } })).owner_id;
  const request = new Request("http://localhost/api/profile", { headers: { cookie: `deledger_local_session=${session.token}` } });
  let attempted!: Promise<unknown>;
  let operationRan = false;
  await withClient(async client => {
    await lockOwner(client, ownerId);
    attempted = withUserTransaction(request, randomUUID(), { mode: "local" }, async () => { operationRan = true; });
    void attempted.catch(() => undefined);
    await waitForOwnerLock();
    if (action === "archive") await client.user_archive_period.create({ data: { owner_id: ownerId } });
    else await revokeLocalSession(client, session.token);
  });
  await expect(attempted).rejects.toMatchObject({ code: action === "archive" ? "USER_ARCHIVED" : "SESSION_INVALID" });
  expect(operationRan).toBe(false);
});
