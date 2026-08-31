import pg from "pg";
import { loadConfig } from "../config";

const { Pool } = pg;

let singleton: pg.Pool | null = null;

export function getPool(): pg.Pool {
  if (singleton) return singleton;
  singleton = new Pool({
    connectionString: loadConfig().DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
    allowExitOnIdle: true,
  });
  return singleton;
}

export const pool = new Proxy({} as pg.Pool, {
  get(_target, property) {
    const value = getPool()[property as keyof pg.Pool];
    return typeof value === "function" ? value.bind(getPool()) : value;
  },
});
