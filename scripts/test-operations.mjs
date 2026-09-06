import { spawnSync } from "node:child_process";

const testEnv = {
  ...process.env,
  MIGRATION_DATABASE_URL: "postgresql://postgres:test-only-placeholder@127.0.0.1:55432/deledger_test",
  DELEDGER_ENV: "local", NODE_ENV: "test", APP_ORIGIN: "http://127.0.0.1:3000", BUSINESS_TIME_ZONE: "Asia/Bangkok", BACKUP_MODE: "disabled",
  CLOUDFLARE_TEAM_DOMAIN: undefined, CLOUDFLARE_ACCESS_AUD: undefined,
  DATABASE_URL: "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test",
  TEST_ADMIN_DATABASE_URL: "postgresql://postgres:test-only-placeholder@127.0.0.1:55432/deledger_test",
  IDENTITY_DATABASE_URL: "postgresql://deledger_identity:test-identity-password@127.0.0.1:55432/deledger_test",
  TEST_IDENTITY_DATABASE_URL: "postgresql://deledger_identity:test-identity-password@127.0.0.1:55432/deledger_test",
  TEST_WEB_DATABASE_URL: "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test",
};

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: {...testEnv, ...extraEnv} });
  return result.status ?? 1;
}

let status = 1;
try {
  if (run("pnpm", ["--dir", "api", "generate"]) !== 0) throw new Error("Prisma generation failed");
  if (run("node", ["scripts/test-db.mjs", "reset"]) === 0 && run("node", ["scripts/test-db.mjs", "up"]) === 0 && run("pnpm", ["db:migrate"], {DATABASE_URL: testEnv.TEST_ADMIN_DATABASE_URL}) === 0) {
    status = run("pnpm", ["--dir", "api", "exec", "vitest", "run", "tests/operations", "--reporter=dot"]);
    if (status === 0) status = run("bash", ["scripts/test-backup-restore.sh"]);
  }
} finally {
  const cleanup = run("node", ["scripts/test-db.mjs", "down"]);
  if (status === 0 && cleanup !== 0) status = cleanup;
}
process.exit(status);
