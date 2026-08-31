import type { PoolClient } from "pg";
import { assertIsoDate } from "../domain/calendar";
import { deriveReconciliation } from "../domain/month-view";
import { DomainError } from "../domain/errors";
import { parseMoney } from "../domain/money";
import type { MonthView, SetupKind } from "../domain/contracts";
import { getMonthProjection, getMonthView } from "../repositories/months";

export type MutationContext = { client: PoolClient; ownerId: string; requestId: string };
export type RevisionInput = { monthStart: string; expectedRevision: string };

export async function updateIncome(context: MutationContext, input: RevisionInput & { income: string }): Promise<MonthView> {
  const amount = parseAmount(input.income, "amount");
  await lockMonth(context, input.monthStart, input.expectedRevision);
  await context.client.query("UPDATE public.reporting_month SET income_amount = $3, updated_at = clock_timestamp(), revision = revision + 1 WHERE owner_id = $1 AND month_start = $2", [context.ownerId, input.monthStart, amount]);
  return requiredView(context, input.monthStart);
}

export async function updateEndingBalance(context: MutationContext, input: RevisionInput & { endingBalance: string }): Promise<MonthView> {
  const amount = parseAmount(input.endingBalance, "amount");
  await lockMonth(context, input.monthStart, input.expectedRevision);
  await context.client.query("UPDATE public.reporting_month SET ending_balance_amount = $3, updated_at = clock_timestamp(), revision = revision + 1 WHERE owner_id = $1 AND month_start = $2", [context.ownerId, input.monthStart, amount]);
  return requiredView(context, input.monthStart);
}

export async function recordSnapshot(context: MutationContext, input: RevisionInput & { observedOn: string; amount: string }): Promise<MonthView> {
  try { assertIsoDate(input.observedOn); } catch { throw new DomainError("INVALID_INPUT", "วันที่ Snapshot ไม่ถูกต้อง", "observedOn"); }
  const amount = parseAmount(input.amount, "amount");
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MONTH_NOT_OPEN", "บันทึก Snapshot ได้เฉพาะเดือนที่เปิดอยู่");
  const allowed = await context.client.query(
    "SELECT 1 FROM public.reporting_month WHERE owner_id = $1 AND month_start = $2 AND $3::date >= tracked_from AND $3::date < (month_start + interval '1 month')::date",
    [context.ownerId, input.monthStart, input.observedOn],
  );
  if (allowed.rowCount === 0) throw new DomainError("INVALID_INPUT", "วันที่ Snapshot อยู่นอกช่วงที่ติดตาม", "observedOn");
  await context.client.query("INSERT INTO public.balance_snapshot (owner_id, month_start, observed_on, amount) VALUES ($1, $2, $3, $4)", [context.ownerId, input.monthStart, input.observedOn, amount]);
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function addRecurringExpense(context: MutationContext, input: RevisionInput & { name: string; kind: SetupKind; fixedAmount?: string | null }): Promise<MonthView> {
  const setup = normalizeSetup(input.name, input.kind, input.fixedAmount);
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MONTH_NOT_OPEN", "แก้รายการประจำได้เฉพาะเดือนที่เปิดอยู่");
  const position = await context.client.query<{ next_position: number }>("SELECT coalesce(max(position), 0) + 1 AS next_position FROM public.monthly_recurring_expense WHERE owner_id = $1 AND month_start = $2", [context.ownerId, input.monthStart]);
  await context.client.query("INSERT INTO public.monthly_recurring_expense (owner_id, month_start, position, name, kind, fixed_amount) VALUES ($1, $2, $3, $4, $5, $6)", [context.ownerId, input.monthStart, position.rows[0]?.next_position ?? 1, setup.name, setup.kind, setup.fixedAmount]);
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function editRecurringExpense(context: MutationContext, input: RevisionInput & { setupItemId: string; name: string; kind: SetupKind; fixedAmount?: string | null }): Promise<MonthView> {
  const setup = normalizeSetup(input.name, input.kind, input.fixedAmount);
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MONTH_NOT_OPEN", "แก้รายการประจำได้เฉพาะเดือนที่เปิดอยู่");
  const item = await setupItem(context, input.monthStart, input.setupItemId);
  if (item.detail_exists) throw new DomainError("SETUP_ITEM_CONFIRMED", "รายการนี้ยืนยันแล้ว ต้องยกเลิกก่อนแก้ไข");
  await context.client.query("UPDATE public.monthly_recurring_expense SET name = $4, kind = $5, fixed_amount = $6 WHERE owner_id = $1 AND month_start = $2 AND id = $3", [context.ownerId, input.monthStart, input.setupItemId, setup.name, setup.kind, setup.fixedAmount]);
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function updateRecurringExpense(context: MutationContext, input: RevisionInput & { setupItemId: string; name?: string; kind?: SetupKind; fixedAmount?: string | null; isPaused?: boolean }): Promise<MonthView> {
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MONTH_NOT_OPEN", "แก้รายการประจำได้เฉพาะเดือนที่เปิดอยู่");
  const item = await setupItem(context, input.monthStart, input.setupItemId);
  const hasDefinitionChange = input.name !== undefined || input.kind !== undefined || input.fixedAmount !== undefined;
  let name = item.name;
  let kind = item.kind;
  let fixedAmount = item.fixed_amount;
  if (hasDefinitionChange) {
    if (item.detail_exists) throw new DomainError("SETUP_ITEM_CONFIRMED", "รายการนี้ยืนยันแล้ว ต้องยกเลิกก่อนแก้ไข");
    name = input.name ?? item.name;
    kind = input.kind ?? item.kind;
    fixedAmount = input.fixedAmount === undefined ? item.fixed_amount : input.fixedAmount;
    const normalized = normalizeSetup(name, kind, fixedAmount);
    name = normalized.name;
    kind = normalized.kind;
    fixedAmount = normalized.fixedAmount;
  }
  if (hasDefinitionChange) {
    await context.client.query("UPDATE public.monthly_recurring_expense SET name = $4, kind = $5, fixed_amount = $6 WHERE owner_id = $1 AND month_start = $2 AND id = $3", [context.ownerId, input.monthStart, input.setupItemId, name, kind, fixedAmount]);
  }
  if (input.isPaused !== undefined) {
    await context.client.query("UPDATE public.monthly_recurring_expense SET is_paused = $4 WHERE owner_id = $1 AND month_start = $2 AND id = $3", [context.ownerId, input.monthStart, input.setupItemId, input.isPaused]);
  }
  if (!hasDefinitionChange && input.isPaused === undefined) throw new DomainError("INVALID_INPUT", "ต้องส่งข้อมูลที่ต้องการแก้ไข");
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function pauseRecurringExpense(context: MutationContext, input: RevisionInput & { setupItemId: string; paused: boolean }): Promise<MonthView> {
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MONTH_NOT_OPEN", "พักรายการได้เฉพาะเดือนที่เปิดอยู่");
  await setupItem(context, input.monthStart, input.setupItemId);
  await context.client.query("UPDATE public.monthly_recurring_expense SET is_paused = $4 WHERE owner_id = $1 AND month_start = $2 AND id = $3", [context.ownerId, input.monthStart, input.setupItemId, input.paused]);
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function reorderRecurringExpenses(context: MutationContext, input: RevisionInput & { setupItemIds: string[] }): Promise<MonthView> {
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MONTH_NOT_OPEN", "จัดลำดับได้เฉพาะเดือนที่เปิดอยู่");
  const rows = await context.client.query<{ id: string }>("SELECT id::text FROM public.monthly_recurring_expense WHERE owner_id = $1 AND month_start = $2 ORDER BY position", [context.ownerId, input.monthStart]);
  if (new Set(input.setupItemIds).size !== input.setupItemIds.length || rows.rows.length !== input.setupItemIds.length || rows.rows.some((row) => !input.setupItemIds.includes(row.id))) {
    throw new DomainError("INVALID_INPUT", "ต้องส่งรายการทั้งหมดครั้งเดียวเพื่อจัดลำดับ", "setupItemIds");
  }
  await context.client.query("WITH ordered(id, position) AS (SELECT value, ord::integer FROM unnest($3::uuid[]) WITH ORDINALITY AS values(value, ord)) UPDATE public.monthly_recurring_expense AS item SET position = ordered.position FROM ordered WHERE item.owner_id = $1 AND item.month_start = $2 AND item.id = ordered.id", [context.ownerId, input.monthStart, input.setupItemIds]);
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function confirmExpenseDetail(context: MutationContext, input: RevisionInput & { setupItemId: string; amount?: string; replace?: boolean }): Promise<MonthView> {
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  const setup = await setupItem(context, input.monthStart, input.setupItemId);
  if (month.closed_at !== null && !input.replace) throw new DomainError("MONTH_NOT_OPEN", "ยืนยันรายการได้เฉพาะเดือนที่เปิดอยู่");
  const existing = await context.client.query<{ confirmed_kind: SetupKind }>("SELECT confirmed_kind FROM public.monthly_expense_detail WHERE owner_id = $1 AND month_start = $2 AND setup_item_id = $3", [context.ownerId, input.monthStart, input.setupItemId]);
  if (existing.rows[0] && !input.replace) throw new DomainError("DETAIL_ALREADY_CONFIRMED", "รายการนี้ยืนยันแล้ว");
  if (existing.rows[0] && existing.rows[0].confirmed_kind === "fixed") throw new DomainError("SETUP_ITEM_CONFIRMED", "รายการ Fixed ต้องยกเลิกก่อนยืนยันใหม่");
  const amount = setup.kind === "fixed" ? setup.fixed_amount! : parseAmount(input.amount, "amount");
  if (existing.rows[0]) await context.client.query("DELETE FROM public.monthly_expense_detail WHERE owner_id = $1 AND month_start = $2 AND setup_item_id = $3", [context.ownerId, input.monthStart, input.setupItemId]);
  await context.client.query("INSERT INTO public.monthly_expense_detail (owner_id, month_start, setup_item_id, confirmed_name, confirmed_kind, confirmed_amount) VALUES ($1, $2, $3, $4, $5, $6)", [context.ownerId, input.monthStart, input.setupItemId, setup.name, setup.kind, amount]);
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function cancelExpenseDetail(context: MutationContext, input: RevisionInput & { setupItemId: string }): Promise<MonthView> {
  await lockMonth(context, input.monthStart, input.expectedRevision);
  const removed = await context.client.query("DELETE FROM public.monthly_expense_detail WHERE owner_id = $1 AND month_start = $2 AND setup_item_id = $3", [context.ownerId, input.monthStart, input.setupItemId]);
  if (removed.rowCount === 0) throw new DomainError("SETUP_ITEM_NOT_FOUND", "ยังไม่มีรายการที่ยืนยันไว้");
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function manualClose(context: MutationContext, input: RevisionInput): Promise<MonthView> {
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MANUAL_CLOSE_NOT_ALLOWED", "เดือนนี้ปิดแล้ว");
  const day = await context.client.query<{ allowed: boolean }>("SELECT public.current_business_date() = ((month_start + interval '1 month')::date - 1) AS allowed FROM public.reporting_month WHERE owner_id = $1 AND month_start = $2", [context.ownerId, input.monthStart]);
  if (!day.rows[0]?.allowed) throw new DomainError("MANUAL_CLOSE_NOT_ALLOWED", "ปิดเดือนได้เฉพาะวันสุดท้ายของเดือน");
  const projection = await getMonthProjection(context.client, context.ownerId, input.monthStart);
  if (!projection || projection.startingBalance === null || projection.income === null || projection.endingBalance === null) throw new DomainError("SUMMARY_INCOMPLETE", "กรอก Starting Balance, Income และ Ending Balance ให้ครบก่อนปิดเดือน");
  const spendingResult = await context.client.query<{ monthly_spending: string }>("SELECT ($1::numeric + $2::numeric - $3::numeric)::text AS monthly_spending", [projection.startingBalance, projection.income, projection.endingBalance]);
  const reconciliation = deriveReconciliation({ lifecycle: "closed", startingBalance: projection.startingBalance, income: projection.income, endingBalance: projection.endingBalance, monthlySpending: spendingResult.rows[0]!.monthly_spending, detailTotal: projection.detailTotal });
  if (reconciliation.state === "inconsistent") throw new DomainError("SUMMARY_INCONSISTENT", "ยอดรวมกับรายละเอียดรายจ่ายยังไม่สอดคล้องกัน");
  await context.client.query("UPDATE public.reporting_month SET closed_at = clock_timestamp(), closed_by = 'manual', updated_at = clock_timestamp(), revision = revision + 1 WHERE owner_id = $1 AND month_start = $2 AND closed_at IS NULL", [context.ownerId, input.monthStart]);
  return requiredView(context, input.monthStart);
}

async function lockMonth(context: MutationContext, monthStart: string, expectedRevision: string): Promise<{ closed_at: string | null; tracked_from: string; revision: string }> {
  await context.client.query("SELECT id FROM public.app_user WHERE id = $1 FOR UPDATE", [context.ownerId]);
  const result = await context.client.query<{ closed_at: string | null; tracked_from: string; revision: string }>("SELECT closed_at, tracked_from::text, revision::text FROM public.reporting_month WHERE owner_id = $1 AND month_start = $2 FOR UPDATE", [context.ownerId, monthStart]);
  const row = result.rows[0];
  if (!row) throw new DomainError("MONTH_NOT_FOUND", "ไม่พบเดือนนี้");
  await context.client.query("SELECT id FROM public.monthly_recurring_expense WHERE owner_id = $1 AND month_start = $2 ORDER BY position FOR UPDATE", [context.ownerId, monthStart]);
  // The User/month row lock serializes all detail mutations. A plain read here
  // preserves the narrow SELECT/INSERT/DELETE grant on confirmation snapshots.
  await context.client.query("SELECT setup_item_id FROM public.monthly_expense_detail WHERE owner_id = $1 AND month_start = $2 ORDER BY setup_item_id", [context.ownerId, monthStart]);
  if (row.revision !== expectedRevision) {
    const current = await getMonthView(context.client, context.ownerId, monthStart);
    throw new DomainError("REVISION_CONFLICT", "มีข้อมูลใหม่จากอีกหน้าจอ โหลดข้อมูลล่าสุดแล้ว", null, current);
  }
  return row;
}

async function setupItem(context: MutationContext, monthStart: string, setupItemId: string): Promise<{ name: string; kind: SetupKind; fixed_amount: string | null; detail_exists?: boolean }> {
  const result = await context.client.query<{ name: string; kind: SetupKind; fixed_amount: string | null; detail_exists: boolean }>("SELECT setup.name, setup.kind, setup.fixed_amount::text, EXISTS (SELECT 1 FROM public.monthly_expense_detail AS detail WHERE detail.owner_id = setup.owner_id AND detail.month_start = setup.month_start AND detail.setup_item_id = setup.id) AS detail_exists FROM public.monthly_recurring_expense AS setup WHERE setup.owner_id = $1 AND setup.month_start = $2 AND setup.id = $3 FOR UPDATE", [context.ownerId, monthStart, setupItemId]);
  const row = result.rows[0];
  if (!row) throw new DomainError("SETUP_ITEM_NOT_FOUND", "ไม่พบรายการรายจ่ายประจำ");
  return row;
}

async function bumpRevision(context: MutationContext, monthStart: string): Promise<void> {
  await context.client.query("UPDATE public.reporting_month SET revision = revision + 1, updated_at = clock_timestamp() WHERE owner_id = $1 AND month_start = $2", [context.ownerId, monthStart]);
}

async function requiredView(context: MutationContext, monthStart: string): Promise<MonthView> {
  const view = await getMonthView(context.client, context.ownerId, monthStart);
  if (!view) throw new DomainError("MONTH_NOT_FOUND", "ไม่พบเดือนนี้");
  return view;
}

function normalizeSetup(name: string, kind: SetupKind, fixedAmount: string | null | undefined): { name: string; kind: SetupKind; fixedAmount: string | null } {
  const normalizedName = name.trim();
  if (normalizedName === "" || normalizedName.length > 200) throw new DomainError("INVALID_INPUT", "กรอกรายละเอียดรายจ่ายให้ถูกต้อง", "name");
  if (kind === "fixed") return { name: normalizedName, kind, fixedAmount: parseAmount(fixedAmount, "fixedAmount") };
  if (kind !== "variable") throw new DomainError("INVALID_INPUT", "ประเภทค่าใช้จ่ายไม่ถูกต้อง", "kind");
  if (fixedAmount !== undefined && fixedAmount !== null) throw new DomainError("INVALID_INPUT", "Variable ไม่รับยอดประจำ", "fixedAmount");
  return { name: normalizedName, kind, fixedAmount: null };
}

function parseAmount(value: unknown, field: string): string {
  try { return parseMoney(value); } catch { throw new DomainError("INVALID_INPUT", "ยอดเงินไม่ถูกต้อง", field); }
}
