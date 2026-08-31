import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("private deployment boundary", () => {
  it("keeps production services off host ports and separates edge/data access", async () => {
    const compose = await readFile(new URL("../../../infra/compose.yaml", import.meta.url), "utf8");
    expect(compose).not.toMatch(/^\s+ports:/m);
    expect(compose).toContain("internal: true");
    expect(compose).toContain("cloudflare/cloudflared:2026.7.2");
    expect(compose).toContain("read_only: true");
    expect(compose).toContain("cap_drop: [ALL]");
    expect(compose).toContain("aliases: [deledger.internal]");
    expect(compose).toContain("CLOUDFLARE_TUNNEL_TOKEN");
    expect(compose).toContain("/api/health/live");
    expect(compose).toContain("condition: service_healthy");
    expect(compose).toContain("backup:");
    expect(compose).toContain("infra/backup/Dockerfile");
    expect(compose).toContain("POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password");
    expect(compose).toContain("profiles: [operations]");
  });

  it("documents exact private WARP and Access controls", async () => {
    const checklist = await readFile(new URL("../../../infra/cloudflare/access-policy-checklist.md", import.meta.url), "utf8");
    expect(checklist).toContain("Authenticate with Cloudflare One Client");
    expect(checklist).toContain("no public DNS or Quick Tunnel");
    expect(checklist).toContain("wildcard domain");
  });

  it("waits for a healthy database and reads the admin secret inside the container", async () => {
    const unit = await readFile(new URL("../../../infra/systemd/deledger-startup-catch-up.service", import.meta.url), "utf8");
    const runner = await readFile(new URL("../../../infra/systemd/startup-catch-up.sh", import.meta.url), "utf8");
    expect(unit).toContain("After=docker.service");
    expect(unit).not.toContain("deledger.service");
    expect(unit).toContain("up --wait --no-recreate postgres");
    expect(unit).toContain("ExecStart=/home/admin/vault/deledger/infra/systemd/startup-catch-up.sh");
    expect(runner).toContain("--env-file");
    expect(runner).toContain("/run/secrets/postgres_password");
    expect(runner).toContain("public.catch_up_reporting_months()");
  });

  it("keeps readiness fail-closed on the mounted, checksum-valid backup target", async () => {
    const readiness = await readFile(new URL("../../src/server/services/readiness.ts", import.meta.url), "utf8");
    expect(readiness).toContain('const BACKUP_TARGET = "/mnt/deledger-backups"');
    expect(readiness).toContain('execFileSync("mountpoint", ["-q", target]');
    expect(readiness).toContain('execFileSync("sha256sum", ["--check", checksum]');
    expect(readiness).toContain("hasFreshRestoreMarker");
  });

  it("keeps systemd repo reads available under hardening", async () => {
    for (const filename of ["deledger-backup.service", "deledger-restore-verify.service", "deledger-startup-catch-up.service"]) {
      const unit = await readFile(new URL(`../../../infra/systemd/${filename}`, import.meta.url), "utf8");
      expect(unit).toContain("ProtectHome=read-only");
      expect(unit).not.toContain("ProtectHome=true");
    }
  });
});
