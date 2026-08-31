import { spawnSync } from "node:child_process";

const testEnv = {
  ...process.env,
  DATABASE_URL: "postgresql://postgres:test-only-placeholder@127.0.0.1:55432/deledger_test",
  TEST_ADMIN_DATABASE_URL: "postgresql://postgres:test-only-placeholder@127.0.0.1:55432/deledger_test",
  TEST_WEB_DATABASE_URL: "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test",
};

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, { stdio: "inherit", env: { ...testEnv, ...extraEnv } });
  return result.status ?? 1;
}

let status = 1;
try {
  if (run("node", ["scripts/test-db.mjs", "reset"]) !== 0) process.exitCode = 1;
  else if (run("node", ["scripts/test-db.mjs", "up"]) !== 0) process.exitCode = 1;
  else if (run("pnpm", ["db:migrate"]) !== 0) process.exitCode = 1;
  else status = run("pnpm", ["--dir", "web", "vitest", "run", "--project", "integration", "--reporter=dot"]);
} finally {
  const cleanup = run("node", ["scripts/test-db.mjs", "down"]);
  if (status === 0 && cleanup !== 0) status = cleanup;
}
process.exit(status);
