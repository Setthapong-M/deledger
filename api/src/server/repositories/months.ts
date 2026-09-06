import { Prisma } from '../../generated/prisma/client.js';
import type { RawMonthProjection } from '../domain/month-view.js';
import { toMonthView } from '../domain/month-view.js';
import { deriveAllowedActions } from '../domain/allowed-actions.js';
import type { MonthView, SetupKind } from '../domain/contracts.js';
import { currentBusinessDate, dateText, dateValue, isFinalDay, nextMonthStart, previousMonthStart } from '../domain/calendar.js';

export async function getMonthProjection(client: Prisma.TransactionClient, ownerId: string, monthStart: string): Promise<RawMonthProjection | null> {
  const where = { owner_id: ownerId, month_start: dateValue(monthStart) };
  const month = await client.reporting_month.findUnique({ where: { owner_id_month_start: where } });
  if (!month) return null;
  const previous = month.opening_source === 'prior_ending' ? await client.reporting_month.findUnique({where:{owner_id_month_start:{owner_id:ownerId,month_start:dateValue(previousMonthStart(monthStart))}}}) : null;
  const snapshot = await client.balance_snapshot.findFirst({where,orderBy:[{observed_on:'desc'},{recorded_at:'desc'},{id:'desc'}]});
  const setup = await client.monthly_recurring_expense.findMany({where,orderBy:[{position:'asc'},{id:'asc'}]});
  const details = await client.monthly_expense_detail.findMany({where});
  const archived = await client.user_archive_period.findFirst({where:{owner_id:ownerId,restored_at:null}});
  const starting = month.opening_source === 'supplied' ? month.opening_balance_input : previous?.ending_balance_amount ?? null;
  const income = month.income_amount;
  const ending = month.ending_balance_amount;
  const total = details.reduce((sum, detail) => sum.plus(detail.confirmed_amount), new Prisma.Decimal(0));
  const spending = starting !== null && income !== null && ending !== null ? starting.plus(income).minus(ending) : null;
  const provisional = month.closed_at === null && starting !== null && income !== null && ending === null && snapshot ? starting.plus(income).minus(snapshot.amount) : null;
  return {
    monthStart, lifecycle: month.closed_at === null ? 'open' : 'closed', closedBy: month.closed_by as 'manual' | 'automatic' | null,
    trackedFrom: dateText(month.tracked_from), revision: month.revision.toString(), startingBalance: starting?.toFixed(2) ?? null,
    income: income?.toFixed(2) ?? null, endingBalance: ending?.toFixed(2) ?? null,
    latestSnapshot: snapshot ? {id:snapshot.id,observedOn:dateText(snapshot.observed_on),amount:snapshot.amount.toFixed(2)} : null,
    monthlySpending:spending?.toFixed(2) ?? null,provisionalSpending:provisional?.toFixed(2) ?? null,detailTotal:total.toFixed(2),unitemizedSpending:spending?.minus(total).toFixed(2) ?? null,
    setup:setup.map(item => {
      const detail=details.find(row=>row.setup_item_id===item.id);
      return {id:item.id,position:item.position,name:item.name,kind:item.kind as SetupKind,fixedAmount:item.fixed_amount?.toFixed(2) ?? null,isPaused:item.is_paused,
        detail: detail ? {confirmedName:detail.confirmed_name,confirmedKind:detail.confirmed_kind as SetupKind,confirmedAmount:detail.confirmed_amount.toFixed(2),confirmedAt:detail.confirmed_at.toISOString()} : null};
    }),
    isFinalDay:isFinalDay(monthStart,currentBusinessDate()),isArchived:archived!==null,
  };
}

export async function listMonthKeys(client: Prisma.TransactionClient, ownerId: string): Promise<string[]> {
  return (await client.reporting_month.findMany({where:{owner_id:ownerId},orderBy:{month_start:'desc'},select:{month_start:true}})).map(row=>dateText(row.month_start).slice(0,7));
}

export async function getMonthView(client: Prisma.TransactionClient, ownerId: string, monthStart: string): Promise<MonthView | null> {
  const projection = await getMonthProjection(client, ownerId, monthStart);
  if (!projection) return null;
  const allowedActions = deriveAllowedActions({lifecycle:projection.lifecycle,hasStartingBalance:projection.startingBalance!==null,hasIncome:projection.income!==null,hasEndingBalance:projection.endingBalance!==null,isFinalDay:projection.isFinalDay,isArchived:projection.isArchived});
  return toMonthView({...projection,affectedMonthKeys:await getAffectedMonthKeys(client,ownerId,monthStart)},allowedActions);
}

export async function getCurrentMonthStart(client: Prisma.TransactionClient, ownerId: string): Promise<string | null> {
  const open = await client.reporting_month.findFirst({where:{owner_id:ownerId,closed_at:null},orderBy:{month_start:'desc'}});
  const month = open ?? await client.reporting_month.findFirst({where:{owner_id:ownerId},orderBy:{month_start:'desc'}});
  return month ? dateText(month.month_start) : null;
}

export async function getAffectedMonthKeys(client: Prisma.TransactionClient, ownerId: string, monthStart: string): Promise<string[]> {
  const next = await client.reporting_month.findUnique({where:{owner_id_month_start:{owner_id:ownerId,month_start:dateValue(nextMonthStart(monthStart))}}});
  return next ? [dateText(next.month_start).slice(0,7)] : [];
}

export async function listMonthViews(client: Prisma.TransactionClient, ownerId: string): Promise<MonthView[]> {
  const views: MonthView[] = [];
  for (const key of await listMonthKeys(client,ownerId)) {
    const view = await getMonthView(client,ownerId,`${key}-01`);
    if(view) views.push(view);
  }
  return views;
}
