import pg from "pg";
import { loadConfig } from "../config";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: loadConfig().DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 10_000,
  connectionTimeoutMillis: 5_000,
  allowExitOnIdle: true,
});
