import { randomUUID } from "node:crypto";
import type { DatabaseClient } from "../db/pool.js";
import { lockIdentifier, lockOwner } from "../db/rls.js";
import { withClient } from "../db/transaction.js";
import { DomainError } from "../domain/errors.js";
import { createLocalSessionToken, normalizeIdentifier } from "../auth/local.js";

export async function loginLocal(client: DatabaseClient, rawIdentifier: string): Promise<{ token: string; expiresAt: Date }> {
  let identifier;
  try { identifier = normalizeIdentifier(rawIdentifier); }
  catch { throw new DomainError("IDENTIFIER_INVALID", "กรอกอีเมลหรือเบอร์มือถือไทยให้ถูกต้อง", "identifier"); }
  await lockIdentifier(client, `${identifier.kind}:${identifier.value}`);
  const existing = identifier.kind === "email"
    ? await client.user_identity_email.findUnique({ where: { normalized_email: identifier.value } })
    : await client.user_identity_phone.findUnique({ where: { normalized_phone: identifier.value } });
  if (existing?.unlinked_at) throw new DomainError("IDENTITY_CONFLICT", "ช่องทางนี้เคยถูกยกเลิกการผูกไว้แล้ว");
  const ownerId = existing?.owner_id ?? randomUUID();
  if (!existing) {
    await client.app_user.create({ data: { id: ownerId } });
    if (identifier.kind === "email") await client.user_identity_email.create({ data: { normalized_email: identifier.value, owner_id: ownerId } });
    else await client.user_identity_phone.create({ data: { normalized_phone: identifier.value, owner_id: ownerId } });
  }
  await lockOwner(client, ownerId);
  const current = identifier.kind === "email"
    ? await client.user_identity_email.findUnique({ where: { normalized_email: identifier.value } })
    : await client.user_identity_phone.findUnique({ where: { normalized_phone: identifier.value } });
  if (!current || current.unlinked_at || current.owner_id !== ownerId) throw new DomainError("IDENTITY_CONFLICT", "ช่องทางนี้เคยถูกยกเลิกการผูกไว้แล้ว");
  const archived = await client.user_archive_period.findFirst({ where: { owner_id: ownerId, restored_at: null } });
  if (archived) throw new DomainError("USER_ARCHIVED", "บัญชีนี้ถูกพักใช้งาน");
  const session = createLocalSessionToken();
  await client.local_session.create({ data: { token_digest: session.digest, owner_id: ownerId, expires_at: session.expiresAt } });
  return session;
}

export async function loginLocalWithTransaction(rawIdentifier: string): Promise<{ token: string; expiresAt: Date }> {
  for (let attempt = 0; ; attempt++) {
    try { return await withClient(client => loginLocal(client, rawIdentifier)); }
    catch (error) {
      // A profile may claim an absent contact before signup inserts it; retry the rolled-back signup to resolve its owner.
      if (attempt >= 2 || typeof error !== "object" || error === null || !("code" in error) || error.code !== "P2002") throw error;
    }
  }
}
