import type { DatabaseClient } from "../db/pool.js";
export type IdentityResolution = { ownerId: string | null; state: "active" | "archived" | "not_invited" };
export async function resolveCurrentIdentity(client: DatabaseClient, email: string): Promise<IdentityResolution> {
  const identity = await client.user_identity_email.findUnique({ where: { normalized_email: email.trim().toLowerCase() } });
  if (!identity || identity.unlinked_at) return { ownerId: null, state: "not_invited" };
  const archived = await client.user_archive_period.findFirst({ where: { owner_id: identity.owner_id, restored_at: null } });
  return { ownerId: identity.owner_id, state: archived ? "archived" : "active" };
}
export async function getCurrentUser(client: DatabaseClient, ownerId: string): Promise<{ id: string; resumeRequiredAt: string | null }> {
  const user = await client.app_user.findUnique({ where: { id: ownerId } });
  if (!user) throw new Error("owner not found");
  return { id: user.id, resumeRequiredAt: user.resume_required_at?.toISOString() ?? null };
}
