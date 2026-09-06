import { lockOwner } from "../db/rls.js";
import type { Prisma } from '../../generated/prisma/client.js';
import { DomainError } from '../domain/errors.js';
import { parseMoney } from '../domain/money.js';
import { currentBusinessDate, dateValue } from '../domain/calendar.js';
import { getMonthView } from '../repositories/months.js';
import type { MonthView } from '../domain/contracts.js';

export type LifecycleInput = { openingBalance: string; income: string };

export async function startOnboarding(client: Prisma.TransactionClient, ownerId: string, input: LifecycleInput): Promise<MonthView> {
  const openingBalance = parseMoney(input.openingBalance);
  const income = parseMoney(input.income);
  await lockOwner(client,ownerId);
  if (await client.reporting_month.findFirst({where:{owner_id:ownerId}})) throw new DomainError('IDENTITY_CONFLICT','บัญชีนี้เริ่มต้นแล้ว');
  return createSuppliedMonth(client,ownerId,openingBalance,income);
}

export async function resumeTracking(client: Prisma.TransactionClient, ownerId: string, input: LifecycleInput): Promise<MonthView> {
  const openingBalance = parseMoney(input.openingBalance);
  const income = parseMoney(input.income);
  await lockOwner(client,ownerId);
  const user=await client.app_user.findUnique({where:{id:ownerId}});
  if(!user) throw new DomainError('USER_NOT_INVITED','ไม่พบบัญชีผู้ใช้');
  if(user.resume_required_at===null) throw new DomainError('IDENTITY_CONFLICT','ยังไม่มีช่วงที่ต้องเริ่มติดตามใหม่');
  const monthStart=`${currentBusinessDate().slice(0,7)}-01`;
  if(await client.reporting_month.findUnique({where:{owner_id_month_start:{owner_id:ownerId,month_start:dateValue(monthStart)}}})) throw new DomainError('IDENTITY_CONFLICT','เดือนนี้มีข้อมูลอยู่แล้ว');
  const source=await client.reporting_month.findFirst({where:{owner_id:ownerId},orderBy:{month_start:'desc'}});
  await createSuppliedMonth(client,ownerId,openingBalance,income);
  if(source) await copySetup(client,ownerId,source.month_start,dateValue(monthStart));
  await client.app_user.update({where:{id:ownerId},data:{resume_required_at:null}});
  return (await getMonthView(client,ownerId,monthStart))!;
}

async function createSuppliedMonth(client: Prisma.TransactionClient,ownerId:string,openingBalance:string,income:string):Promise<MonthView> {
  const businessDate=currentBusinessDate();
  const monthStart=`${businessDate.slice(0,7)}-01`;
  await client.reporting_month.create({data:{owner_id:ownerId,month_start:dateValue(monthStart),tracked_from:dateValue(businessDate),opening_source:'supplied',opening_balance_input:openingBalance,income_amount:income}});
  const view=await getMonthView(client,ownerId,monthStart);
  if(!view) throw new Error('reporting month was not created');
  return view;
}

export async function copySetup(client:Prisma.TransactionClient,ownerId:string,source:Date,destination:Date):Promise<void> {
  const rows=await client.monthly_recurring_expense.findMany({where:{owner_id:ownerId,month_start:source}});
  if(rows.length) await client.monthly_recurring_expense.createMany({data:rows.map(row=>({owner_id:ownerId,month_start:destination,id:row.id,position:row.position,name:row.name,kind:row.kind,fixed_amount:row.fixed_amount,is_paused:row.is_paused}))});
}
