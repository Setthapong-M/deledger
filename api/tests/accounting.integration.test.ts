import { archive, restore } from '../src/operator.js';
import { listHistory } from '../src/server/services/history.js';
import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { disconnectDatabase } from '../src/server/db/pool.js';
import { loginLocal } from '../src/server/services/local-auth.js';
import { withClient,withUserTransaction } from '../src/server/db/transaction.js';
import { setBusinessClock } from '../src/server/domain/clock.js';
import { startOnboarding, resumeTracking } from '../src/server/services/lifecycle.js';
import { listMonthViews,getMonthView } from '../src/server/repositories/months.js';
import { catchUpOwner } from '../src/server/services/catch-up.js';
import { addRecurringExpense,confirmExpenseDetail,manualClose,recordSnapshot,updateEndingBalance,updateIncome,reorderRecurringExpenses,updateRecurringExpense,cancelExpenseDetail } from '../src/server/services/month-write.js';
import type { MutationContext } from '../src/server/services/month-write.js';

const enabled=Boolean(process.env.DATABASE_URL && process.env.IDENTITY_DATABASE_URL);
afterAll(disconnectDatabase);
afterEach(()=>setBusinessClock(()=>new Date()));
const time=(value:string)=>setBusinessClock(()=>new Date(value));
async function user() {
  const session=await withClient(client=>loginLocal(client,`${randomUUID()}@example.com`));
  const request=new Request('http://localhost/api/months',{headers:{cookie:`deledger_local_session=${session.token}`}});
  return <T>(fn:(context:MutationContext)=>Promise<T>)=>withUserTransaction(request,randomUUID(),{mode:'local'},fn);
}

describe.skipIf(!enabled)('accounting through authenticated Prisma service transactions',()=>{
  it('closes every elapsed month in one pass and carries confirmed balances, never snapshots',async()=>{
    time('2026-01-15T05:00:00Z');
    const run=await user();
    let month=await run(({client,ownerId})=>startOnboarding(client,ownerId,{openingBalance:'100.10',income:'20.20'}));
    expect(month.isPartial).toBe(true);
    month=await run(ctx=>recordSnapshot(ctx,{monthStart:'2026-01-01',expectedRevision:month.revision,observedOn:'2026-01-20',amount:'90.05'}));
    expect(month.summary.provisionalSpending).toBe('30.25');
    expect(month.summary.endingBalance).toBeNull();
    month=await run(ctx=>addRecurringExpense(ctx,{monthStart:'2026-01-01',expectedRevision:month.revision,name:'Rent',kind:'fixed',fixedAmount:'10.10'}));
    const id=month.setup[0]!.id;
    month=await run(ctx=>confirmExpenseDetail(ctx,{monthStart:'2026-01-01',expectedRevision:month.revision,setupItemId:id}));
    time('2026-04-01T00:00:00Z');
    const views=await run(({client,ownerId})=>listMonthViews(client,ownerId));
    expect(views.map(view=>[view.month,view.lifecycle])).toEqual([['2026-04','open'],['2026-03','closed'],['2026-02','closed'],['2026-01','closed']]);
    expect(views[0]!.summary.startingBalance).toBeNull();
    expect(views[0]!.setup[0]).toMatchObject({id,name:'Rent',detail:null});
    expect(views[1]!.reconciliation.state).toBe('needs_information');
    expect(await run(({client,ownerId})=>catchUpOwner(client,ownerId))).toBe(0);
    const jan=views[3]!;
    const corrected=await run(ctx=>updateEndingBalance(ctx,{monthStart:'2026-01-01',expectedRevision:jan.revision,endingBalance:'90.05'}));
    expect(corrected.summary.monthlySpending).toBe('30.25');
    expect(corrected.affectedMonthKeys).toEqual(['2026-02']);
    const feb=await run(({client,ownerId})=>getMonthView(client,ownerId,'2026-02-01'));
    expect(feb!.summary.startingBalance).toBe('90.05');
    expect(feb!.setup[0]!.detail).toBeNull();
  });
  it('requires last-day coherent manual close and keeps closed variable confirmations correctable',async()=>{
    time('2026-02-27T10:00:00Z');
    const run=await user();
    let month=await run(({client,ownerId})=>startOnboarding(client,ownerId,{openingBalance:'0.10',income:'0.20'}));
    await expect(run(ctx=>manualClose(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision}))).rejects.toMatchObject({code:'MANUAL_CLOSE_NOT_ALLOWED'});
    time('2026-02-28T10:00:00Z');
    await expect(run(ctx=>manualClose(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision}))).rejects.toMatchObject({code:'SUMMARY_INCOMPLETE'});
    month=await run(ctx=>updateEndingBalance(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision,endingBalance:'0.40'}));
    await expect(run(ctx=>manualClose(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision}))).rejects.toMatchObject({code:'SUMMARY_INCONSISTENT'});
    month=await run(ctx=>updateEndingBalance(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision,endingBalance:'0.00'}));
    month=await run(ctx=>addRecurringExpense(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision,name:'Food',kind:'variable'}));
    const id=month.setup[0]!.id;
    month=await run(ctx=>confirmExpenseDetail(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision,setupItemId:id,amount:'0.40'}));
    await expect(run(ctx=>manualClose(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision}))).rejects.toMatchObject({code:'SUMMARY_INCONSISTENT'});
    month=await run(ctx=>confirmExpenseDetail(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision,setupItemId:id,amount:'0.20',replace:true}));
    month=await run(ctx=>manualClose(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision}));
    expect(month).toMatchObject({lifecycle:'closed',closedBy:'manual',summary:{monthlySpending:'0.30',unitemizedSpending:'0.10'},reconciliation:{state:'reconciled'}});
    month=await run(ctx=>confirmExpenseDetail(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision,setupItemId:id,amount:'0.40',replace:true}));
    expect(month.reconciliation.state).toBe('inconsistent');
    month=await run(ctx=>cancelExpenseDetail(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision,setupItemId:id}));
    expect(month.reconciliation.state).toBe('reconciled');
    month=await run(ctx=>confirmExpenseDetail(ctx,{monthStart:'2026-02-01',expectedRevision:month.revision,setupItemId:id,amount:'0.10',replace:true}));
    expect(month.setup[0]!.detail!.confirmedAmount).toBe('0.10');
  });
  it('serializes revisions, rolls back failed writes, and atomically reorders independent setup copies',async()=>{
    time('2026-06-15T10:00:00Z');
    const run=await user();
    let month=await run(({client,ownerId})=>startOnboarding(client,ownerId,{openingBalance:'10',income:'10'}));
    const revision=month.revision;
    const results=await Promise.allSettled(['20','30'].map(income=>run(ctx=>updateIncome(ctx,{monthStart:'2026-06-01',expectedRevision:revision,income}))));
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
    expect(results.find(result=>result.status==='rejected')).toMatchObject({reason:{code:'REVISION_CONFLICT'}});
    month=(await run(({client,ownerId})=>getMonthView(client,ownerId,'2026-06-01')))!;
    const before=month;
    await expect(run(async ctx=>{await updateIncome(ctx,{monthStart:'2026-06-01',expectedRevision:before.revision,income:'500'});throw new Error('abort');})).rejects.toThrow('abort');
    expect(await run(({client,ownerId})=>getMonthView(client,ownerId,'2026-06-01'))).toEqual(before);
    month=await run(ctx=>addRecurringExpense(ctx,{monthStart:'2026-06-01',expectedRevision:month.revision,name:'First',kind:'fixed',fixedAmount:'1.01'}));
    month=await run(ctx=>addRecurringExpense(ctx,{monthStart:'2026-06-01',expectedRevision:month.revision,name:'Second',kind:'fixed',fixedAmount:'2.02'}));
    const first=month.setup[0]!.id;
    const second=month.setup[1]!.id;
    month=await run(ctx=>reorderRecurringExpenses(ctx,{monthStart:'2026-06-01',expectedRevision:month.revision,setupItemIds:[second,first]}));
    expect(month.setup.map(item=>item.name)).toEqual(['Second','First']);
    month=await run(ctx=>updateRecurringExpense(ctx,{monthStart:'2026-06-01',expectedRevision:month.revision,setupItemId:first,isPaused:true}));
    time('2026-07-15T10:00:00Z');
    let july=(await run(({client,ownerId})=>getMonthView(client,ownerId,'2026-07-01')))!;
    expect(july.setup[1]).toMatchObject({id:first,isPaused:true,detail:null});
    july=await run(ctx=>updateRecurringExpense(ctx,{monthStart:'2026-07-01',expectedRevision:july.revision,setupItemId:first,name:'Changed',fixedAmount:'9.99'}));
    const june=(await run(({client,ownerId})=>getMonthView(client,ownerId,'2026-06-01')))!;
    expect(june.setup[1]).toMatchObject({name:'First',fixedAmount:'1.01'});
  });

  it('keeps derived totals exact even when two valid inputs exceed one stored amount',async()=>{
    time('2026-08-15T10:00:00Z');
    const run=await user();
    const month=await run(({client,ownerId})=>startOnboarding(client,ownerId,{openingBalance:'9999999999999.99',income:'9999999999999.99'}));
    const result=await run(ctx=>updateEndingBalance(ctx,{monthStart:'2026-08-01',expectedRevision:month.revision,endingBalance:'0.00'}));
    expect(result.summary.monthlySpending).toBe('19999999999999.98');
  });

  it('resumes across a Tracking Gap with supplied balances and copies setup without paid details',async()=>{
    time('2026-03-15T10:00:00Z');
    const run=await user();
    let month=await run(({client,ownerId})=>startOnboarding(client,ownerId,{openingBalance:'100',income:'20'}));
    const owner=await run(async({ownerId})=>ownerId);
    month=await run(ctx=>addRecurringExpense(ctx,{monthStart:'2026-03-01',expectedRevision:month.revision,name:'Rent',kind:'fixed',fixedAmount:'10'}));
    month=await run(ctx=>confirmExpenseDetail(ctx,{monthStart:'2026-03-01',expectedRevision:month.revision,setupItemId:month.setup[0]!.id}));
    await archive(owner);
    await expect(run(({client,ownerId})=>getMonthView(client,ownerId,'2026-03-01'))).rejects.toMatchObject({code:'USER_ARCHIVED'});
    time('2026-06-15T10:00:00Z');
    await restore(owner);
    const resumed=await run(({client,ownerId})=>resumeTracking(client,ownerId,{openingBalance:'42.42',income:'2.02'}));
    expect(resumed).toMatchObject({month:'2026-06',isPartial:true,summary:{startingBalance:'42.42',income:'2.02'}});
    expect(resumed.setup[0]).toMatchObject({name:'Rent',detail:null});
    const history=await run(({client,ownerId})=>listHistory(client,ownerId));
    expect(history.map(row=>row.kind)).toEqual(['month','month','tracking_gap']);
    expect(history.filter(row=>row.kind==='month').map(row=>row.id)).toEqual(['2026-06','2026-03']);
  });

  it('preserves fixed confirmation snapshots when next-month definitions change',async()=>{
    time('2026-01-20T10:00:00Z');
    const run=await user();
    let month=await run(({client,ownerId})=>startOnboarding(client,ownerId,{openingBalance:'100',income:'20'}));
    month=await run(ctx=>addRecurringExpense(ctx,{monthStart:'2026-01-01',expectedRevision:month.revision,name:'Rent',kind:'fixed',fixedAmount:'10.10'}));
    const id=month.setup[0]!.id;
    month=await run(ctx=>confirmExpenseDetail(ctx,{monthStart:'2026-01-01',expectedRevision:month.revision,setupItemId:id,amount:'99.99'}));
    expect(month.setup[0]!.detail).toMatchObject({confirmedName:'Rent',confirmedKind:'fixed',confirmedAmount:'10.10'});
    await expect(run(ctx=>updateRecurringExpense(ctx,{monthStart:'2026-01-01',expectedRevision:month.revision,setupItemId:id,name:'Changed'}))).rejects.toMatchObject({code:'SETUP_ITEM_CONFIRMED'});
    await expect(run(ctx=>confirmExpenseDetail(ctx,{monthStart:'2026-01-01',expectedRevision:month.revision,setupItemId:id,replace:true}))).rejects.toMatchObject({code:'SETUP_ITEM_CONFIRMED'});
    time('2026-02-15T10:00:00Z');
    let feb=(await run(({client,ownerId})=>getMonthView(client,ownerId,'2026-02-01')))!;
    feb=await run(ctx=>updateRecurringExpense(ctx,{monthStart:'2026-02-01',expectedRevision:feb.revision,setupItemId:id,name:'Utilities',kind:'variable',fixedAmount:null}));
    feb=await run(ctx=>confirmExpenseDetail(ctx,{monthStart:'2026-02-01',expectedRevision:feb.revision,setupItemId:id,amount:'20.20'}));
    expect(feb.setup[0]!.detail).toMatchObject({confirmedName:'Utilities',confirmedKind:'variable',confirmedAmount:'20.20'});
    const jan=(await run(({client,ownerId})=>getMonthView(client,ownerId,'2026-01-01')))!;
    expect(jan.setup[0]!.detail).toMatchObject({confirmedName:'Rent',confirmedKind:'fixed',confirmedAmount:'10.10'});
  });

  it('increments and compares bigint revisions without losing the least significant digit',async()=>{
    time('2026-08-15T10:00:00Z');
    const run=await user();
    await run(({client,ownerId})=>startOnboarding(client,ownerId,{openingBalance:'10',income:'10'}));
    const owner=await run(async({ownerId})=>ownerId);
    await withClient(client=>client.reporting_month.update({where:{owner_id_month_start:{owner_id:owner,month_start:new Date('2026-08-01T00:00:00Z')}},data:{revision:9007199254740993n}}));
    const month=await run(ctx=>updateIncome(ctx,{monthStart:'2026-08-01',expectedRevision:'9007199254740993',income:'20'}));
    expect(month.revision).toBe('9007199254740994');
    await expect(run(ctx=>updateIncome(ctx,{monthStart:'2026-08-01',expectedRevision:'9007199254740993',income:'30'}))).rejects.toMatchObject({code:'REVISION_CONFLICT',current:{revision:'9007199254740994'}});
  });

  it('selects snapshots by observed day then recording time, with stable id tie-breaking',async()=>{
    time('2026-08-15T10:00:00Z');
    const run=await user();
    let month=await run(({client,ownerId})=>startOnboarding(client,ownerId,{openingBalance:'100',income:'10'}));
    month=await run(ctx=>recordSnapshot(ctx,{monthStart:'2026-08-01',expectedRevision:month.revision,observedOn:'2026-08-16',amount:'90'}));
    time('2026-08-15T11:00:00Z');
    month=await run(ctx=>recordSnapshot(ctx,{monthStart:'2026-08-01',expectedRevision:month.revision,observedOn:'2026-08-16',amount:'80'}));
    expect(month.summary.latestSnapshot!.amount).toBe('80.00');
    month=await run(ctx=>recordSnapshot(ctx,{monthStart:'2026-08-01',expectedRevision:month.revision,observedOn:'2026-08-15',amount:'70'}));
    expect(month.summary.latestSnapshot!.amount).toBe('80.00');
    const owner=await run(async({ownerId})=>ownerId);
    const recorded=new Date('2026-08-15T12:00:00Z');
    const prefix=randomUUID().slice(0,24);
    const lowId=`${prefix}000000000001`;
    const highId=`${prefix}ffffffffffff`;
    await withClient(client=>client.balance_snapshot.createMany({data:[{id:lowId,owner_id:owner,month_start:new Date('2026-08-01'),observed_on:new Date('2026-08-16'),recorded_at:recorded,amount:'60'},{id:highId,owner_id:owner,month_start:new Date('2026-08-01'),observed_on:new Date('2026-08-16'),recorded_at:recorded,amount:'50'}]}));
    const selected=(await run(({client,ownerId})=>getMonthView(client,ownerId,'2026-08-01')))!;
    expect(selected.summary.latestSnapshot).toMatchObject({id:highId,amount:'50.00'});
  });

  it('restores within the same Bangkok month without a Tracking Gap or a new opening balance',async()=>{
    time('2026-03-15T10:00:00Z');
    const run=await user();
    const month=await run(({client,ownerId})=>startOnboarding(client,ownerId,{openingBalance:'123.45',income:'67.89'}));
    const owner=await run(async({ownerId})=>ownerId);
    await archive(owner);
    time('2026-03-31T16:59:59Z');
    expect(await restore(owner)).toBe(false);
    expect(await run(({client,ownerId})=>getMonthView(client,ownerId,'2026-03-01'))).toEqual(month);
    expect((await run(({client,ownerId})=>listHistory(client,ownerId))).map(row=>row.kind)).toEqual(['month']);
    await expect(run(({client,ownerId})=>resumeTracking(client,ownerId,{openingBalance:'0',income:'0'}))).rejects.toMatchObject({code:'IDENTITY_CONFLICT'});
  });

  it('makes parallel operator catch-up idempotent while closing all missing historical months',async()=>{
    time('2026-01-15T10:00:00Z');
    const run=await user();
    await run(({client,ownerId})=>startOnboarding(client,ownerId,{openingBalance:'1',income:'2'}));
    const owner=await run(async({ownerId})=>ownerId);
    time('2026-04-15T10:00:00Z');
    const counts=await Promise.all([withClient(client=>catchUpOwner(client,owner)),withClient(client=>catchUpOwner(client,owner))]);
    expect(counts.sort()).toEqual([0,6]);
    expect((await run(({client,ownerId})=>listMonthViews(client,ownerId))).map(month=>[month.month,month.lifecycle,month.revision])).toEqual([['2026-04','open','0'],['2026-03','closed','1'],['2026-02','closed','1'],['2026-01','closed','1']]);
  });

});
