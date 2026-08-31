import { spawnSync } from "node:child_process";

const command = process.argv[2];
if (!new Set(["up", "reset", "down"]).has(command)) {
  console.error("usage: node scripts/test-db.mjs <up|reset|down>");
  process.exit(2);
}

const databaseUrl = process.env.DATABASE_URL ?? "postgresql://deledger_test:test@127.0.0.1:55432/deledger_test";
const parsed = new URL(databaseUrl);
if (parsed.hostname !== "127.0.0.1" || parsed.port !== "55432" || !parsed.pathname.endsWith("_test")) {
  console.error("refusing test database outside loopback 127.0.0.1:55432 with _test database");
  process.exit(2);
}

const compose = ["compose", "-f", "infra/compose.test.yaml", "--project-name", "deledger_test"];
const args = command === "up" ? [...compose, "up", "-d", "--build", "--wait"] : command === "down" ? [...compose, "down"] : [...compose, "down", "-v", "--remove-orphans"];
const result = spawnSync("docker", args, { stdio: "inherit" });
process.exit(result.status ?? 1);
