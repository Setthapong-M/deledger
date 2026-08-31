import type { PoolClient } from "pg";
import { DomainError } from "../domain/errors";

export async function readReadiness(client: PoolClient): Promise<{ status: "ready" }> {
  const database = await client.query<{ ok: number }>("SELECT 1 AS ok");
  const migration = await client.query<{ name: string }>("SELECT name FROM public.pgmigrations ORDER BY run_on DESC LIMIT 1");
  const cron = await client.query<{ count: string }>("SELECT count(*)::text AS count FROM cron.job WHERE jobname = 'deledger-catch-up'");
  const backupMounted = process.env.BACKUP_TARGET === "/mnt/deledger-backups";
  if (database.rows[0]?.ok !== 1 || !migration.rows[0] || cron.rows[0]?.count !== "1" || !backupMounted) {
    throw new DomainError("SERVICE_UNAVAILABLE", "บริการยังไม่พร้อมใช้งาน");
  }
  return { status: "ready" };
}
