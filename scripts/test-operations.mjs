import { spawnSync } from "node:child_process";

const testEnv = {
  ...process.env,
  DATABASE_URL: "postgresql://postgres:test-only-placeholder@127.0.0.1:55432/deledger_test",
  TEST_ADMIN_DATABASE_URL: "postgresql://postgres:test-only-placeholder@127.0.0.1:55432/deledger_test",
  TEST_WEB_DATABASE_URL: "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test",
};

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit", env: testEnv });
  return result.status ?? 1;
}

let status = 1;
try {
  if (run("node", ["scripts/test-db.mjs", "reset"]) === 0 && run("node", ["scripts/test-db.mjs", "up"]) === 0 && run("pnpm", ["db:migrate"]) === 0) {
    status = run("pnpm", ["--dir", "web", "vitest", "run", "--project", "operations", "--reporter=dot"]);
  }
} finally {
  const cleanup = run("node", ["scripts/test-db.mjs", "down"]);
  if (status === 0 && cleanup !== 0) status = cleanup;
}
process.exit(status);
