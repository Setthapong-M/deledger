import type { PoolClient } from "pg";
import { DomainError } from "../domain/errors";
import { resolveCurrentIdentity, getCurrentUser } from "../repositories/users";

export type BoundIdentity = {
  ownerId: string;
  email: string;
};

export async function bindIdentity(client: PoolClient, email: string): Promise<BoundIdentity> {
  const identity = await resolveCurrentIdentity(client, email);
  if (identity.state === "not_invited" || identity.ownerId === null) {
    throw new DomainError("USER_NOT_INVITED", "บัญชีนี้ยังไม่ได้รับเชิญ");
  }
  if (identity.state === "archived") {
    throw new DomainError("USER_ARCHIVED", "บัญชีนี้ถูกพักใช้งาน");
  }
  return { ownerId: identity.ownerId, email };
}

export async function getBoundUser(client: PoolClient, identity: BoundIdentity): Promise<BoundIdentity & { resumeRequiredAt: string | null }> {
  const user = await getCurrentUser(client, identity.ownerId);
  return { ...identity, ownerId: user.id, resumeRequiredAt: user.resumeRequiredAt };
}
