import type { PoolClient } from "pg";
import { DomainError } from "../domain/errors";
import { execFileSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";

const BACKUP_TARGET = "/mnt/deledger-backups";
const BACKUP_MODE_ENFORCED = "enforced";
const BACKUP_MODE_DISABLED = "disabled";

export async function readReadiness(client: PoolClient): Promise<{ status: "ready" }> {
  const database = await client.query<{ ok: number }>("SELECT 1 AS ok");
  const migration = await client.query<{ name: string }>("SELECT name FROM public.pgmigrations ORDER BY run_on DESC LIMIT 1");
  const cron = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM cron.job WHERE jobname = 'deledger-catch-up'");
  const backupReady = isBackupReady(process.env.BACKUP_MODE, process.env.BACKUP_TARGET);
  if (database.rows[0]?.ok !== 1 || !migration.rows[0] || cron.rows[0]?.count !== "1" || !backupReady) {
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
