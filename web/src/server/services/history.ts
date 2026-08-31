import type { PoolClient } from "pg";
import type { MonthKey, MonthView } from "../domain/contracts";
import { getMonthView, listMonthKeys } from "../repositories/months";

export type HistoryMonth = { kind: "month"; id: MonthKey; view: MonthView };
export type TrackingGap = { kind: "tracking_gap"; id: string; archivedAt: string; restoredAt: string | null };
export type HistoryEntry = HistoryMonth | TrackingGap;

export async function listHistory(client: PoolClient, ownerId: string, options: { before?: MonthKey; limit?: number } = {}): Promise<HistoryEntry[]> {
  const limit = Math.max(1, Math.min(options.limit ?? 24, 24));
  const monthKeys = (await listMonthKeys(client, ownerId)).filter((key) => !options.before || key < options.before);
  const selected = monthKeys.slice(0, limit);
  const months: HistoryMonth[] = [];
  for (const key of selected) {
    const view = await getMonthView(client, ownerId, `${key}-01`);
    if (view) months.push({ kind: "month", id: key as MonthKey, view });
  }
  const archiveRows = await client.query<{ id: string; archived_at: string; restored_at: string | null }>("SELECT id::text, archived_at::text, restored_at::text FROM public.user_archive_period WHERE owner_id = $1 ORDER BY archived_at DESC", [ownerId]);
  const gaps: TrackingGap[] = archiveRows.rows
    .filter((row) => row.restored_at !== null && monthOf(row.archived_at) < monthOf(row.restored_at!))
    .map((row) => ({ kind: "tracking_gap", id: `gap:${row.id}`, archivedAt: row.archived_at, restoredAt: row.restored_at }));
  return [...months, ...gaps].sort((left, right) => historySortKey(right).localeCompare(historySortKey(left)));
}

function monthOf(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 7);
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit" }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? value.slice(0, 4);
  const month = parts.find((part) => part.type === "month")?.value ?? value.slice(5, 7);
  return `${year}-${month}`;
}

function historySortKey(entry: HistoryEntry): string {
  return entry.kind === "month" ? entry.id : monthOf(entry.archivedAt);
}
