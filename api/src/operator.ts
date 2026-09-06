import { pathToFileURL } from "node:url";
import { createCipheriv, randomBytes } from "node:crypto";
import { writeFile, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { identityPrisma } from "./server/db/pool.js";
import type { Prisma } from "./generated/prisma/client.js";
import { catchUpOwner } from "./server/services/catch-up.js";
import { now } from "./server/domain/clock.js";
import { businessDate } from "./server/domain/calendar.js";

function email(value: string): string {
  const normalized = value.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(normalized)) throw new Error("invalid email");
  return normalized;
}
async function lockOwner(client: Prisma.TransactionClient, ownerId: string): Promise<void> {
  const found = await client.$queryRaw<Array<{ id: string }>>`SELECT id FROM public.app_user WHERE id = ${ownerId}::uuid FOR UPDATE`;
  if (!found.length) throw new Error("user not found");
}
export async function invite(value: string): Promise<string> {
  const normalized = email(value);
  return identityPrisma.$transaction(async client => {
    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`email:${normalized}`}, 0))`;
    const existing = await client.user_identity_email.findUnique({ where: { normalized_email: normalized } });
    if (existing) return existing.owner_id;
    return (await client.app_user.create({ data: { emails: { create: { normalized_email: normalized } } } })).id;
  });
}
export async function archive(ownerId: string): Promise<string> {
  return identityPrisma.$transaction(async client => {
    await lockOwner(client, ownerId);
    const existing = await client.user_archive_period.findFirst({ where: { owner_id: ownerId, restored_at: null } });
    return (existing ?? await client.user_archive_period.create({ data: { owner_id: ownerId, archived_at: now() } })).id.toString();
  });
}
export async function restore(ownerId: string): Promise<boolean> {
  return identityPrisma.$transaction(async client => {
    await lockOwner(client, ownerId);
    const period = await client.user_archive_period.findFirst({ where: { owner_id: ownerId, restored_at: null } });
    if (!period) throw new Error("archive not open");
    await catchUpOwner(client, ownerId);
    const instant = new Date(Math.max(now().getTime(), period.archived_at.getTime() + 1));
    const crossed = businessDate(period.archived_at).slice(0, 7) < businessDate(instant).slice(0, 7);
    await client.user_archive_period.update({ where: { id: period.id }, data: { restored_at: instant } });
    if (crossed) await client.app_user.update({ where: { id: ownerId }, data: { resume_required_at: instant } });
    return crossed;
  }, { timeout: 60_000 });
}
export async function transferEmail(oldValue: string, newValue: string): Promise<string> {
  const oldEmail = email(oldValue), newEmail = email(newValue);
  return identityPrisma.$transaction(async client => {
    for (const value of [...new Set([oldEmail, newEmail])].sort()) await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`email:${value}`}, 0))`;
    const old = await client.user_identity_email.findUnique({ where: { normalized_email: oldEmail } });
    if (!old || old.unlinked_at) throw new Error("old email not found");
    await lockOwner(client, old.owner_id);
    const fresh = await client.user_identity_email.findUnique({ where: { normalized_email: oldEmail } });
    if (!fresh || fresh.unlinked_at || fresh.owner_id !== old.owner_id) throw new Error("old email not found");
    const existing = await client.user_identity_email.findUnique({ where: { normalized_email: newEmail } });
    if (existing && existing.owner_id !== old.owner_id) throw new Error("email belongs to another user");
    const instant = now();
    await client.user_identity_email.update({ where: { normalized_email: oldEmail }, data: { unlinked_at: instant } });
    await client.user_identity_email.upsert({ where: { normalized_email: newEmail }, create: { normalized_email: newEmail, owner_id: old.owner_id }, update: { linked_at: instant, unlinked_at: null } });
    return old.owner_id;
  });
}
export async function exportFacts(ownerId: string): Promise<unknown> {
  return identityPrisma.$transaction(async client => {
    await lockOwner(client, ownerId);
    const where = { owner_id: ownerId };
    return {
      owner: await client.app_user.findUnique({ where: { id: ownerId } }),
      emails: await client.user_identity_email.findMany({ where, orderBy: { linked_at: "asc" } }),
      phones: await client.user_identity_phone.findMany({ where, orderBy: { linked_at: "asc" } }),
      archives: await client.user_archive_period.findMany({ where, orderBy: { archived_at: "asc" } }),
      months: await client.reporting_month.findMany({ where, orderBy: { month_start: "asc" } }),
      snapshots: await client.balance_snapshot.findMany({ where, orderBy: [{ month_start: "asc" }, { observed_on: "asc" }, { recorded_at: "asc" }] }),
      setup: await client.monthly_recurring_expense.findMany({ where, orderBy: [{ month_start: "asc" }, { position: "asc" }] }),
      details: await client.monthly_expense_detail.findMany({ where, orderBy: [{ month_start: "asc" }, { confirmed_at: "asc" }] }),
    };
  });
}
export async function exportUser(ownerId: string, outputDir: string): Promise<string> {
  const key = Buffer.from(process.env.DELEDGER_EXPORT_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("DELEDGER_EXPORT_KEY must be a base64 32-byte key");
  const payload = await exportFacts(ownerId);
  const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload, (_key, value: unknown) => typeof value === "bigint" ? value.toString() : value);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const outputPath = join(outputDir, `deledger-${ownerId}.json.enc`);
  const temporary = `${outputPath}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    await writeFile(temporary, Buffer.concat([Buffer.from("DELEDGER-EXPORT-1\n"), iv, cipher.getAuthTag(), encrypted]), { mode: 0o600, flag: "wx" });
    await rename(temporary, outputPath);
  } finally { await rm(temporary, { force: true }); }
  return outputPath;
}
async function confirm(action: string): Promise<void> {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error(`${action} requires an interactive TTY confirmation`);
  const prompt = createInterface({ input: stdin, output: stdout });
  try { if (await prompt.question(`Type ${action} to continue: `) !== action) throw new Error("confirmation declined"); }
  finally { prompt.close(); }
}
export async function run(argv: string[]): Promise<unknown> {
  const [command, ...args] = argv;
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i += 2) {
    if (!/^--(email|old-email|new-email|owner-id|output-dir)$/.test(args[i]!) || !args[i + 1] || args[i + 1]!.startsWith("--")) throw new Error("invalid flags");
    flags.set(args[i]!.slice(2), args[i + 1]!);
  }
  const required = (name: string) => { const value = flags.get(name); if (!value) throw new Error(`--${name} is required`); return value; };
  if (command === "invite") return invite(required("email"));
  if (command === "transfer-email") { const old = required("old-email"), next = required("new-email"); await confirm(command); return transferEmail(old, next); }
  if (!["archive", "restore", "export"].includes(command ?? "")) throw new Error("usage: invite|archive|restore|transfer-email|export");
  const ownerId = required("owner-id");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ownerId)) throw new Error("owner-id must be a UUID");
  if (command === "export") return exportUser(ownerId, required("output-dir"));
  await confirm(command!);
  return command === "archive" ? archive(ownerId) : restore(ownerId);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run(process.argv.slice(2)).then(value => console.log(value)).catch(error => { console.error(error instanceof Error ? error.message : "operator command failed"); process.exitCode = 1; }).finally(() => identityPrisma.$disconnect());
}
