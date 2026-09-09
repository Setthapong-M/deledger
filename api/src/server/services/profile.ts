import type { DatabaseClient } from "../db/pool.js";
import { lockOwner } from "../db/rls.js";
import { businessDate } from "../domain/calendar.js";
import { now } from "../domain/clock.js";
import { DomainError } from "../domain/errors.js";
import { normalizeIdentifier } from "../auth/local.js";

export type UserProfile = {
  email: string | null;
  phone: string | null;
  dateOfBirth: string | null;
};

export type ProfileUpdate = {
  email?: string | null;
  phone?: string | null;
  dateOfBirth?: string | null;
};

export async function readProfile(client: DatabaseClient, ownerId: string): Promise<UserProfile> {
  const user = await client.app_user.findUnique({ where: { id: ownerId } });
  if (!user) throw new DomainError("USER_NOT_INVITED", "ไม่พบบัญชีผู้ใช้");
  const [email, phone] = await Promise.all([
    client.user_identity_email.findFirst({ where: { owner_id: ownerId, unlinked_at: null } }),
    client.user_identity_phone.findFirst({ where: { owner_id: ownerId, unlinked_at: null } }),
  ]);
  return { email: email?.normalized_email ?? null, phone: phone?.normalized_phone ?? null, dateOfBirth: user.date_of_birth?.toISOString().slice(0, 10) ?? null };
}

export async function updateProfile(client: DatabaseClient, ownerId: string, input: ProfileUpdate, allowContactChanges: boolean): Promise<UserProfile> {
  const changeEmail = Object.prototype.hasOwnProperty.call(input, "email");
  const changePhone = Object.prototype.hasOwnProperty.call(input, "phone");
  const changeDate = Object.prototype.hasOwnProperty.call(input, "dateOfBirth");
  if (!changeEmail && !changePhone && !changeDate) throw new DomainError("INVALID_INPUT", "ต้องส่งข้อมูลที่ต้องการแก้ไข");
  if (!allowContactChanges && (changeEmail || changePhone)) throw new DomainError("PROFILE_CONTACT_READ_ONLY", "QAS ยังแก้ข้อมูลติดต่อไม่ได้");
  const email = normalizeContact(input.email, "email", changeEmail);
  const phone = normalizeContact(input.phone, "phone", changePhone);
  const dateOfBirth = normalizeDate(input.dateOfBirth, changeDate);
  await lockOwner(client, ownerId);
  const current = await readProfile(client, ownerId);
  const nextEmail = changeEmail ? email : current.email;
  const nextPhone = changePhone ? phone : current.phone;
  if (!nextEmail && !nextPhone) throw new DomainError("INVALID_INPUT", "ต้องมีข้อมูลติดต่อสำหรับเข้าสู่ระบบอย่างน้อยหนึ่งช่องทาง", "profile");
  let field: "email" | "phone" | "profile" = "profile";
  try {
    if (changeEmail && email !== current.email) {
      field = "email";
      const previous = await client.user_identity_email.findFirst({ where: { owner_id: ownerId, unlinked_at: null } });
      if (previous) await client.user_identity_email.update({ where: { normalized_email: previous.normalized_email }, data: { unlinked_at: new Date(Math.max(Date.now(), previous.linked_at.getTime() + 1)) } });
      if (email) await client.user_identity_email.create({ data: { normalized_email: email, owner_id: ownerId } });
    }
    if (changePhone && phone !== current.phone) {
      field = "phone";
      const previous = await client.user_identity_phone.findFirst({ where: { owner_id: ownerId, unlinked_at: null } });
      if (previous) await client.user_identity_phone.update({ where: { normalized_phone: previous.normalized_phone }, data: { unlinked_at: new Date(Math.max(Date.now(), previous.linked_at.getTime() + 1)) } });
      if (phone) await client.user_identity_phone.create({ data: { normalized_phone: phone, owner_id: ownerId } });
    }
    if (changeDate) await client.app_user.update({ where: { id: ownerId }, data: { date_of_birth: dateOfBirth ? new Date(`${dateOfBirth}T00:00:00Z`) : null } });
    return readProfile(client, ownerId);
  } catch (error) {
    if (isPgCode(error, "P2002")) throw new DomainError("PROFILE_CONFLICT", "ข้อมูลติดต่อนี้ถูกใช้โดย User อื่นหรือเคยถูกยกเลิกแล้ว", field);
    throw error;
  }
}

function normalizeContact(value: string | null | undefined, kind: "email" | "phone", changed: boolean): string | null {
  if (!changed || value === null || value === undefined || value.trim() === "") return null;
  try {
    const normalized = normalizeIdentifier(value);
    if (normalized.kind !== kind) throw new Error("IDENTIFIER_INVALID");
    return normalized.value;
  } catch {
    throw new DomainError("INVALID_INPUT", kind === "email" ? "กรอกอีเมลให้ถูกต้อง" : "กรอกเบอร์มือถือไทยให้ถูกต้อง", kind);
  }
}

function normalizeDate(value: string | null | undefined, changed: boolean): string | null {
  if (!changed || value === null || value === undefined || value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new DomainError("INVALID_INPUT", "วันเกิดต้องเป็น YYYY-MM-DD", "dateOfBirth");
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value || value > businessDate(now())) throw new DomainError("INVALID_INPUT", "วันเกิดไม่ถูกต้อง", "dateOfBirth");
  return value;
}

function isPgCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}
