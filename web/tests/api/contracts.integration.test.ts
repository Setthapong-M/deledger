import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPool } from "@/test/postgres";
import { ownerA } from "@/test/factories";
import { createJwksTestServer, type JwksTestServer } from "@/test/jwks-server";
import { jsonRequest, responseJson } from "@/test/api-harness";
import { POST as onboarding } from "@/app/api/onboarding/route";
import { GET as bootstrap } from "@/app/api/bootstrap/route";
import { PUT as income } from "@/app/api/months/[month]/income/route";
import { DELETE as deleteDetail } from "@/app/api/months/[month]/details/[setupItemId]/route";

process.env.APP_ORIGIN = "http://deledger.internal";
process.env.BUSINESS_TIME_ZONE = "Asia/Bangkok";
process.env.DATABASE_URL = "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test";
process.env.CLOUDFLARE_ACCESS_AUD = "deledger-test-audience";

const admin = createTestPool();
let jwks: JwksTestServer;

async function token(email = "user@example.com"): Promise<string> {
  return jwks.sign("api", { email });
}

describe("JSON API contracts", () => {
  beforeAll(async () => {
    jwks = await createJwksTestServer();
    await jwks.addKey("api");
    process.env.CLOUDFLARE_TEAM_DOMAIN = jwks.url;
  });

  afterAll(async () => {
    await admin.end();
    await jwks.close();
  });

  it("returns lifecycle data through the success envelope and rejects missing identity", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await admin.query("INSERT INTO app_user (id) VALUES ($1)", [ownerA]);
    await admin.query("INSERT INTO user_identity_email (normalized_email, owner_id) VALUES ('user@example.com', $1)", [ownerA]);
    const response = await bootstrap(jsonRequest("http://deledger.internal/api/bootstrap", { token: await token() }));
    expect(response.status).toBe(200);
    expect(await responseJson(response)).toEqual({ data: { state: "onboarding_required", month: null } });
    const missing = await bootstrap(jsonRequest("http://deledger.internal/api/bootstrap"));
    expect(missing.status).toBe(401);
    expect((await responseJson<{ error: { code: string; current: unknown } }>(missing)).error).toMatchObject({ code: "ACCESS_TOKEN_MISSING", current: null });
  });

  it("enforces JSON, exact Origin and closed onboarding payloads", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await admin.query("INSERT INTO app_user (id) VALUES ($1)", [ownerA]);
    await admin.query("INSERT INTO user_identity_email (normalized_email, owner_id) VALUES ('user@example.com', $1)", [ownerA]);
    const wrongOrigin = await onboarding(jsonRequest("http://deledger.internal/api/onboarding", { method: "POST", token: await token(), origin: "http://evil.example", body: { openingBalance: "20000", income: "0" } }));
    expect(wrongOrigin.status).toBe(400);
    const unknownField = await onboarding(jsonRequest("http://deledger.internal/api/onboarding", { method: "POST", token: await token(), body: { openingBalance: "20000", income: "0", extra: true } }));
    expect(unknownField.status).toBe(400);
    const noJson = await onboarding(new Request("http://deledger.internal/api/onboarding", { method: "POST", headers: { origin: "http://deledger.internal", "Cf-Access-Jwt-Assertion": await token() }, body: "{}" }));
    expect(noJson.status).toBe(400);
  });

  it("returns a complete Month View and current view on stale writes", async () => {
    await admin.query("TRUNCATE monthly_expense_detail, monthly_recurring_expense, balance_snapshot, reporting_month, user_archive_period, user_identity_email, app_user CASCADE");
    await admin.query("INSERT INTO app_user (id) VALUES ($1)", [ownerA]);
    await admin.query("INSERT INTO user_identity_email (normalized_email, owner_id) VALUES ('user@example.com', $1)", [ownerA]);
    const created = await onboarding(jsonRequest("http://deledger.internal/api/onboarding", { method: "POST", token: await token(), body: { openingBalance: "20000", income: "30000" } }));
    expect(created.status).toBe(200);
    const createdBody = await responseJson<{ data: { month: string; revision: string } }>(created);
    expect(createdBody.data.revision).toBe("0");
    const month = createdBody.data.month;
    const updated = await income(jsonRequest(`http://deledger.internal/api/months/${month}/income`, { method: "PUT", token: await token(), body: { amount: "31000", expectedRevision: "0" } }), { params: Promise.resolve({ month }) });
    expect(updated.status).toBe(200);
    expect((await responseJson<{ data: { summary: { income: string }; revision: string } }>(updated)).data).toMatchObject({ revision: "1", summary: { income: "31000.00" } });
    const stale = await income(jsonRequest(`http://deledger.internal/api/months/${month}/income`, { method: "PUT", token: await token(), body: { amount: "32000", expectedRevision: "0" } }), { params: Promise.resolve({ month }) });
    expect(stale.status).toBe(409);
    expect((await responseJson<{ error: { code: string; current: { revision: string } } }>(stale)).error).toMatchObject({ code: "REVISION_CONFLICT", current: { revision: "1" } });
  });

  it("requires revision in the DELETE query and never accepts a body", async () => {
    const response = await deleteDetail(jsonRequest("http://deledger.internal/api/months/2026-08/details/00000000-0000-4000-8000-000000000001", { method: "DELETE", token: await token() }), { params: Promise.resolve({ month: "2026-08", setupItemId: "00000000-0000-4000-8000-000000000001" }) });
    expect(response.status).toBe(428);
    expect((await responseJson<{ error: { code: string } }>(response)).error.code).toBe("REVISION_REQUIRED");
  });
});
