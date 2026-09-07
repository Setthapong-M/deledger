import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/server/config.js";

const common = {
  IDENTITY_DATABASE_URL: "postgresql://deledger_identity:secret@127.0.0.1:55433/deledger_local",
  BUSINESS_TIME_ZONE: "Asia/Bangkok",
  DATABASE_URL: "postgresql://deledger_web:secret@127.0.0.1:55433/deledger_local",
};

describe("application environment configuration", () => {
  it.each([undefined, "deledger_local", "deledger_local_v2"])("accepts selected local database %s", name => {
    const database = name ?? "deledger_local";
    expect(loadConfig({ ...common, DELEDGER_ENV: "local", APP_ORIGIN: "http://127.0.0.1:3000", LOCAL_DATABASE_NAME: name,
      DATABASE_URL: `postgresql://deledger_web:secret@127.0.0.1:55433/${database}`,
      IDENTITY_DATABASE_URL: `postgresql://deledger_identity:secret@127.0.0.1:55433/${database}`,
    }).environment).toBe("local");
  });

  it.each(["deledger", "production", "deledger_test", "", "deledger_local/other", "deledger_local_" + "a".repeat(60)])("rejects unsafe database name %s", name => {
    expect(() => loadConfig({ ...common, DELEDGER_ENV: "local", APP_ORIGIN: "http://127.0.0.1:3000", LOCAL_DATABASE_NAME: name })).toThrow(/LOCAL_DATABASE_NAME/);
  });

  it.each([
    { LOCAL_DATABASE_NAME: "deledger_local_v2" },
    { DATABASE_URL: "postgresql://deledger_web:secret@remote:55433/deledger_local" },
    { DATABASE_URL: "postgresql://deledger_web:secret@127.0.0.1:55433/deledger_local?host=remote" },
    { IDENTITY_DATABASE_URL: "postgresql://postgres:secret@127.0.0.1:55433/deledger_local" },
    { IDENTITY_DATABASE_URL: "postgresql://deledger_identity:secret@remote:55433/deledger_local" },
    { IDENTITY_DATABASE_URL: "postgresql://deledger_identity:secret@127.0.0.1:55434/deledger_local" },
    { IDENTITY_DATABASE_URL: "postgresql://deledger_identity:secret@127.0.0.1:55433/deledger" },
    { IDENTITY_DATABASE_URL: "postgresql://deledger_identity:secret@127.0.0.1:55433/deledger_local?dbname=deledger" },
  ])("rejects mismatched local target %j", overrides => {
    expect(() => loadConfig({ ...common, DELEDGER_ENV: "local", APP_ORIGIN: "http://127.0.0.1:3000", ...overrides })).toThrow();
  });

  it("keeps the disposable test exception out of development and explicit database selection", () => {
    const test = { ...common, DELEDGER_ENV: "local", APP_ORIGIN: "http://127.0.0.1:3000",
      DATABASE_URL: "postgresql://deledger_web:secret@127.0.0.1:55432/deledger_test",
      IDENTITY_DATABASE_URL: "postgresql://deledger_identity:secret@127.0.0.1:55432/deledger_test" };
    expect(loadConfig({ ...test, NODE_ENV: "test" }).environment).toBe("local");
    expect(() => loadConfig({ ...test, NODE_ENV: "development" })).toThrow();
    expect(() => loadConfig({ ...test, NODE_ENV: "test", LOCAL_DATABASE_NAME: "deledger_local_v2" })).toThrow();
  });

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
