import type { Prisma } from '../../generated/prisma/client.js';
import { lockOwner } from '../db/rls.js';
import { assertIsoDate, currentBusinessDate, dateText, dateValue, nextMonthStart, previousMonthStart } from '../domain/calendar.js';
import { now } from '../domain/clock.js';
import type { MonthView } from '../domain/contracts.js';
import { DomainError } from '../domain/errors.js';
import { parseMoney } from '../domain/money.js';
import { getMonthView } from '../repositories/months.js';
import type { MutationContext } from './month-write.js';

type TrackingInput = { startDate: string; openingBalance: string; income: string };
type Capability = { allowed: boolean; reason: string | null; minDate: string | null; maxDate: string | null };
export type TrackingOptions = {
  businessDate: string;
  earliestMonth: string | null;
  earliestRevision: string | null;
  prepend: Capability;
  restart: Capability & { month: string | null; expectedRevision: string | null };
};

export async function readTrackingOptions(client: Prisma.TransactionClient, ownerId: string): Promise<TrackingOptions> {
  const today = currentBusinessDate();
  const currentStart = `${today.slice(0, 7)}-01`;
  const user = await client.app_user.findUnique({ where: { id: ownerId } });
  if (!user) throw new DomainError('USER_NOT_INVITED', 'ไม่พบบัญชีผู้ใช้');
  const archived = await client.user_archive_period.findFirst({ where: { owner_id: ownerId, restored_at: null } });
  const earliest = await client.reporting_month.findFirst({ where: { owner_id: ownerId }, orderBy: { month_start: 'asc' } });
  const current = await client.reporting_month.findUnique({ where: { owner_id_month_start: { owner_id: ownerId, month_start: dateValue(currentStart) } } });
  const blocked = archived ? 'USER_ARCHIVED' : user.resume_required_at !== null ? 'RESUME_REQUIRED' : null;
  const earliestStart = earliest ? dateText(earliest.month_start) : null;
  const prependReason = blocked ?? (!earliest ? 'ONBOARDING_REQUIRED' : earliest.opening_source !== 'supplied' || earliest.opening_balance_input === null || earliestStart! > currentStart ? 'HISTORY_BOUNDARY_CONFLICT' : null);
  let restartReason = blocked ?? (!current ? 'MONTH_NOT_FOUND' : null);
  if (current && !restartReason) {
    const where = { owner_id: ownerId, month_start: current.month_start };
    const previous = await client.reporting_month.findUnique({ where: { owner_id_month_start: { owner_id: ownerId, month_start: dateValue(previousMonthStart(currentStart)) } } });
    const snapshots = await client.balance_snapshot.count({ where });
    const details = await client.monthly_expense_detail.count({ where });
    if (current.closed_at !== null || current.closed_by !== null || current.opening_source !== 'prior_ending' || current.opening_balance_input !== null || current.income_amount !== null || current.ending_balance_amount !== null || current.revision !== 0n || dateText(current.tracked_from) !== currentStart || previous === null || previous.ending_balance_amount !== null || snapshots !== 0 || details !== 0) restartReason = 'RESTART_NOT_ALLOWED';
  }
  let minDate = earliestStart;
  if (minDate) for (let index = 0; index < 24; index++) minDate = previousMonthStart(minDate);
  const lastDay = earliestStart ? dateValue(earliestStart) : null;
  if (lastDay) lastDay.setUTCDate(lastDay.getUTCDate() - 1);
  return {
    businessDate: today,
    earliestMonth: earliestStart?.slice(0, 7) ?? null,
    earliestRevision: earliest?.revision.toString() ?? null,
    prepend: { allowed: prependReason === null, reason: prependReason, minDate: prependReason ? null : minDate, maxDate: !prependReason && lastDay ? dateText(lastDay) : null },
    restart: { allowed: restartReason === null, reason: restartReason, month: restartReason ? null : today.slice(0, 7), expectedRevision: restartReason ? null : current!.revision.toString(), minDate: restartReason ? null : currentStart, maxDate: restartReason ? null : today },
  };
}

export async function backfillMonths(context: MutationContext, input: TrackingInput & { expectedEarliestMonth: string; expectedEarliestRevision: string }): Promise<{ month: MonthView; createdMonthKeys: string[]; affectedMonthKeys: string[] }> {
  const { client, ownerId } = context;
  validateStart(input.startDate);
  const openingBalance = parseMoney(input.openingBalance);
  const income = parseMoney(input.income);
  await lockOwner(client, ownerId);
  const options = await readTrackingOptions(client, ownerId);
  if (options.prepend.reason === 'USER_ARCHIVED') throw new DomainError('USER_ARCHIVED', 'บัญชีนี้ถูกพักใช้งาน');
  const current = options.earliestMonth ? await getMonthView(client, ownerId, `${options.earliestMonth}-01`) : null;
  if (!options.prepend.allowed || input.expectedEarliestMonth !== options.earliestMonth || input.expectedEarliestRevision !== options.earliestRevision) throw new DomainError('HISTORY_BOUNDARY_CONFLICT', 'ขอบเขตประวัติเปลี่ยนไปหรือเพิ่มเดือนไม่ได้ กรุณาโหลดข้อมูลล่าสุด', null, current);
  const first = `${input.startDate.slice(0, 7)}-01`;
  const boundary = `${options.earliestMonth}-01`;
  if (first >= boundary) throw new DomainError('HISTORY_RANGE_OVERLAP', 'เลือกเดือนก่อนเดือนแรกในประวัติ', 'startDate', current);
  const starts: string[] = [];
  for (let start = first; start < boundary; start = nextMonthStart(start)) {
    starts.push(start);
    if (starts.length > 24) throw new DomainError('DATE_RANGE_TOO_LARGE', 'เพิ่มประวัติได้ไม่เกิน 24 เดือนต่อครั้ง', 'startDate');
  }
  const existing = await client.reporting_month.count({ where: { owner_id: ownerId, month_start: { gte: dateValue(first), lt: dateValue(boundary) } } });
  if (existing) throw new DomainError('HISTORY_RANGE_OVERLAP', 'ช่วงที่เลือกมีข้อมูลอยู่แล้ว', 'startDate', current);
  const timestamp = now();
  await client.reporting_month.createMany({ data: starts.map((start, index) => ({ owner_id: ownerId, month_start: dateValue(start), tracked_from: dateValue(index === 0 ? input.startDate : start), opening_source: index === 0 ? 'supplied' : 'prior_ending', opening_balance_input: index === 0 ? openingBalance : null, income_amount: index === 0 ? income : null, closed_at: timestamp, closed_by: 'automatic', revision: 1n })) });
  const createdMonthKeys = starts.map(start => start.slice(0, 7));
  const month = (await getMonthView(client, ownerId, first))!;
  return { month, createdMonthKeys, affectedMonthKeys: [...createdMonthKeys] };
}

export async function restartTracking(context: MutationContext, input: TrackingInput & { monthStart: string; expectedRevision: string }): Promise<MonthView> {
  const { client, ownerId } = context;
  validateStart(input.startDate);
  const openingBalance = parseMoney(input.openingBalance);
  const income = parseMoney(input.income);
  const currentStart = `${currentBusinessDate().slice(0, 7)}-01`;
  if (input.monthStart !== currentStart || input.startDate < currentStart) throw new DomainError('INVALID_INPUT', 'เริ่มใหม่ได้เฉพาะเดือนปัจจุบัน', 'startDate');
  await lockOwner(client, ownerId);
  const options = await readTrackingOptions(client, ownerId);
  if (options.restart.reason === 'USER_ARCHIVED') throw new DomainError('USER_ARCHIVED', 'บัญชีนี้ถูกพักใช้งาน');
  const current = await getMonthView(client, ownerId, currentStart);
  if (current && current.revision !== input.expectedRevision) throw new DomainError('REVISION_CONFLICT', 'มีข้อมูลใหม่จากอีกหน้าจอ กรุณาโหลดข้อมูลล่าสุด', null, current);
  if (!options.restart.allowed) throw new DomainError('RESTART_NOT_ALLOWED', 'เดือนนี้เริ่มติดตามใหม่ไม่ได้ กรุณาแก้ข้อมูลในประวัติ', null, current);
  await client.reporting_month.update({ where: { owner_id_month_start: { owner_id: ownerId, month_start: dateValue(currentStart) } }, data: { opening_source: 'supplied', opening_balance_input: openingBalance, income_amount: income, tracked_from: dateValue(input.startDate), updated_at: now(), revision: { increment: 1 } } });
  return (await getMonthView(client, ownerId, currentStart))!;
}

function validateStart(startDate: string): void {
  try { assertIsoDate(startDate); } catch { throw new DomainError('INVALID_INPUT', 'วันที่เริ่มไม่ถูกต้อง', 'startDate'); }
  if (startDate > currentBusinessDate()) throw new DomainError('INVALID_INPUT', 'วันเริ่มต้องไม่เกินวันที่ระบบ', 'startDate');
}
