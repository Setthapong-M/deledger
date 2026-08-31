import type { PoolClient } from "pg";

export type IdentityResolution = {
  ownerId: string | null;
  state: "active" | "archived" | "not_invited";
};

export async function resolveCurrentIdentity(client: PoolClient, email: string): Promise<IdentityResolution> {
  const result = await client.query<{ owner_id: string | null; identity_state: IdentityResolution["state"] }>(
    "SELECT owner_id, identity_state FROM public.resolve_current_identity($1)",
    [email],
  );
  const row = result.rows[0];
  return row ? { ownerId: row.owner_id, state: row.identity_state } : { ownerId: null, state: "not_invited" };
}

export async function getCurrentUser(client: PoolClient, ownerId: string): Promise<{ id: string; resumeRequiredAt: string | null }> {
  const result = await client.query<{ id: string; resume_required_at: string | null }>(
    "SELECT id, resume_required_at FROM public.app_user WHERE id = $1",
    [ownerId],
  );
  const row = result.rows[0];
  if (!row) throw new Error("owner not found");
  return { id: row.id, resumeRequiredAt: row.resume_required_at };
}
