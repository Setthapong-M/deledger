import { createHash, randomBytes } from "node:crypto";
import type { DatabaseClient } from "../db/pool.js";

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

export async function resolveLocalSession(client: DatabaseClient, token: string): Promise<LocalSessionResolution> {
  const session = await client.local_session.findUnique({ where: { token_digest: digestLocalSessionToken(token) } });
  if (!session || session.revoked_at || session.expires_at <= new Date()) return { ownerId: null, state: "invalid" };
  const archived = await client.user_archive_period.findFirst({ where: { owner_id: session.owner_id, restored_at: null } });
  return { ownerId: session.owner_id, state: archived ? "archived" : "active" };
}

export async function revokeLocalSession(client: DatabaseClient, token: string): Promise<void> {
  await client.local_session.updateMany({ where: { token_digest: digestLocalSessionToken(token), revoked_at: null }, data: { revoked_at: new Date() } });
}
