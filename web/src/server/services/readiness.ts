import type { PoolClient } from "pg";
import { DomainError } from "../domain/errors";
import { readdirSync, statSync } from "node:fs";

export async function readReadiness(client: PoolClient): Promise<{ status: "ready" }> {
  const database = await client.query<{ ok: number }>("SELECT 1 AS ok");
  const migration = await client.query<{ name: string }>("SELECT name FROM public.pgmigrations ORDER BY run_on DESC LIMIT 1");
  const cron = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM cron.job WHERE jobname = 'deledger-catch-up'");
  const backupMounted = process.env.BACKUP_TARGET === "/mnt/deledger-backups" && hasFreshBackup(process.env.BACKUP_TARGET) && hasFreshRestoreMarker(process.env.BACKUP_TARGET);
  if (database.rows[0]?.ok !== 1 || !migration.rows[0] || cron.rows[0]?.count !== "1" || !backupMounted) {
    throw new DomainError("SERVICE_UNAVAILABLE", "บริการยังไม่พร้อมใช้งาน");
  }
  return { status: "ready" };
}

function hasFreshBackup(target: string | undefined): boolean {
  if (!target) return false;
  try {
    const newest = readdirSync(target).filter((name) => name.endsWith(".dump.age")).map((name) => statSync(`${target}/${name}`).mtimeMs).sort((left, right) => right - left)[0];
    return newest !== undefined && Date.now() - newest < 26 * 60 * 60 * 1000;
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
