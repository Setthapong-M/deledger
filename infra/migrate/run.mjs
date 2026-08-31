import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const secretPath = process.env.POSTGRES_PASSWORD_FILE;
if (!secretPath) throw new Error("POSTGRES_PASSWORD_FILE is required");

const password = readFileSync(secretPath, "utf8").replace(/[\r\n]/g, "");
if (!password) throw new Error("postgres password is empty");

const databaseUrl = new URL("postgresql://postgres@postgres:5432/deledger");
databaseUrl.password = password;
const result = spawnSync("/app/node_modules/.bin/node-pg-migrate", ["up", "-m", "/app/db/migrations"], {
  env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
  stdio: "inherit",
});
process.exit(result.status ?? 1);
