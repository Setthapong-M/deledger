import type { Prisma } from "../../generated/prisma/client.js";
import { identityPrisma } from "../db/pool.js";
import { schedulerReadiness } from "../../scheduler.js";
import { DomainError } from "../domain/errors.js";
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";

const BACKUP_TARGET = "/mnt/deledger-backups";
const BACKUP_MODE_ENFORCED = "enforced";
const BACKUP_MODE_DISABLED = "disabled";

export async function readReadiness(client: Prisma.TransactionClient): Promise<{ status: "ready" }> {
  await client.app_user.count();
  const migrations = await identityPrisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null; rolled_back_at: Date | null }>>`SELECT migration_name, finished_at, rolled_back_at FROM public._prisma_migrations ORDER BY started_at DESC`;
  const expected = readdirSync(new URL("../../../prisma/migrations/", import.meta.url), { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => entry.name);
  const applied = new Set(migrations.filter(migration => migration.finished_at && !migration.rolled_back_at).map(migration => migration.migration_name));
  const unfinished = migrations.some(migration => !migration.finished_at && !migration.rolled_back_at);
  if (!expected.length || unfinished || expected.some(name => !applied.has(name)) || !schedulerReadiness() || !isBackupReady(process.env.BACKUP_MODE, process.env.BACKUP_TARGET)) {
    throw new DomainError("SERVICE_UNAVAILABLE", "บริการยังไม่พร้อมใช้งาน");
  }
  return { status: "ready" };
}

export function isBackupReady(mode: string | undefined, target: string | undefined): boolean {
  if (mode === BACKUP_MODE_DISABLED) return true;
  if (mode !== BACKUP_MODE_ENFORCED) return false;
  return isMountedBackupTarget(target) && hasFreshBackup(target) && hasFreshRestoreMarker(target);
}

function isMountedBackupTarget(target: string | undefined): boolean {
  if (target !== BACKUP_TARGET) return false;
  try {
    execFileSync("mountpoint", ["-q", target], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasFreshBackup(target: string | undefined): boolean {
  if (!target) return false;
  try {
    const newest = readdirSync(target)
      .filter((name) => name.endsWith(".dump.age"))
      .map((name) => ({ name, mtimeMs: statSync(`${target}/${name}`).mtimeMs }))
      .sort((left, right) => right.mtimeMs - left.mtimeMs)[0];
    if (!newest || Date.now() - newest.mtimeMs >= 26 * 60 * 60 * 1000) return false;
    const checksum = `${newest.name}.sha256`;
    statSync(`${target}/${checksum}`);
    execFileSync("sha256sum", ["--check", checksum], { cwd: target, stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasFreshRestoreMarker(target: string | undefined): boolean {
  if (!target) return false;
  try {
    return Date.now() - statSync(`${target}/.restore-verify.last-success`).mtimeMs < 8 * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}
