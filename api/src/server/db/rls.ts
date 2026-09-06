import type { DatabaseClient } from "./pool.js";

export async function setTransactionOwner(client: DatabaseClient, ownerId: string): Promise<void> {
  await client.$queryRaw`SELECT set_config('deledger.user_id', ${ownerId}, true)`;
}
export async function clearTransactionOwner(client: DatabaseClient): Promise<void> {
  await client.$queryRaw`SELECT set_config('deledger.user_id', '', true)`;
}
export async function lockOwner(client: DatabaseClient, ownerId: string): Promise<void> {
  await client.$queryRaw`SELECT id FROM public.app_user WHERE id = ${ownerId}::uuid FOR UPDATE`;
}
export async function lockIdentifier(client: DatabaseClient, identifier: string): Promise<void> {
  await client.$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identifier}, 0))::text`;
}
