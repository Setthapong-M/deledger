import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "@/server/config";
import { verifyAccessJwt, resetAccessJwksCache } from "@/server/auth/access-jwt";
import { createJwksTestServer, type JwksTestServer } from "@/test/jwks-server";

let jwks: JwksTestServer;

function request(token?: string): Request {
  return new Request("http://deledger.internal/api/bootstrap", token ? { headers: { "Cf-Access-Jwt-Assertion": token } } : undefined);
}

describe("Cloudflare Access JWT boundary", () => {
  beforeAll(async () => {
    jwks = await createJwksTestServer();
    await jwks.addKey("first");
  });

  afterAll(async () => {
    resetAccessJwksCache();
    await jwks.close();
  });

  it("fails closed for absent and malformed assertions", async () => {
    await expect(verifyAccessJwt(request(), { teamDomain: jwks.url, audience: "deledger-test-audience" })).rejects.toThrow("ACCESS_TOKEN_MISSING");
    await expect(verifyAccessJwt(request("not-a-jwt"), { teamDomain: jwks.url, audience: "deledger-test-audience" })).rejects.toThrow("ACCESS_TOKEN_INVALID");
  });

  it("accepts a verified RS256 Access application token and normalizes email", async () => {
    const token = await jwks.sign("first");
    const identity = await verifyAccessJwt(request(token), { teamDomain: jwks.url, audience: "deledger-test-audience" });
    expect(identity.email).toBe("user@example.com");
    expect(identity.subject).toBe("subject-1");
  });

  it("rejects issuer, audience, expiry, not-before and token type changes", async () => {
    const valid = await jwks.sign("first");
    await expect(verifyAccessJwt(request(valid), { teamDomain: jwks.url, audience: "wrong" })).rejects.toThrow("ACCESS_TOKEN_INVALID");
    await expect(verifyAccessJwt(request(await jwks.sign("first", { iss: "https://wrong.example" })), { teamDomain: jwks.url, audience: "deledger-test-audience" })).rejects.toThrow("ACCESS_TOKEN_INVALID");
    await expect(verifyAccessJwt(request(await jwks.sign("first", { exp: Math.floor(Date.now() / 1000) - 1 })), { teamDomain: jwks.url, audience: "deledger-test-audience" })).rejects.toThrow("ACCESS_TOKEN_INVALID");
    await expect(verifyAccessJwt(request(await jwks.sign("first", { nbf: Math.floor(Date.now() / 1000) + 120 })), { teamDomain: jwks.url, audience: "deledger-test-audience" })).rejects.toThrow("ACCESS_TOKEN_INVALID");
    await expect(verifyAccessJwt(request(await jwks.sign("first", { type: "service" })), { teamDomain: jwks.url, audience: "deledger-test-audience" })).rejects.toThrow("ACCESS_TOKEN_INVALID");
  });

  it("refreshes JWKS once when an unknown key id appears", async () => {
    resetAccessJwksCache();
    const before = jwks.requestCount();
    const token = await jwks.sign("first");
    await verifyAccessJwt(request(token), { teamDomain: jwks.url, audience: "deledger-test-audience" });
    await jwks.addKey("second");
    const unknownKeyToken = await jwks.sign("second");
    await expect(verifyAccessJwt(request(unknownKeyToken), { teamDomain: jwks.url, audience: "deledger-test-audience" })).resolves.toMatchObject({ email: "user@example.com" });
    expect(jwks.requestCount() - before).toBeGreaterThanOrEqual(2);
  });

  it("validates production and loopback configuration without exposing values", () => {
    expect(loadConfig({
      APP_ORIGIN: "http://deledger.internal",
      BUSINESS_TIME_ZONE: "Asia/Bangkok",
      DATABASE_URL: "postgresql://web:secret@example:5432/deledger",
      CLOUDFLARE_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
      CLOUDFLARE_ACCESS_AUD: "aud",
    })).toMatchObject({ APP_ORIGIN: "http://deledger.internal" });
    expect(() => loadConfig({
      APP_ORIGIN: "https://evil.example",
      BUSINESS_TIME_ZONE: "Asia/Bangkok",
      DATABASE_URL: "postgresql://web:secret@example:5432/deledger",
      CLOUDFLARE_TEAM_DOMAIN: "http://team.example",
      CLOUDFLARE_ACCESS_AUD: "aud",
    })).toThrow(/APP_ORIGIN|CLOUDFLARE_TEAM_DOMAIN/);
    expect(() => loadConfig({})).toThrow(/APP_ORIGIN|BUSINESS_TIME_ZONE|DATABASE_URL/);
  });
});
