import type { PoolClient } from "pg";
import { DomainError } from "../domain/errors";
import { createLocalSessionToken, normalizeIdentifier } from "../auth/local";

export async function loginLocal(client: PoolClient, rawIdentifier: string): Promise<{ token: string; expiresAt: Date }> {
  let identifier;
  try {
    identifier = normalizeIdentifier(rawIdentifier);
  } catch {
    throw new DomainError("IDENTIFIER_INVALID", "กรอกอีเมลหรือเบอร์มือถือไทยให้ถูกต้อง", "identifier");
  }
  const session = createLocalSessionToken();
  const result = await client.query<{ owner_id: string | null; identity_state: "active" | "archived" | "reserved" | "not_invited" }>(
    "SELECT owner_id, identity_state FROM public.local_login($1, $2, $3, $4)",
    [identifier.kind, identifier.value, session.digest, session.expiresAt],
  );
  const row = result.rows[0];
  if (!row || row.identity_state === "reserved" || row.identity_state === "not_invited") {
    throw new DomainError("IDENTITY_CONFLICT", "ช่องทางนี้เคยถูกยกเลิกการผูกไว้แล้ว");
  }
  if (row.identity_state === "archived") throw new DomainError("USER_ARCHIVED", "บัญชีนี้ถูกพักใช้งาน");
  return session;
}
