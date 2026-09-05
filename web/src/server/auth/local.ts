import { createHash, randomBytes } from "node:crypto";
import type { PoolClient } from "pg";

export const LOCAL_SESSION_COOKIE = "deledger_local_session";
export const LOCAL_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export type LoginIdentifier = { kind: "email" | "phone"; value: string };

export function normalizeIdentifier(input: string): LoginIdentifier {
  const value = input.trim();
  if (value.includes("@")) {
    const email = value.toLowerCase();
    if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { kind: "email", value: email };
    throw new Error("IDENTIFIER_INVALID");
  }
  const compact = value.replace(/[\s-]/g, "");
  if (/^0[689]\d{8}$/.test(compact)) return { kind: "phone", value: `+66${compact.slice(1)}` };
  if (/^\+66[689]\d{8}$/.test(compact)) return { kind: "phone", value: compact };
  throw new Error("IDENTIFIER_INVALID");
}

export function createLocalSessionToken(): { token: string; digest: string; expiresAt: Date } {
  const token = randomBytes(32).toString("base64url");
  const digest = digestLocalSessionToken(token);
  const expiresAt = new Date(Date.now() + LOCAL_SESSION_TTL_SECONDS * 1000);
  return { token, digest, expiresAt };
}

export function digestLocalSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function readLocalSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator).trim() !== LOCAL_SESSION_COOKIE) continue;
    const token = part.slice(separator + 1).trim();
    return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : null;
  }
  return null;
}

export function sessionCookie(token: string, maxAgeSeconds = LOCAL_SESSION_TTL_SECONDS): string {
  return `${LOCAL_SESSION_COOKIE}=${token}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax`;
}

export function clearedSessionCookie(): string {
  return sessionCookie("", 0);
}

export type LocalSessionResolution = {
  ownerId: string | null;
  state: "active" | "archived" | "invalid";
};

export async function resolveLocalSession(client: PoolClient, token: string): Promise<LocalSessionResolution> {
  const result = await client.query<{ owner_id: string | null; session_state: LocalSessionResolution["state"] }>(
    "SELECT owner_id, session_state FROM public.resolve_local_session($1)",
    [digestLocalSessionToken(token)],
  );
  const row = result.rows[0];
  return row ? { ownerId: row.owner_id, state: row.session_state } : { ownerId: null, state: "invalid" };
}
