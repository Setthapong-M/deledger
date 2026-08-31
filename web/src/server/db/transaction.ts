import type { PoolClient } from "pg";
import { pool } from "./pool";
import { setTransactionOwner } from "./rls";

export type UserTransaction<T> = (context: {
  client: import("pg").PoolClient;
  ownerId: string;
  requestId: string;
}) => Promise<T>;

export async function withDatabaseTransaction<T>(
  ownerId: string,
  requestId: string,
  operation: UserTransaction<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await setTransactionOwner(client, ownerId);
    const result = await operation({ client, ownerId, requestId });
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function withClient<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await operation(client);
  } finally {
    client.release();
  }
}
