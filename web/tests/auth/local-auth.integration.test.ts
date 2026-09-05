import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPool, webDatabaseUrl } from "@/test/postgres";
import { loginLocal } from "@/server/services/local-auth";
import { readProfile, updateProfile } from "@/server/services/profile";
import { digestLocalSessionToken, resolveLocalSession } from "@/server/auth/local";
import { POST as login } from "@/app/api/auth/login/route";
import { GET as bootstrap } from "@/app/api/bootstrap/route";
import { GET as profile } from "@/app/api/profile/route";
import { PATCH as patchProfile } from "@/app/api/profile/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { jsonRequest, responseJson } from "@/test/api-harness";

process.env.DELEDGER_ENV = "local";
process.env.APP_ORIGIN = "http://127.0.0.1:3000";
process.env.BUSINESS_TIME_ZONE = "Asia/Bangkok";
process.env.DATABASE_URL = webDatabaseUrl;

const admin = createTestPool();
const web = createTestPool(webDatabaseUrl);

async function clear(): Promise<void> {
  await admin.query("TRUNCATE local_session, monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_phone, user_identity_email, app_user CASCADE");
}

describe("local identity and profile", () => {
  beforeAll(clear);
  afterAll(async () => { await web.end(); await admin.end(); });

  it("creates one email User and reuses it for later local sessions", async () => {
    const firstClient = await web.connect();
    let first;
    try { first = await loginLocal(firstClient, " User@Example.com "); } finally { firstClient.release(); }
    const owner = (await admin.query<{ id: string }>("SELECT owner_id AS id FROM user_identity_email WHERE normalized_email = 'user@example.com'")).rows[0]!.id;
    const secondClient = await web.connect();
    try {
      const second = await loginLocal(secondClient, "user@example.com");
      expect(second.token).not.toBe(first.token);
      expect((await resolveLocalSession(secondClient, second.token)).ownerId).toBe(owner);
    } finally { secondClient.release(); }
    expect((await admin.query("SELECT count(*)::int AS count FROM app_user")).rows[0]?.count).toBe(1);
  });

  it("serializes concurrent first logins for one canonical identifier", async () => {
    await clear();
    const clients = await Promise.all([web.connect(), web.connect()]);
    try {
      const sessions = await Promise.all(clients.map((client) => loginLocal(client, "Race@Example.com")));
      const owners = await Promise.all(sessions.map((session, index) => resolveLocalSession(clients[index]!, session.token)));
      expect(new Set(owners.map((owner) => owner.ownerId)).size).toBe(1);
      expect((await admin.query("SELECT count(*)::int AS count FROM app_user")).rows[0]?.count).toBe(1);
    } finally {
      clients.forEach((client) => client.release());
    }
  });

  it("creates a phone-only User, normalizes both phone forms, and links an email", async () => {
    const firstClient = await web.connect();
    let first;
    try { first = await loginLocal(firstClient, "081 234 5678"); } finally { firstClient.release(); }
    const owner = (await admin.query<{ id: string }>("SELECT owner_id AS id FROM user_identity_phone WHERE normalized_phone = '+66812345678'")).rows[0]!.id;
    const secondClient = await web.connect();
    try { const second = await loginLocal(secondClient, "+66812345678"); expect(second.token).not.toBe(first.token); } finally { secondClient.release(); }
    const profileClient = await web.connect();
    try {
      await profileClient.query("BEGIN");
      await profileClient.query("SELECT set_config('deledger.user_id', $1, true)", [owner]);
      expect(await readProfile(profileClient, owner)).toMatchObject({ email: null, phone: "+66812345678", dateOfBirth: null });
      expect(await updateProfile(profileClient, owner, { email: "Phone.User@example.com", dateOfBirth: "1991-05-06" }, true)).toEqual({ email: "phone.user@example.com", phone: "+66812345678", dateOfBirth: "1991-05-06" });
      await profileClient.query("COMMIT");
    } finally { profileClient.release(); }
    const emailClient = await web.connect();
    try { const session = await loginLocal(emailClient, "phone.user@example.com"); expect((await resolveLocalSession(emailClient, session.token)).ownerId).toBe(owner); } finally { emailClient.release(); }
  });

  it("keeps contacts unique, rejects removing the last contact, and denies archived Users", async () => {
    await clear();
    const client = await web.connect();
    let session;
    try { session = await loginLocal(client, "one@example.com"); } finally { client.release(); }
    const owner = (await admin.query<{ id: string }>("SELECT owner_id AS id FROM user_identity_email WHERE normalized_email = 'one@example.com'")).rows[0]!.id;
    const otherClient = await web.connect();
    try { await loginLocal(otherClient, "two@example.com"); } finally { otherClient.release(); }
    const lastContactClient = await web.connect();
    try {
      await lastContactClient.query("BEGIN");
      await lastContactClient.query("SELECT set_config('deledger.user_id', $1, true)", [owner]);
      await expect(updateProfile(lastContactClient, owner, { email: null }, true)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await lastContactClient.query("ROLLBACK");
    } finally { lastContactClient.release(); }
    const duplicateClient = await web.connect();
    try {
      await duplicateClient.query("BEGIN");
      await duplicateClient.query("SELECT set_config('deledger.user_id', $1, true)", [owner]);
      await expect(updateProfile(duplicateClient, owner, { email: "two@example.com" }, true)).rejects.toMatchObject({ code: "PROFILE_CONFLICT" });
      await duplicateClient.query("ROLLBACK");
    } finally { duplicateClient.release(); }
    await admin.query("INSERT INTO user_archive_period (owner_id) VALUES ($1)", [owner]);
    const archivedClient = await web.connect();
    try { await expect(loginLocal(archivedClient, "one@example.com")).rejects.toMatchObject({ code: "USER_ARCHIVED" }); } finally { archivedClient.release(); }
    expect((await admin.query("SELECT count(*)::int AS count FROM local_session WHERE owner_id = $1", [owner])).rows[0]?.count).toBe(1);
    expect(session).toBeDefined();
  });

  it("does not allow a QAS-style profile update to change contacts", async () => {
    await clear();
    const client = await web.connect();
    let session;
    try { session = await loginLocal(client, "qas@example.com"); } finally { client.release(); }
    const owner = (await admin.query<{ id: string }>("SELECT owner_id AS id FROM user_identity_email WHERE normalized_email = 'qas@example.com'")).rows[0]!.id;
    const updateClient = await web.connect();
    try {
      await updateClient.query("BEGIN");
      await updateClient.query("SELECT set_config('deledger.user_id', $1, true)", [owner]);
      await expect(updateProfile(updateClient, owner, { phone: "0812345678" }, false)).rejects.toMatchObject({ code: "PROFILE_CONTACT_READ_ONLY" });
      await updateClient.query("ROLLBACK");
    } finally { updateClient.release(); }
    expect(session).toBeDefined();
  });

  it("authenticates the local HTTP boundary with a cookie and keeps the protected API owner-scoped", async () => {
    await clear();
    const loggedIn = await login(jsonRequest("http://127.0.0.1:3000/api/auth/login", { method: "POST", origin: "http://127.0.0.1:3000", body: { identifier: "http-user@example.com" } }));
    expect(loggedIn.status).toBe(200);
    const cookie = loggedIn.headers.get("set-cookie");
    expect(cookie).toMatch(/^deledger_local_session=[A-Za-z0-9_-]{43};/);
    const cookieValue = cookie!.split(";", 1)[0]!;
    const first = await bootstrap(new Request("http://127.0.0.1:3000/api/bootstrap", { headers: { cookie: cookieValue } }));
    expect(first.status).toBe(200);
    expect(await responseJson(first)).toEqual({ data: { state: "onboarding_required", month: null } });
    const ownProfile = await profile(new Request("http://127.0.0.1:3000/api/profile", { headers: { cookie: cookieValue } }));
    expect(ownProfile.status).toBe(200);
    expect((await responseJson<{ data: { email: string } }>(ownProfile)).data.email).toBe("http-user@example.com");
    const changed = await patchProfile(new Request("http://127.0.0.1:3000/api/profile", { method: "PATCH", headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json", cookie: cookieValue }, body: JSON.stringify({ phone: "0812345678", dateOfBirth: "1990-01-02" }) }));
    expect(changed.status).toBe(200);
    expect((await responseJson<{ data: { phone: string; dateOfBirth: string } }>(changed)).data).toMatchObject({ phone: "+66812345678", dateOfBirth: "1990-01-02" });
    const loggedOut = await logout(new Request("http://127.0.0.1:3000/api/auth/logout", { method: "POST", headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json", cookie: cookieValue }, body: "{}" }));
    expect(loggedOut.status).toBe(200);
    const denied = await bootstrap(new Request("http://127.0.0.1:3000/api/bootstrap", { headers: { cookie: cookieValue } }));
    expect(denied.status).toBe(401);
  });

  it("rejects expired and tampered cookies without exposing a User", async () => {
    await clear();
    const owner = "00000000-0000-4000-8000-000000000011";
    const expiredToken = "A".repeat(43);
    await admin.query("INSERT INTO app_user (id) VALUES ($1)", [owner]);
    await admin.query("INSERT INTO user_identity_email (normalized_email, owner_id) VALUES ('expired@example.com', $1)", [owner]);
    await admin.query("INSERT INTO local_session (token_digest, owner_id, issued_at, expires_at) VALUES ($1, $2, clock_timestamp() - interval '2 days', clock_timestamp() - interval '1 day')", [digestLocalSessionToken(expiredToken), owner]);
    const expired = await bootstrap(new Request("http://127.0.0.1:3000/api/bootstrap", { headers: { cookie: `deledger_local_session=${expiredToken}` } }));
    expect(expired.status).toBe(401);
    expect((await responseJson<{ error: { code: string } }>(expired)).error.code).toBe("SESSION_INVALID");
    const tampered = await bootstrap(new Request("http://127.0.0.1:3000/api/bootstrap", { headers: { cookie: `deledger_local_session=${"B".repeat(43)}` } }));
    expect(tampered.status).toBe(401);
    expect((await responseJson<{ error: { code: string } }>(tampered)).error.code).toBe("SESSION_INVALID");
  });

  it("switches local Users without crossing profile data", async () => {
    await clear();
    const first = await login(jsonRequest("http://127.0.0.1:3000/api/auth/login", { method: "POST", origin: "http://127.0.0.1:3000", body: { identifier: "switch-a@example.com" } }));
    const second = await login(jsonRequest("http://127.0.0.1:3000/api/auth/login", { method: "POST", origin: "http://127.0.0.1:3000", body: { identifier: "switch-b@example.com" } }));
    const firstCookie = first.headers.get("set-cookie")!.split(";", 1)[0]!;
    const secondCookie = second.headers.get("set-cookie")!.split(";", 1)[0]!;
    expect((await responseJson<{ data: { email: string } }>(await profile(new Request("http://127.0.0.1:3000/api/profile", { headers: { cookie: firstCookie } })))).data.email).toBe("switch-a@example.com");
    expect((await responseJson<{ data: { email: string } }>(await profile(new Request("http://127.0.0.1:3000/api/profile", { headers: { cookie: secondCookie } })))).data.email).toBe("switch-b@example.com");
    const loggedOut = await logout(new Request("http://127.0.0.1:3000/api/auth/logout", { method: "POST", headers: { origin: "http://127.0.0.1:3000", "content-type": "application/json", cookie: firstCookie }, body: "{}" }));
    expect(loggedOut.status).toBe(200);
    const firstAgain = await login(jsonRequest("http://127.0.0.1:3000/api/auth/login", { method: "POST", origin: "http://127.0.0.1:3000", body: { identifier: "switch-a@example.com" } }));
    expect(firstAgain.status).toBe(200);
    expect((await admin.query("SELECT count(*)::int AS count FROM app_user")).rows[0]?.count).toBe(2);
  });

  it("keeps profile reads owner-scoped and serializes concurrent contact linking", async () => {
    await clear();
    const firstClient = await web.connect();
    const secondClient = await web.connect();
    let firstOwner: string;
    let secondOwner: string;
    try {
      await loginLocal(firstClient, "profile-a@example.com");
      await loginLocal(secondClient, "profile-b@example.com");
      firstOwner = (await admin.query<{ owner_id: string }>("SELECT owner_id FROM user_identity_email WHERE normalized_email = 'profile-a@example.com'")).rows[0]!.owner_id;
      secondOwner = (await admin.query<{ owner_id: string }>("SELECT owner_id FROM user_identity_email WHERE normalized_email = 'profile-b@example.com'")).rows[0]!.owner_id;
    } finally {
      firstClient.release();
      secondClient.release();
    }

    const isolatedClient = await web.connect();
    try {
      await isolatedClient.query("BEGIN");
      await isolatedClient.query("SELECT set_config('deledger.user_id', $1, true)", [firstOwner!]);
      await expect(readProfile(isolatedClient, secondOwner!)).rejects.toMatchObject({ code: "USER_NOT_INVITED" });
      await isolatedClient.query("ROLLBACK");
    } finally { isolatedClient.release(); }

    const clients = await Promise.all([web.connect(), web.connect()]);
    const owners = [firstOwner!, secondOwner!];
    const outcomes = await Promise.allSettled(clients.map(async (client, index) => {
      await client.query("BEGIN");
      await client.query("SELECT set_config('deledger.user_id', $1, true)", [owners[index]]);
      try {
        const result = await updateProfile(client, owners[index]!, { phone: "0812345678" }, true);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    }));
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === "rejected")).toHaveLength(1);
    expect((outcomes.find((outcome) => outcome.status === "rejected") as PromiseRejectedResult).reason).toMatchObject({ code: "PROFILE_CONFLICT", field: "phone" });
    expect((await admin.query("SELECT count(*)::int AS count FROM user_identity_phone WHERE normalized_phone = '+66812345678'")).rows[0]?.count).toBe(1);
  });

  it("rejects impossible and future birthdays before writing the profile", async () => {
    await clear();
    const client = await web.connect();
    let owner: string;
    try { await loginLocal(client, "birthday@example.com"); } finally { client.release(); }
    owner = (await admin.query<{ owner_id: string }>("SELECT owner_id FROM user_identity_email WHERE normalized_email = 'birthday@example.com'")).rows[0]!.owner_id;
    const profileClient = await web.connect();
    try {
      await profileClient.query("BEGIN");
      await profileClient.query("SELECT set_config('deledger.user_id', $1, true)", [owner]);
      await expect(updateProfile(profileClient, owner, { dateOfBirth: "1990-02-30" }, true)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      await expect(updateProfile(profileClient, owner, { dateOfBirth: "2099-01-01" }, true)).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(await readProfile(profileClient, owner)).toMatchObject({ dateOfBirth: null });
      await profileClient.query("ROLLBACK");
    } finally { profileClient.release(); }
  });

  it("does not let a local cookie bypass QAS Cloudflare authentication", async () => {
    const previous = {
      DELEDGER_ENV: process.env.DELEDGER_ENV,
      APP_ORIGIN: process.env.APP_ORIGIN,
      CLOUDFLARE_TEAM_DOMAIN: process.env.CLOUDFLARE_TEAM_DOMAIN,
      CLOUDFLARE_ACCESS_AUD: process.env.CLOUDFLARE_ACCESS_AUD,
    };
    process.env.DELEDGER_ENV = "qas";
    process.env.APP_ORIGIN = "http://deledger.internal";
    process.env.CLOUDFLARE_TEAM_DOMAIN = "https://team.cloudflareaccess.com";
    process.env.CLOUDFLARE_ACCESS_AUD = "test-only";
    try {
      const denied = await bootstrap(new Request("http://deledger.internal/api/bootstrap", { headers: { cookie: "deledger_local_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA" } }));
      expect(denied.status).toBe(401);
      expect((await responseJson<{ error: { code: string } }>(denied)).error.code).toBe("ACCESS_TOKEN_MISSING");
    } finally {
      for (const [key, value] of Object.entries(previous)) {
        if (value === undefined) delete process.env[key];
        else process.env[key] = value;
      }
    }
  });
});
