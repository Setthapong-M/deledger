import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = fileURLToPath(new URL("../../", import.meta.url));
describe("deployment boundaries", () => {
  it("rejects disposable database commands aimed at local or unrelated databases", () => {
    for (const database of ["deledger_local", "unrelated_test"]) {
      const result = spawnSync("node", ["scripts/test-db.mjs", "reset"], { cwd: root, env: { ...process.env, DATABASE_URL: `postgresql://postgres:test@127.0.0.1:55432/${database}` }, encoding: "utf8" });
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("refusing test database");
    }
  });
  it("keeps QAS ports private and database credentials out of the frontend", () => {
    const text = execFileSync("docker", ["compose", "-f", "infra/compose.yaml", "config", "--format", "json"], { cwd: root, encoding: "utf8", env: { ...process.env, DELEDGER_ENV: "qas", DATABASE_URL: "postgresql://deledger_web:placeholder@postgres:5432/deledger", IDENTITY_DATABASE_URL: "postgresql://deledger_identity:placeholder@postgres:5432/deledger", CLOUDFLARE_TEAM_DOMAIN: "https://example.cloudflareaccess.com", CLOUDFLARE_ACCESS_AUD: "placeholder", CLOUDFLARE_TUNNEL_TOKEN: "placeholder", BACKUP_MODE: "disabled" } });
    const config = JSON.parse(text);
    for (const service of Object.values(config.services) as Array<{ports?: unknown[]}>) expect(service.ports ?? []).toEqual([]);
    expect(Object.keys(config.services.web.networks).sort()).toEqual(["app", "edge"]);
    expect(Object.keys(config.services.api.networks).sort()).toEqual(["api-egress", "app", "data"]);
    expect(Object.keys(config.services.postgres.networks)).toEqual(["data"]);
    expect(Object.keys(config.services.web.environment).filter(key => key.includes("DATABASE"))).toEqual([]);
    expect(config.services.web.environment.API_ORIGIN).toBe("http://api:3001");
    expect(config.services.web.environment.DELEDGER_ENV).toBe("qas");
    expect(config.services.api.environment.HOSTNAME).toBe("0.0.0.0");
    expect(config.networks["api-egress"].internal ?? false).toBe(false);
    expect(Object.entries(config.services).filter(([, service]) => Object.keys((service as {networks: object}).networks).includes("api-egress")).map(([name]) => name)).toEqual(["api"]);
    expect(config.networks.app.internal).toBe(true);
    expect(config.networks.data.internal).toBe(true);
  });
});
