import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isBackupReady } from "../../src/server/services/readiness";

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
    expect(compose).toContain("infra/migrate/Dockerfile");
    expect(compose).toContain("POSTGRES_PASSWORD_FILE: /run/secrets/postgres_password");
    expect(compose).toContain("BACKUP_MODE: ${BACKUP_MODE:?BACKUP_MODE is required}");
    expect(compose.slice(compose.indexOf("  web:"), compose.indexOf("  cloudflared:"))).not.toContain("/mnt/deledger-backups");
    expect(compose).toContain("file: ${DELEDGER_SECRET_DIR:-/etc/deledger/secrets}/postgres_password");
    expect(compose).not.toContain("external: true");
  });

  it("renders the local Compose stack without requiring Docker Swarm", async () => {
    const secretDir = await mkdtemp(join(tmpdir(), "deledger-compose-secrets-"));
    try {
      for (const name of ["postgres_password", "web_password", "maintenance_password", "operator_password"]) {
        await writeFile(join(secretDir, name), "test-only-placeholder\n", { mode: 0o640 });
      }
      const composeFile = fileURLToPath(new URL("../../../infra/compose.yaml", import.meta.url));
      const backupOverlay = fileURLToPath(new URL("../../../infra/compose.backup.yaml", import.meta.url));
      const baseEnvironment = {
        ...process.env,
        DELEDGER_SECRET_DIR: secretDir,
        DATABASE_URL: "postgresql://deledger_web:test-only@postgres:5432/deledger",
        CLOUDFLARE_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
        CLOUDFLARE_ACCESS_AUD: "test-only",
        CLOUDFLARE_TUNNEL_TOKEN: "test-only",
      };
      const result = spawnSync("docker", ["compose", "-f", composeFile, "config", "--quiet"], {
        cwd: fileURLToPath(new URL("../../../", import.meta.url)),
        encoding: "utf8",
        env: {
          ...baseEnvironment,
          BACKUP_MODE: "disabled",
        },
      });
      expect(result.status, result.stderr).toBe(0);
      const enforcedResult = spawnSync(
        "docker",
        ["compose", "--profile", "operations", "-f", composeFile, "-f", backupOverlay, "config", "--quiet"],
        {
          cwd: fileURLToPath(new URL("../../../", import.meta.url)),
          encoding: "utf8",
          env: {
            ...baseEnvironment,
            BACKUP_MODE: "enforced",
            BACKUP_AGE_RECIPIENT: "age1testonly",
          },
        },
      );
      expect(enforcedResult.status, enforcedResult.stderr).toBe(0);
    } finally {
      await rm(secretDir, { recursive: true, force: true });
    }
  });

  it("bootstraps production roles from owner-only Compose secret files", async () => {
    const secretDir = await mkdtemp(join(tmpdir(), "deledger-bootstrap-secrets-"));
    const composeFile = fileURLToPath(new URL("../../../infra/compose.yaml", import.meta.url));
    const repository = fileURLToPath(new URL("../../../", import.meta.url));
    const project = "deledger_secret_bootstrap_test";
    const compose = ["compose", "--project-name", project, "-f", composeFile];
    const environment = {
      ...process.env,
      DELEDGER_SECRET_DIR: secretDir,
      DATABASE_URL: "postgresql://deledger_web:test-only@postgres:5432/deledger",
      CLOUDFLARE_TEAM_DOMAIN: "https://team.cloudflareaccess.com",
      CLOUDFLARE_ACCESS_AUD: "test-only",
      CLOUDFLARE_TUNNEL_TOKEN: "test-only",
      BACKUP_MODE: "disabled",
      DELEDGER_PGDATA_VOLUME: "deledger_secret_bootstrap_test_pgdata",
    };
    try {
      for (const name of ["postgres_password", "web_password", "maintenance_password", "operator_password"]) {
        await writeFile(join(secretDir, name), "test-only-placeholder\n", { mode: 0o600 });
      }
      const started = spawnSync("docker", [...compose, "up", "--detach", "--build", "--wait", "postgres"], {
        cwd: repository,
        encoding: "utf8",
        env: environment,
      });
      expect(started.status, `${started.stdout}\n${started.stderr}`).toBe(0);
      const roles = spawnSync(
        "docker",
        [
          ...compose,
          "exec",
          "-T",
          "--user",
          "0",
          "postgres",
          "sh",
          "-eu",
          "-c",
          'export PGPASSWORD="test-only-placeholder"; psql -h 127.0.0.1 -U deledger_web -d deledger -Atc "SELECT current_user;"',
        ],
        { cwd: repository, encoding: "utf8", env: environment },
      );
      const logs = spawnSync("docker", [...compose, "logs", "postgres"], {
        cwd: repository,
        encoding: "utf8",
        env: environment,
      });
      expect(roles.status, `${roles.stderr}\n${logs.stdout}\n${logs.stderr}`).toBe(0);
      expect(roles.stdout.trim()).toBe("deledger_web");
      const migrated = spawnSync("docker", [...compose, "--profile", "operations", "run", "--rm", "--build", "migrate"], {
        cwd: repository,
        encoding: "utf8",
        env: environment,
      });
      expect(migrated.status, `${migrated.stdout}\n${migrated.stderr}`).toBe(0);
      const migrationHead = spawnSync(
        "docker",
        [
          ...compose,
          "exec",
          "-T",
          "--user",
          "0",
          "postgres",
          "sh",
          "-eu",
          "-c",
          'export PGPASSWORD="test-only-placeholder"; psql -h 127.0.0.1 -U postgres -d deledger -Atc "SELECT name FROM public.pgmigrations ORDER BY run_on DESC, name DESC LIMIT 1;"',
        ],
        { cwd: repository, encoding: "utf8", env: environment },
      );
      expect(migrationHead.status, migrationHead.stderr).toBe(0);
      expect(migrationHead.stdout.trim()).toBe("202608310007_restore_boundary");
    } finally {
      spawnSync("docker", [...compose, "down", "--volumes", "--remove-orphans"], {
        cwd: repository,
        encoding: "utf8",
        env: environment,
      });
      await rm(secretDir, { recursive: true, force: true });
    }
  }, 120_000);

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

  it("allows an explicit no-backup beta while keeping every other mode fail-closed", async () => {
    const readiness = await readFile(new URL("../../src/server/services/readiness.ts", import.meta.url), "utf8");
    expect(isBackupReady("disabled", undefined)).toBe(true);
    expect(isBackupReady(undefined, undefined)).toBe(false);
    expect(isBackupReady("optional", undefined)).toBe(false);
    expect(readiness).toContain('const BACKUP_TARGET = "/mnt/deledger-backups"');
    expect(readiness).toContain('execFileSync("mountpoint", ["-q", target]');
    expect(readiness).toContain('execFileSync("sha256sum", ["--check", checksum]');
    expect(readiness).toContain("hasFreshRestoreMarker");
  });

  it("adds the backup mount only through the enforced-mode overlay", async () => {
    const overlay = await readFile(new URL("../../../infra/compose.backup.yaml", import.meta.url), "utf8");
    expect(overlay).toContain("source: /mnt/deledger-backups");
    expect(overlay).toContain("read_only: true");
  });

  it("keeps systemd repo reads available under hardening", async () => {
    for (const filename of ["deledger-backup.service", "deledger-restore-verify.service", "deledger-startup-catch-up.service"]) {
      const unit = await readFile(new URL(`../../../infra/systemd/${filename}`, import.meta.url), "utf8");
      expect(unit).toContain("ProtectHome=read-only");
      expect(unit).not.toContain("ProtectHome=true");
    }
  });
});
