import { prisma, identityPrisma, type DatabaseClient } from "./pool.js";
import { lockOwner, setTransactionOwner } from "./rls.js";
import { verifyAccessJwt, type AccessJwtConfig } from "../auth/access-jwt.js";
import { bindIdentity, bindLocalOwner, getBoundUser } from "../auth/identity.js";
import { readLocalSessionToken, resolveLocalSession } from "../auth/local.js";
import { DomainError } from "../domain/errors.js";
import { logOperation } from "../logging.js";
import { catchUpOwner } from "../services/catch-up.js";
import { assertClockRevision, withCalendarGate } from "../domain/local-calendar.js";

export async function runTransaction<T>(database: typeof prisma, operation: (client: DatabaseClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await database.$transaction(operation); }
    catch (error) {
      if (error instanceof DomainError || attempt >= 2 || typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2034") throw error;
    }
  }
}

export type UserTransaction<T> = (context: { client: DatabaseClient; ownerId: string; requestId: string }) => Promise<T>;
export async function withDatabaseTransaction<T>(ownerId: string, requestId: string, operation: UserTransaction<T>): Promise<T> {
  return runTransaction(prisma, async client => {
    await setTransactionOwner(client, ownerId);
    await lockOwner(client, ownerId);
    return operation({ client, ownerId, requestId });
  });
}
export async function withClient<T>(operation: (client: DatabaseClient) => Promise<T>): Promise<T> {
  return runTransaction(identityPrisma, operation);
}
export async function withUserTransaction<T>(request: Request, requestId: string, config: AccessJwtConfig & { mode?: "qas" } | { mode: "local" }, operation: UserTransaction<T>, options: { skipCatchUp?: boolean } = {}): Promise<T> {
  return withCalendarGate(config.mode === "local", () => userTransaction(request, requestId, config, operation, options));
}

async function userTransaction<T>(request: Request, requestId: string, config: AccessJwtConfig & { mode?: "qas" } | { mode: "local" }, operation: UserTransaction<T>, options: { skipCatchUp?: boolean }): Promise<T> {
  const startedAt = performance.now();
  const local = config.mode === "local";
  const identity = local ? null : await verifyAccessJwt(request, config).catch((error: unknown) => {
    const code = error instanceof Error && error.message === "ACCESS_TOKEN_MISSING" ? "ACCESS_TOKEN_MISSING" : "ACCESS_TOKEN_INVALID";
    throw new DomainError(code, code === "ACCESS_TOKEN_MISSING" ? "ต้องเข้าสู่ระบบก่อน" : "โทเคนไม่ถูกต้อง");
  });
  let boundOwnerId: string | undefined;
  try {
    const result = await runTransaction(identityPrisma, async client => {
      const token = local ? readLocalSessionToken(request) : null;
      let resolved;
      if (local) {
        if (!token) throw new DomainError("SESSION_INVALID", "ต้องเข้าสู่ระบบก่อน");
        const session = await resolveLocalSession(client, token);
        if (session.state === "archived") throw new DomainError("USER_ARCHIVED", "บัญชีนี้ถูกพักใช้งาน");
        if (!session.ownerId || session.state !== "active") throw new DomainError("SESSION_INVALID", "เซสชันหมดอายุหรือไม่ถูกต้อง");
        resolved = { ownerId: session.ownerId, email: null };
      } else resolved = await bindIdentity(client, identity!.email);
      // Identity lookup needs cross-user access; every authenticated operation runs under RLS on this same connection.
      await client.$executeRaw`SET LOCAL ROLE deledger_web`;
      await setTransactionOwner(client, resolved.ownerId);
      await lockOwner(client, resolved.ownerId);
      await bindLocalOwner(client, resolved.ownerId);
      if (local && token) {
        const session = await resolveLocalSession(client, token);
        if (session.state !== "active") throw new DomainError("SESSION_INVALID", "เซสชันหมดอายุหรือไม่ถูกต้อง");
      } else {
        const current = await bindIdentity(client, identity!.email);
        if (current.ownerId !== resolved.ownerId) throw new DomainError("USER_NOT_INVITED", "บัญชีนี้ยังไม่ได้รับเชิญ");
      }
      const bound = await getBoundUser(client, resolved);
      boundOwnerId = bound.ownerId;
      if (local && !options.skipCatchUp) assertClockRevision(request.headers.get("x-deledger-clock-revision"));
      if (!options.skipCatchUp) await catchUpOwner(client, bound.ownerId);
      return operation({ client, ownerId: bound.ownerId, requestId });
    });
    logOperation({ requestId, ownerId: boundOwnerId, operation: "user_transaction", latencyMs: Math.round(performance.now() - startedAt), resultCode: "OK" });
    return result;
  } catch (error) {
    const resultCode = error instanceof DomainError ? error.code : "INTERNAL_ERROR";
    logOperation({ requestId, ...(boundOwnerId ? { ownerId: boundOwnerId } : {}), operation: "user_transaction", latencyMs: Math.round(performance.now() - startedAt), resultCode });
    throw error;
  }
}
