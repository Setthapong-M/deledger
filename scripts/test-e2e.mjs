import { spawnSync } from "node:child_process";
const env = {
  ...process.env,
  CLOUDFLARE_TEAM_DOMAIN: undefined,
  CLOUDFLARE_ACCESS_AUD: undefined,
  CLOUDFLARE_TUNNEL_TOKEN: undefined,
  DATABASE_URL: "postgresql://postgres:test-only-placeholder@127.0.0.1:55432/deledger_test",
  MIGRATION_DATABASE_URL: "postgresql://postgres:test-only-placeholder@127.0.0.1:55432/deledger_test",
};
function run(command, args) { return spawnSync(command, args, { env, stdio: "inherit" }).status ?? 1; }
let status = 1;
try {
  if (run("node", ["scripts/test-db.mjs", "reset"]) === 0 && run("node", ["scripts/test-db.mjs", "up"]) === 0 && run("pnpm", ["db:migrate"]) === 0) {
    status = run("pnpm", ["--dir", "web", "playwright", "test", ...process.argv.slice(2)]);
  }
} finally {
  const cleanup = run("node", ["scripts/test-db.mjs", "down"]);
  if (status === 0 && cleanup !== 0) status = cleanup;
}
process.exit(status);
