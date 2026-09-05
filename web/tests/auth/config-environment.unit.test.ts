import { describe, expect, it } from "vitest";
import { loadConfig } from "@/server/config";

const common = {
  BUSINESS_TIME_ZONE: "Asia/Bangkok",
  DATABASE_URL: "postgresql://deledger_web:secret@127.0.0.1:55433/deledger_local",
};

describe("application environment configuration", () => {
  it("accepts local configuration without Cloudflare settings", () => {
    expect(loadConfig({ ...common, DELEDGER_ENV: "local", APP_ORIGIN: "http://127.0.0.1:3000" })).toMatchObject({ environment: "local", APP_ORIGIN: "http://127.0.0.1:3000" });
  });

  it("requires Cloudflare settings for QAS and rejects unsupported prod", () => {
    expect(() => loadConfig({ ...common, DELEDGER_ENV: "qas", APP_ORIGIN: "http://deledger.internal" })).toThrow(/CLOUDFLARE/);
    expect(() => loadConfig({ ...common, DELEDGER_ENV: "prod", APP_ORIGIN: "https://deledger.example.com", CLOUDFLARE_TEAM_DOMAIN: "https://team.cloudflareaccess.com", CLOUDFLARE_ACCESS_AUD: "aud" })).toThrow(/prod|unsupported/i);
  });

  it("rejects local configuration that points outside its loopback database", () => {
    expect(() => loadConfig({ ...common, DELEDGER_ENV: "local", DATABASE_URL: "postgresql://web:secret@postgres:5432/deledger", APP_ORIGIN: "http://127.0.0.1:3000" })).toThrow(/local|loopback|deledger_local/i);
    expect(() => loadConfig({ ...common, DELEDGER_ENV: "local", DATABASE_URL: "postgresql://web:secret@127.0.0.1:55433/deledger", APP_ORIGIN: "http://127.0.0.1:3000" })).toThrow(/local|loopback|deledger_local/i);
    expect(() => loadConfig({ ...common, DELEDGER_ENV: "local", DATABASE_URL: "postgresql://postgres:secret@127.0.0.1:55433/deledger_local", APP_ORIGIN: "http://127.0.0.1:3000" })).toThrow(/deledger_web|role/i);
  });
});
