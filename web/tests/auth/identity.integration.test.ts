import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPool } from "@/test/postgres";
import { ownerA } from "@/test/factories";
import { DomainError } from "@/server/domain/errors";
import { createJwksTestServer, type JwksTestServer } from "@/test/jwks-server";

process.env.APP_ORIGIN = "http://deledger.internal";
process.env.BUSINESS_TIME_ZONE = "Asia/Bangkok";
process.env.DATABASE_URL = "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test";
process.env.CLOUDFLARE_TEAM_DOMAIN = "https://team.cloudflareaccess.com";
process.env.CLOUDFLARE_ACCESS_AUD = "deledger-test-audience";

const admin = createTestPool();
let jwks: JwksTestServer;
let withUserTransaction: typeof import("@/server/db/transaction").withUserTransaction;
let withClient: typeof import("@/server/db/transaction").withClient;

function tokenRequest(token: string): Request {
  return new Request("http://deledger.internal/api/bootstrap", { headers: { "Cf-Access-Jwt-Assertion": token } });
}

describe("identity transaction binding", () => {
  beforeAll(async () => {
    jwks = await createJwksTestServer();
    await jwks.addKey("identity");
    ({ withUserTransaction, withClient } = await import("@/server/db/transaction"));
  });

  afterAll(async () => {
    await admin.end();
    await jwks.close();
  });

  it("resolves the invited email, binds RLS and clears it when the client is reused", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await admin.query("INSERT INTO app_user (id) VALUES ($1)", [ownerA]);
    await admin.query("INSERT INTO user_identity_email (normalized_email, owner_id) VALUES ('user@example.com', $1)", [ownerA]);
    const token = await jwks.sign("identity");
    const observed = await withUserTransaction(tokenRequest(token), "req-identity", { teamDomain: jwks.url, audience: "deledger-test-audience" }, async ({ client, ownerId }) => {
      const current = await client.query<{ owner: string | null }>("SELECT current_setting('deledger.user_id', true) AS owner");
      expect(current.rows[0]?.owner).toBe(ownerA);
      return ownerId;
    });
    expect(observed).toBe(ownerA);
    await withClient(async (client) => {
      const current = await client.query<{ owner: string }>("SELECT current_setting('deledger.user_id', true) AS owner");
      expect(current.rows[0]?.owner).toBe("");
    });
  });

  it("rejects a valid token for an archived or unknown invited identity before reading finance rows", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await admin.query("INSERT INTO app_user (id) VALUES ($1)", [ownerA]);
    await admin.query("INSERT INTO user_identity_email (normalized_email, owner_id) VALUES ('user@example.com', $1)", [ownerA]);
    await admin.query("INSERT INTO user_archive_period (owner_id) VALUES ($1)", [ownerA]);
    const token = await jwks.sign("identity");
    await expect(withUserTransaction(tokenRequest(token), "req-archived", { teamDomain: jwks.url, audience: "deledger-test-audience" }, async () => "unreachable")).rejects.toMatchObject({ code: "USER_ARCHIVED" });

    const unknownToken = await jwks.sign("identity", { email: "unknown@example.com" });
    await expect(withUserTransaction(tokenRequest(unknownToken), "req-unknown", { teamDomain: jwks.url, audience: "deledger-test-audience" }, async () => "unreachable")).rejects.toSatisfy((error: unknown) => error instanceof DomainError && error.code === "USER_NOT_INVITED");
  });

  it("rolls back callback failures and leaves no transaction-local owner", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await admin.query("INSERT INTO app_user (id) VALUES ($1)", [ownerA]);
    await admin.query("INSERT INTO user_identity_email (normalized_email, owner_id) VALUES ('user@example.com', $1)", [ownerA]);
    const token = await jwks.sign("identity");
    await expect(withUserTransaction(tokenRequest(token), "req-failure", { teamDomain: jwks.url, audience: "deledger-test-audience" }, async () => {
      throw new Error("callback failure");
    })).rejects.toThrow("callback failure");
    await withClient(async (client) => {
      const current = await client.query<{ owner: string }>("SELECT current_setting('deledger.user_id', true) AS owner");
      expect(current.rows[0]?.owner).toBe("");
    });
  });
});
