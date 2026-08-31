import type { PoolClient } from "pg";

export async function setTransactionOwner(client: PoolClient, ownerId: string): Promise<void> {
  await client.query("SELECT set_config('deledger.user_id', $1, true)", [ownerId]);
}

export async function clearTransactionOwner(client: PoolClient): Promise<void> {
  await client.query("SELECT set_config('deledger.user_id', '', true)");
}
