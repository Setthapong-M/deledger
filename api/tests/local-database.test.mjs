import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { localDatabaseConfiguration } from "../../scripts/local-database.mjs";
import { localAdminDatabaseUrl } from "../../scripts/seed-local.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const cleanEnv = () => Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("LOCAL_") && !key.startsWith("DELEDGER_") && !key.includes("DATABASE_URL") && !key.startsWith("CLOUDFLARE_")));

describe("local database selection", () => {
  it.each([undefined, "deledger_local", "deledger_local_v2"])("shares the default/selected target with seed: %s", selected => {
    const env = selected === undefined ? {} : { LOCAL_DATABASE_NAME: selected };
    const config = localDatabaseConfiguration(env);
    for (const key of ["admin", "web", "identity"]) expect(new URL(config[key]).pathname).toBe(`/${selected ?? "deledger_local"}`);
    expect(config.volume).toBe(`${selected ?? "deledger_local"}_pgdata`);
    expect(localAdminDatabaseUrl(env)).toBe(config.admin);
  });

  it("encodes passwords and honors consistent overrides", () => {
    const generated = localDatabaseConfiguration({ LOCAL_POSTGRES_PASSWORD: "p@ss/#?%", LOCAL_POSTGRES_PORT: "55555" });
    expect(decodeURIComponent(new URL(generated.admin).password)).toBe("p@ss/#?%");
    expect(new URL(generated.web).port).toBe("55555");
    const env = { LOCAL_DATABASE_NAME: "deledger_local_v2",
      LOCAL_ADMIN_DATABASE_URL: "postgresql://postgres:custom@localhost:55555/deledger_local_v2",
      LOCAL_DATABASE_URL: "postgresql://deledger_web:custom@localhost:55555/deledger_local_v2",
      LOCAL_IDENTITY_DATABASE_URL: "postgresql://deledger_identity:custom@localhost:55555/deledger_local_v2" };
    expect(localDatabaseConfiguration(env).admin).toBe(env.LOCAL_ADMIN_DATABASE_URL);
    expect(localAdminDatabaseUrl(env)).toBe(env.LOCAL_ADMIN_DATABASE_URL);
  });

  it.each([
    { LOCAL_DATABASE_NAME: "deledger" }, { LOCAL_DATABASE_NAME: "production" }, { LOCAL_DATABASE_NAME: "deledger_test" },
    { LOCAL_DATABASE_NAME: "deledger_local/other" }, { LOCAL_DATABASE_NAME: "" },
    { LOCAL_DATABASE_NAME: "deledger_local_" + "a".repeat(60) },
    { LOCAL_ADMIN_DATABASE_URL: "postgresql://postgres:p@remote:55433/deledger_local" },
    { LOCAL_ADMIN_DATABASE_URL: "postgresql://postgres:p@127.0.0.1:55433/deledger" },
    { LOCAL_ADMIN_DATABASE_URL: "postgresql://deledger_web:p@127.0.0.1:55433/deledger_local" },
    { LOCAL_ADMIN_DATABASE_URL: "postgresql://postgres:p@127.0.0.1:55434/deledger_local" },
    { LOCAL_DATABASE_NAME: "deledger_local_v2", LOCAL_DATABASE_URL: "postgresql://deledger_web:p@127.0.0.1:55433/deledger_local" },
    { LOCAL_IDENTITY_DATABASE_URL: "postgresql://deledger_identity:p@127.0.0.1:55433/deledger_local?host=remote" },
  ])("launcher and seed reject invalid configuration %j", env => {
    expect(() => localDatabaseConfiguration(env)).toThrow();
    expect(() => localAdminDatabaseUrl(env)).toThrow();
  });

  it.each([undefined, "deledger_local_v2"])("renders Compose database, healthcheck and isolated volume: %s", name => {
    const env = { ...cleanEnv(), ...(name ? { LOCAL_DATABASE_NAME: name } : {}) };
    const config = JSON.parse(execFileSync("docker", ["compose", "-f", "infra/compose.local.yaml", "config", "--format", "json"], { cwd: root, env, encoding: "utf8" }));
    expect(config.services["postgres-local"].environment.POSTGRES_DB).toBe(name ?? "deledger_local");
    expect(config.services["postgres-local"].healthcheck.test).toEqual(["CMD-SHELL", 'pg_isready -U postgres -d "$$POSTGRES_DB"']);
    expect(config.volumes.deledger_local_pgdata.name).toBe(`${name ?? "deledger_local"}_pgdata`);
  });

  it.each([undefined, "deledger_local_v2", "deledger"])("executes launcher with the .env.local target before any Docker/migration call: %s", name => {
    const directory = mkdtempSync(join(tmpdir(), "deledger-launcher-"));
    try {
      mkdirSync(join(directory, "scripts"));
      mkdirSync(join(directory, "bin"));
      for (const file of ["dev-local.sh", "local-database.mjs"]) copyFileSync(join(root, "scripts", file), join(directory, "scripts", file));
      writeFileSync(join(directory, ".env.local"), `DELEDGER_ENV=local\n${name ? `LOCAL_DATABASE_NAME=${name}\n` : ""}`);
      const recorder = `#!/usr/bin/env node\nconst fs = require('node:fs'); fs.appendFileSync('calls.jsonl', JSON.stringify({ command: require('node:path').basename(process.argv[1]), args: process.argv.slice(2), name: process.env.LOCAL_DATABASE_NAME, database: process.env.DATABASE_URL, identity: process.env.IDENTITY_DATABASE_URL, migration: process.env.MIGRATION_DATABASE_URL, volume: process.env.DELEDGER_LOCAL_PGDATA_VOLUME }) + '\\n');\n`;
      for (const file of ["docker", "pnpm"]) writeFileSync(join(directory, "bin", file), recorder, { mode: 0o755 });
      const toBash = path => process.platform === "win32" ? execFileSync("wsl.exe", ["wslpath", "-u", path], { encoding: "utf8" }).trim() : path;
      const bashDirectory = toBash(directory);
      const command = 'export PATH="$1/bin:$PATH"; cd "$1"; bash scripts/dev-local.sh';
      const result = spawnSync("bash", ["-c", command, "launcher-test", bashDirectory], { cwd: directory, env: cleanEnv(), encoding: "utf8", timeout: 20000 });
      if (name === "deledger") {
        expect(result.status).not.toBe(0);
        expect(result.stderr).toContain("LOCAL_DATABASE_NAME");
        expect(() => readFileSync(join(directory, "calls.jsonl"))).toThrow();
        return;
      }
      expect(result.status, result.stderr).toBe(0);
      const calls = readFileSync(join(directory, "calls.jsonl"), "utf8").trim().split("\n").map(line => JSON.parse(line));
      const selected = name ?? "deledger_local";
      const migration = calls.find(call => call.args.includes("db:migrate"));
      expect(migration.database).toBe(`postgresql://postgres:deledger-local-postgres@127.0.0.1:55433/${selected}`);
      expect(migration.migration).toBe(migration.database);
      const api = calls.find(call => call.args.join(" ") === "--dir api dev");
      expect(api.name).toBe(selected);
      expect(new URL(api.database).pathname).toBe(`/${selected}`);
      expect(new URL(api.identity).pathname).toBe(`/${selected}`);
      const docker = calls.filter(call => call.command === "docker");
      expect(docker).toHaveLength(1);
      expect(docker[0].args).toEqual(["compose", "-f", "infra/compose.local.yaml", "--project-name", "deledger_local", "up", "-d", "--build", "--wait"]);
      expect(docker[0].volume).toBe(`${selected}_pgdata`);
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });
});
