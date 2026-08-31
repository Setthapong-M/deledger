import pg from "pg";

const { Pool } = pg;

export const adminDatabaseUrl = process.env.TEST_ADMIN_DATABASE_URL ?? "postgresql://postgres:test-only-placeholder@127.0.0.1:55432/deledger_test";
export const webDatabaseUrl = process.env.TEST_WEB_DATABASE_URL ?? "postgresql://deledger_web:test-web-password@127.0.0.1:55432/deledger_test";

export function createTestPool(connectionString = adminDatabaseUrl): pg.Pool {
  return new Pool({ connectionString, max: 2, connectionTimeoutMillis: 3_000 });
}

export async function withTestTransaction<T>(pool: pg.Pool, operation: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await operation(client);
    await client.query("ROLLBACK");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
