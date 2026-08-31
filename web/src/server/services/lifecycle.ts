import type { PoolClient } from "pg";
import { DomainError } from "../domain/errors";
import { parseMoney } from "../domain/money";
import { getCurrentMonthStart, getMonthView } from "../repositories/months";
import { getCurrentUser } from "../repositories/users";
import type { MonthView } from "../domain/contracts";

export type LifecycleInput = { openingBalance: string; income: string };

export async function startOnboarding(client: PoolClient, ownerId: string, input: LifecycleInput): Promise<MonthView> {
  const openingBalance = parseMoney(input.openingBalance);
  const income = parseMoney(input.income);
  await client.query("SELECT id FROM public.app_user WHERE id = $1 FOR UPDATE", [ownerId]);
  const existing = await client.query("SELECT 1 FROM public.reporting_month WHERE owner_id = $1 LIMIT 1", [ownerId]);
  if (existing.rowCount !== 0) throw new DomainError("IDENTITY_CONFLICT", "บัญชีนี้เริ่มต้นแล้ว");
  const dateResult = await client.query<{ business_date: string }>("SELECT public.current_business_date()::text AS business_date");
  const businessDate = dateResult.rows[0]!.business_date;
  const monthStart = `${businessDate.slice(0, 7)}-01`;
  await client.query(
    "INSERT INTO public.reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input, income_amount) VALUES ($1, $2, $3, 'supplied', $4, $5)",
    [ownerId, monthStart, businessDate, openingBalance, income],
  );
  const view = await getMonthView(client, ownerId, monthStart);
  if (!view) throw new Error("onboarding month was not created");
  return view;
}

export async function resumeTracking(client: PoolClient, ownerId: string, input: LifecycleInput): Promise<MonthView> {
  const openingBalance = parseMoney(input.openingBalance);
  const income = parseMoney(input.income);
  const user = await getCurrentUserForUpdate(client, ownerId);
  if (user.resumeRequiredAt === null) throw new DomainError("IDENTITY_CONFLICT", "ยังไม่มีช่วงที่ต้องเริ่มติดตามใหม่");
  const dateResult = await client.query<{ business_date: string }>("SELECT public.current_business_date()::text AS business_date");
  const businessDate = dateResult.rows[0]!.business_date;
  const monthStart = `${businessDate.slice(0, 7)}-01`;
  const existing = await client.query("SELECT 1 FROM public.reporting_month WHERE owner_id = $1 AND month_start = $2", [ownerId, monthStart]);
  if (existing.rowCount !== 0) throw new DomainError("IDENTITY_CONFLICT", "เดือนนี้มีข้อมูลอยู่แล้ว");
  const source = await client.query<{ month_start: string }>("SELECT month_start::text FROM public.reporting_month WHERE owner_id = $1 ORDER BY month_start DESC LIMIT 1", [ownerId]);
  await client.query(
    "INSERT INTO public.reporting_month (owner_id, month_start, tracked_from, opening_source, opening_balance_input, income_amount) VALUES ($1, $2, $3, 'supplied', $4, $5)",
    [ownerId, monthStart, businessDate, openingBalance, income],
  );
  if (source.rows[0]) {
    await client.query(
      "INSERT INTO public.monthly_recurring_expense (owner_id, month_start, id, position, name, kind, fixed_amount, is_paused) SELECT owner_id, $2, id, position, name, kind, fixed_amount, is_paused FROM public.monthly_recurring_expense WHERE owner_id = $1 AND month_start = $3",
      [ownerId, monthStart, source.rows[0].month_start],
    );
  }
  await client.query("UPDATE public.app_user SET resume_required_at = NULL WHERE id = $1", [ownerId]);
  const view = await getMonthView(client, ownerId, monthStart);
  if (!view) throw new Error("resume month was not created");
  return view;
}

async function getCurrentUserForUpdate(client: PoolClient, ownerId: string): Promise<{ resumeRequiredAt: string | null }> {
  const result = await client.query<{ resume_required_at: string | null }>("SELECT resume_required_at FROM public.app_user WHERE id = $1 FOR UPDATE", [ownerId]);
  if (!result.rows[0]) throw new DomainError("USER_NOT_INVITED", "ไม่พบบัญชีผู้ใช้");
  return { resumeRequiredAt: result.rows[0].resume_required_at };
}
