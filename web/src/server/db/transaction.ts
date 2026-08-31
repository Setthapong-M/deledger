import type { PoolClient } from "pg";
import { pool } from "./pool";
import { setTransactionOwner } from "./rls";
import { verifyAccessJwt, type AccessJwtConfig } from "../auth/access-jwt";
import { bindIdentity, getBoundUser } from "../auth/identity";
import { DomainError } from "../domain/errors";
import { logOperation } from "../logging";

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

export async function withUserTransaction<T>(
  request: Request,
  requestId: string,
  config: AccessJwtConfig,
  operation: UserTransaction<T>,
): Promise<T> {
  const startedAt = performance.now();
  const identity = await verifyAccessJwt(request, config).catch((error: unknown) => {
    const code = error instanceof Error && error.message === "ACCESS_TOKEN_MISSING" ? "ACCESS_TOKEN_MISSING" : "ACCESS_TOKEN_INVALID";
    throw new DomainError(code, code === "ACCESS_TOKEN_MISSING" ? "ต้องเข้าสู่ระบบก่อน" : "โทเคนไม่ถูกต้อง");
  });
  const client = await pool.connect();
  let boundOwnerId: string | undefined;
  try {
    await client.query("BEGIN");
    const resolved = await bindIdentity(client, identity.email);
    await setTransactionOwner(client, resolved.ownerId);
    const bound = await getBoundUser(client, resolved);
    boundOwnerId = bound.ownerId;
    await client.query("SELECT public.catch_up_current_owner_reporting_months()");
    const result = await operation({ client, ownerId: bound.ownerId, requestId });
    await client.query("COMMIT");
    logOperation({ requestId, ownerId: bound.ownerId, operation: "user_transaction", latencyMs: Math.round(performance.now() - startedAt), resultCode: "OK" });
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    const resultCode = error instanceof DomainError ? error.code : "INTERNAL_ERROR";
    logOperation({ requestId, ...(boundOwnerId ? { ownerId: boundOwnerId } : {}), operation: "user_transaction", latencyMs: Math.round(performance.now() - startedAt), resultCode });
    throw error;
  } finally {
    client.release();
  }
}
