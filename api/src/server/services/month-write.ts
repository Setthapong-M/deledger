import { lockOwner } from "../db/rls.js";
import type { Prisma } from "../../generated/prisma/client.js";
import { now } from "../domain/clock.js";
import { assertIsoDate, dateValue, dateText, currentBusinessDate, isFinalDay, nextMonthStart } from "../domain/calendar.js";
import { deriveReconciliation } from "../domain/month-view.js";
import { DomainError } from "../domain/errors.js";
import { parseMoney } from "../domain/money.js";
import type { MonthView, SetupKind } from "../domain/contracts.js";
import { getMonthProjection, getMonthView } from "../repositories/months.js";

export type MutationContext = { client: Prisma.TransactionClient; ownerId: string; requestId: string };
export type RevisionInput = { monthStart: string; expectedRevision: string };

export async function updateIncome(context: MutationContext, input: RevisionInput & { income: string }): Promise<MonthView> {
  const amount = parseAmount(input.income, "amount");
  await lockMonth(context, input.monthStart, input.expectedRevision);
  await context.client.reporting_month.update({where:{owner_id_month_start:monthWhere(context,input.monthStart)},data:{income_amount:amount,updated_at:now(),revision:{increment:1}}});
  return requiredView(context, input.monthStart);
}

export async function updateEndingBalance(context: MutationContext, input: RevisionInput & { endingBalance: string }): Promise<MonthView> {
  const amount = parseAmount(input.endingBalance, "amount");
  await lockMonth(context, input.monthStart, input.expectedRevision);
  await context.client.reporting_month.update({where:{owner_id_month_start:monthWhere(context,input.monthStart)},data:{ending_balance_amount:amount,updated_at:now(),revision:{increment:1}}});
  return requiredView(context, input.monthStart);
}

export async function recordSnapshot(context: MutationContext, input: RevisionInput & { observedOn: string; amount: string }): Promise<MonthView> {
  try { assertIsoDate(input.observedOn); } catch { throw new DomainError("INVALID_INPUT", "วันที่ Snapshot ไม่ถูกต้อง", "observedOn"); }
  const amount = parseAmount(input.amount, "amount");
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MONTH_NOT_OPEN", "บันทึก Snapshot ได้เฉพาะเดือนที่เปิดอยู่");
  if (input.observedOn < dateText(month.tracked_from) || input.observedOn >= nextMonthStart(input.monthStart)) throw new DomainError("INVALID_INPUT", "วันที่ Snapshot อยู่นอกช่วงที่ติดตาม", "observedOn");
  await context.client.balance_snapshot.create({data:{...monthWhere(context,input.monthStart),observed_on:dateValue(input.observedOn),amount,recorded_at:now()}});
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function addRecurringExpense(context: MutationContext, input: RevisionInput & { name: string; kind: SetupKind; fixedAmount?: string | null }): Promise<MonthView> {
  const setup = normalizeSetup(input.name, input.kind, input.fixedAmount);
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MONTH_NOT_OPEN", "แก้รายการประจำได้เฉพาะเดือนที่เปิดอยู่");
  const last = await context.client.monthly_recurring_expense.findFirst({where:monthWhere(context,input.monthStart),orderBy:{position:'desc'}});
  await context.client.monthly_recurring_expense.create({data:{...monthWhere(context,input.monthStart),position:(last?.position ?? 0)+1,name:setup.name,kind:setup.kind,fixed_amount:setup.fixedAmount}});
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function editRecurringExpense(context: MutationContext, input: RevisionInput & { setupItemId: string; name: string; kind: SetupKind; fixedAmount?: string | null }): Promise<MonthView> {
  const setup = normalizeSetup(input.name, input.kind, input.fixedAmount);
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MONTH_NOT_OPEN", "แก้รายการประจำได้เฉพาะเดือนที่เปิดอยู่");
  const item = await setupItem(context, input.monthStart, input.setupItemId);
  if (item.detail_exists) throw new DomainError("SETUP_ITEM_CONFIRMED", "รายการนี้ยืนยันแล้ว ต้องยกเลิกก่อนแก้ไข");
  await context.client.monthly_recurring_expense.updateMany({where:{...monthWhere(context,input.monthStart),id:input.setupItemId},data:{name:setup.name,kind:setup.kind,fixed_amount:setup.fixedAmount}});
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
    await context.client.monthly_recurring_expense.updateMany({where:{...monthWhere(context,input.monthStart),id:input.setupItemId},data:{name,kind,fixed_amount:fixedAmount}});
  }
  if (input.isPaused !== undefined) {
    await context.client.monthly_recurring_expense.updateMany({where:{...monthWhere(context,input.monthStart),id:input.setupItemId},data:{is_paused:input.isPaused}});
  }
  if (!hasDefinitionChange && input.isPaused === undefined) throw new DomainError("INVALID_INPUT", "ต้องส่งข้อมูลที่ต้องการแก้ไข");
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function pauseRecurringExpense(context: MutationContext, input: RevisionInput & { setupItemId: string; paused: boolean }): Promise<MonthView> {
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MONTH_NOT_OPEN", "พักรายการได้เฉพาะเดือนที่เปิดอยู่");
  await setupItem(context, input.monthStart, input.setupItemId);
  await context.client.monthly_recurring_expense.updateMany({where:{...monthWhere(context,input.monthStart),id:input.setupItemId},data:{is_paused:input.paused}});
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function reorderRecurringExpenses(context: MutationContext, input: RevisionInput & { setupItemIds: string[] }): Promise<MonthView> {
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MONTH_NOT_OPEN", "จัดลำดับได้เฉพาะเดือนที่เปิดอยู่");
  const rows = await context.client.monthly_recurring_expense.findMany({where:monthWhere(context,input.monthStart)});
  if (new Set(input.setupItemIds).size !== input.setupItemIds.length || rows.length !== input.setupItemIds.length || rows.some(row=>!input.setupItemIds.includes(row.id))) throw new DomainError("INVALID_INPUT", "ต้องส่งรายการทั้งหมดครั้งเดียวเพื่อจัดลำดับ", "setupItemIds");
  for (const [index,id] of input.setupItemIds.entries()) {
    await context.client.monthly_recurring_expense.updateMany({where:{...monthWhere(context,input.monthStart),id},data:{position:index+1}});
  }
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function confirmExpenseDetail(context: MutationContext, input: RevisionInput & { setupItemId: string; amount?: string; replace?: boolean }): Promise<MonthView> {
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  const setup = await setupItem(context, input.monthStart, input.setupItemId);
  if (month.closed_at !== null && !input.replace) throw new DomainError("MONTH_NOT_OPEN", "ยืนยันรายการได้เฉพาะเดือนที่เปิดอยู่");
  const where={...monthWhere(context,input.monthStart),setup_item_id:input.setupItemId};
  const existing = await context.client.monthly_expense_detail.findFirst({where});
  if (existing && !input.replace) throw new DomainError("DETAIL_ALREADY_CONFIRMED", "รายการนี้ยืนยันแล้ว");
  if (existing?.confirmed_kind === "fixed") throw new DomainError("SETUP_ITEM_CONFIRMED", "รายการ Fixed ต้องยกเลิกก่อนยืนยันใหม่");
  const amount = setup.kind === "fixed" ? setup.fixed_amount! : parseAmount(input.amount, "amount");
  if (existing) await context.client.monthly_expense_detail.deleteMany({where});
  await context.client.monthly_expense_detail.create({data:{...where,confirmed_name:setup.name,confirmed_kind:setup.kind,confirmed_amount:amount,confirmed_at:now()}});
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function cancelExpenseDetail(context: MutationContext, input: RevisionInput & { setupItemId: string }): Promise<MonthView> {
  await lockMonth(context, input.monthStart, input.expectedRevision);
  const removed = await context.client.monthly_expense_detail.deleteMany({where:{...monthWhere(context,input.monthStart),setup_item_id:input.setupItemId}});
  if (removed.count === 0) throw new DomainError("SETUP_ITEM_NOT_FOUND", "ยังไม่มีรายการที่ยืนยันไว้");
  await bumpRevision(context, input.monthStart);
  return requiredView(context, input.monthStart);
}

export async function manualClose(context: MutationContext, input: RevisionInput): Promise<MonthView> {
  const month = await lockMonth(context, input.monthStart, input.expectedRevision);
  if (month.closed_at !== null) throw new DomainError("MANUAL_CLOSE_NOT_ALLOWED", "เดือนนี้ปิดแล้ว");
  if (!isFinalDay(input.monthStart,currentBusinessDate())) throw new DomainError("MANUAL_CLOSE_NOT_ALLOWED", "ปิดเดือนได้เฉพาะวันสุดท้ายของเดือน");
  const projection = await getMonthProjection(context.client, context.ownerId, input.monthStart);
  if (!projection || projection.startingBalance === null || projection.income === null || projection.endingBalance === null) throw new DomainError("SUMMARY_INCOMPLETE", "กรอก Starting Balance, Income และ Ending Balance ให้ครบก่อนปิดเดือน");
  const monthlySpending = projection.monthlySpending;
  const reconciliation = deriveReconciliation({ lifecycle: "closed", startingBalance: projection.startingBalance, income: projection.income, endingBalance: projection.endingBalance, monthlySpending, detailTotal: projection.detailTotal });
  if (reconciliation.state === "inconsistent") throw new DomainError("SUMMARY_INCONSISTENT", "ยอดรวมกับรายละเอียดรายจ่ายยังไม่สอดคล้องกัน");
  await context.client.reporting_month.update({where:{owner_id_month_start:monthWhere(context,input.monthStart)},data:{closed_at:now(),closed_by:'manual',updated_at:now(),revision:{increment:1}}});
  return requiredView(context, input.monthStart);
}

function monthWhere(context: MutationContext, monthStart: string) {
  return {owner_id:context.ownerId,month_start:dateValue(monthStart)};
}

async function lockMonth(context: MutationContext, monthStart: string, expectedRevision: string) {
  // A User lock serializes writes, archive/restore and catch-up before checking revisions.
  await lockOwner(context.client,context.ownerId);
  const row = await context.client.reporting_month.findUnique({where:{owner_id_month_start:monthWhere(context,monthStart)}});
  if (!row) throw new DomainError("MONTH_NOT_FOUND", "ไม่พบเดือนนี้");
  if (row.revision.toString() !== expectedRevision) {
    const current = await getMonthView(context.client,context.ownerId,monthStart);
    throw new DomainError("REVISION_CONFLICT", "มีข้อมูลใหม่จากอีกหน้าจอ โหลดข้อมูลล่าสุดแล้ว",null,current);
  }
  return row;
}

async function setupItem(context: MutationContext, monthStart: string, setupItemId: string): Promise<{name:string;kind:SetupKind;fixed_amount:string|null;detail_exists:boolean}> {
  const where=monthWhere(context,monthStart);
  const row=await context.client.monthly_recurring_expense.findFirst({where:{...where,id:setupItemId}});
  if (!row) throw new DomainError("SETUP_ITEM_NOT_FOUND", "ไม่พบรายการรายจ่ายประจำ");
  const detail=await context.client.monthly_expense_detail.findFirst({where:{...where,setup_item_id:setupItemId}});
  return {name:row.name,kind:row.kind as SetupKind,fixed_amount:row.fixed_amount?.toFixed(2) ?? null,detail_exists:detail!==null};
}

async function bumpRevision(context: MutationContext, monthStart: string): Promise<void> {
  await context.client.reporting_month.update({where:{owner_id_month_start:monthWhere(context,monthStart)},data:{revision:{increment:1},updated_at:now()}});
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
