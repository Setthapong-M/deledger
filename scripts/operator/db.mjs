import pg from "pg";

const { Pool } = pg;

export function operatorDatabaseUrl(environment = process.env) {
  const value = environment.OPERATOR_DATABASE_URL;
  if (!value || !value.startsWith("postgresql://")) throw new Error("OPERATOR_DATABASE_URL is required");
  return value;
}

export function createOperatorPool(environment = process.env) {
  return new Pool({ connectionString: operatorDatabaseUrl(environment), max: 2, connectionTimeoutMillis: 5_000, allowExitOnIdle: true });
}

export async function withOperatorClient(operation, environment = process.env) {
  const pool = createOperatorPool(environment);
  const client = await pool.connect();
  try {
    return await operation(client);
  } finally {
    client.release();
    await pool.end();
  }
}
