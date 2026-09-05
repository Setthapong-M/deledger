import type { PoolClient } from "pg";
import { DomainError } from "../domain/errors";
import { normalizeIdentifier } from "../auth/local";

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

export async function readProfile(client: PoolClient, ownerId: string): Promise<UserProfile> {
  const user = await client.query<{ date_of_birth: string | null }>("SELECT date_of_birth::text FROM public.app_user WHERE id = $1", [ownerId]);
  if (!user.rows[0]) throw new DomainError("USER_NOT_INVITED", "ไม่พบบัญชีผู้ใช้");
  const [email, phone] = await Promise.all([
    client.query<{ normalized_email: string }>("SELECT normalized_email FROM public.user_identity_email WHERE owner_id = $1 AND unlinked_at IS NULL", [ownerId]),
    client.query<{ normalized_phone: string }>("SELECT normalized_phone FROM public.user_identity_phone WHERE owner_id = $1 AND unlinked_at IS NULL", [ownerId]),
  ]);
  return { email: email.rows[0]?.normalized_email ?? null, phone: phone.rows[0]?.normalized_phone ?? null, dateOfBirth: user.rows[0].date_of_birth };
}

export async function updateProfile(client: PoolClient, ownerId: string, input: ProfileUpdate, allowContactChanges: boolean): Promise<UserProfile> {
  const changeEmail = Object.prototype.hasOwnProperty.call(input, "email");
  const changePhone = Object.prototype.hasOwnProperty.call(input, "phone");
  const changeDate = Object.prototype.hasOwnProperty.call(input, "dateOfBirth");
  if (!changeEmail && !changePhone && !changeDate) throw new DomainError("INVALID_INPUT", "ต้องส่งข้อมูลที่ต้องการแก้ไข");
  if (!allowContactChanges && (changeEmail || changePhone)) throw new DomainError("PROFILE_CONTACT_READ_ONLY", "QAS ยังแก้ข้อมูลติดต่อไม่ได้");
  const email = normalizeContact(input.email, "email", changeEmail);
  const phone = normalizeContact(input.phone, "phone", changePhone);
  const dateOfBirth = normalizeDate(input.dateOfBirth, changeDate);
  try {
    const result = await client.query<{ email: string | null; phone: string | null; date_of_birth: string | null }>(
      "SELECT email, phone, date_of_birth::text FROM public.update_current_profile($1, $2, $3, $4, $5, $6, $7)",
      [ownerId, email, phone, dateOfBirth, changeEmail, changePhone, changeDate],
    );
    const row = result.rows[0];
    if (!row) throw new DomainError("INTERNAL_ERROR", "บันทึกข้อมูลส่วนตัวไม่สำเร็จ");
    return { email: row.email, phone: row.phone, dateOfBirth: row.date_of_birth };
  } catch (error) {
    if (error instanceof DomainError) throw error;
    if (isPgCode(error, "23505")) throw new DomainError("PROFILE_CONFLICT", "ข้อมูลติดต่อนี้ถูกใช้โดย User อื่นหรือเคยถูกยกเลิกแล้ว", contactField(error, changeEmail, changePhone));
    if (isPgCode(error, "22023")) throw new DomainError("INVALID_INPUT", errorMessage(error), "profile");
    if (isPgCode(error, "42501")) throw new DomainError("USER_NOT_INVITED", "ไม่สามารถแก้ข้อมูลของ User นี้ได้");
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
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value || value > currentBangkokDate()) throw new DomainError("INVALID_INPUT", "วันเกิดไม่ถูกต้อง", "dateOfBirth");
  return value;
}

function currentBangkokDate(): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new Error("unable to determine Bangkok business date");
  return `${year}-${month}-${day}`;
}

function isPgCode(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: unknown }).code === code;
}

function contactField(error: unknown, changeEmail: boolean, changePhone: boolean): "email" | "phone" | "profile" {
  const constraint = typeof error === "object" && error !== null && "constraint" in error ? (error as { constraint?: unknown }).constraint : undefined;
  if (typeof constraint === "string" && constraint.includes("phone")) return "phone";
  if (typeof constraint === "string" && constraint.includes("email")) return "email";
  const message = error instanceof Error ? error.message : "";
  if (message.includes("phone")) return "phone";
  if (message.includes("email")) return "email";
  if (changePhone && !changeEmail) return "phone";
  if (changeEmail && !changePhone) return "email";
  return "profile";
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message.includes("date of birth") ? "วันเกิดต้องไม่เป็นวันในอนาคต" : "ข้อมูลส่วนตัวไม่ถูกต้อง";
}
