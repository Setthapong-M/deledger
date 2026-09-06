import type { DatabaseClient } from "../db/pool.js";
import { DomainError } from "../domain/errors.js";
import { resolveCurrentIdentity, getCurrentUser } from "../repositories/users.js";

export type BoundIdentity = {
  ownerId: string;
  email: string | null;
};

export async function bindIdentity(client: DatabaseClient, email: string): Promise<BoundIdentity> {
  const identity = await resolveCurrentIdentity(client, email);
  if (identity.state === "not_invited" || identity.ownerId === null) {
    throw new DomainError("USER_NOT_INVITED", "บัญชีนี้ยังไม่ได้รับเชิญ");
  }
  if (identity.state === "archived") {
    throw new DomainError("USER_ARCHIVED", "บัญชีนี้ถูกพักใช้งาน");
  }
  return { ownerId: identity.ownerId, email };
}

export async function bindLocalOwner(client: DatabaseClient, ownerId: string): Promise<BoundIdentity> {
  const user = await getCurrentUser(client, ownerId);
  const archived = await client.user_archive_period.findFirst({ where: { owner_id: ownerId, restored_at: null } });
  if (archived !== null) throw new DomainError("USER_ARCHIVED", "บัญชีนี้ถูกพักใช้งาน");
  return { ownerId: user.id, email: null };
}

export async function getBoundUser(client: DatabaseClient, identity: BoundIdentity): Promise<BoundIdentity & { resumeRequiredAt: string | null }> {
  const user = await getCurrentUser(client, identity.ownerId);
  return { ...identity, ownerId: user.id, resumeRequiredAt: user.resumeRequiredAt };
}
