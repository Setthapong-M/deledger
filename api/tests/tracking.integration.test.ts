import { randomUUID } from 'node:crypto';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { disconnectDatabase } from '../src/server/db/pool.js';
import { withClient, withUserTransaction } from '../src/server/db/transaction.js';
import { setBusinessClock } from '../src/server/domain/clock.js';
import { loginLocal } from '../src/server/services/local-auth.js';
import { startOnboarding, resumeTracking } from '../src/server/services/lifecycle.js';
import { archive, restore } from '../src/operator.js';
import { getMonthView, listMonthViews } from '../src/server/repositories/months.js';
import type { MutationContext } from '../src/server/services/month-write.js';
import { backfillMonths, readTrackingOptions, restartTracking } from '../src/server/services/tracking.js';
import { addRecurringExpense, updateRecurringExpense, updateEndingBalance, updateIncome, recordSnapshot } from '../src/server/services/month-write.js';

const enabled = Boolean(process.env.DATABASE_URL && process.env.IDENTITY_DATABASE_URL);
afterAll(disconnectDatabase);
afterEach(() => setBusinessClock(() => new Date()));
const time = (date: string) => setBusinessClock(() => new Date(`${date}T05:00:00Z`));
async function user() {
  const session = await withClient(client => loginLocal(client, `${randomUUID()}@example.com`));
  const request = new Request('http://localhost/api/months', { headers: { cookie: `deledger_local_session=${session.token}` } });
  return <T>(operation: (context: MutationContext) => Promise<T>) => withUserTransaction(request, randomUUID(), { mode: 'local' }, operation);
}

describe.skipIf(!enabled)('tracking through authenticated service transactions', () => {
  it('rejects a restart when prior ending is known, including zero', async () => {
    time('2026-10-09');
    const run = await user();
    await run(({ client, ownerId }) => startOnboarding(client, ownerId, { startDate: '2026-09-01', openingBalance: '100', income: '0' }));
    const previous = (await run(({ client, ownerId }) => getMonthView(client, ownerId, '2026-09-01')))!;
    await run(context => updateEndingBalance(context, { monthStart: '2026-09-01', expectedRevision: previous.revision, endingBalance: '0' }));
    expect(await run(({ client, ownerId }) => readTrackingOptions(client, ownerId))).toMatchObject({ restart: { allowed: false } });
    await expect(run(context => restartTracking(context, { monthStart: '2026-10-01', expectedRevision: '0', startDate: '2026-10-01', openingBalance: '42', income: '0' }))).rejects.toMatchObject({ code: 'RESTART_NOT_ALLOWED' });
  });

  it('rolls back a restart and accepts only one of two competing restarts', async () => {
    time('2026-10-09');
    const run = await user();
    const before = await run(({ client, ownerId }) => startOnboarding(client, ownerId, { startDate: '2026-09-01', openingBalance: '100', income: '0' }));
    const input = { monthStart: '2026-10-01', expectedRevision: '0', startDate: '2026-10-01', openingBalance: '42', income: '0' };
    await expect(run(async context => { await restartTracking(context, input); throw new Error('abort'); })).rejects.toThrow('abort');
    expect(await run(({ client, ownerId }) => getMonthView(client, ownerId, '2026-10-01'))).toEqual(before);
    const results = await Promise.allSettled([run(context => restartTracking(context, input)), run(context => restartTracking(context, input))]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'REVISION_CONFLICT' } });
  });

  it('keeps onboarding unavailable for an owner awaiting operator resume even without history', async () => {
    time('2026-10-09');
    const run = await user();
    await run(({ client, ownerId }) => client.app_user.update({ where: { id: ownerId }, data: { resume_required_at: new Date('2026-10-09T05:00:00Z') } }));
    await expect(run(({ client, ownerId }) => startOnboarding(client, ownerId, { openingBalance: '0', income: '0' }))).rejects.toMatchObject({ code: 'IDENTITY_CONFLICT' });
    expect(await run(({ client, ownerId }) => listMonthViews(client, ownerId))).toEqual([]);
  });

  it('rolls back historical onboarding completely on a later transaction failure', async () => {
    time('2026-10-09');
    const run = await user();
    await expect(run(async ({ client, ownerId }) => { await startOnboarding(client, ownerId, { startDate: '2026-08-15', openingBalance: '100', income: '0' }); throw new Error('abort'); })).rejects.toThrow('abort');
    expect(await run(({ client, ownerId }) => listMonthViews(client, ownerId))).toEqual([]);
  });
  it.each(['income', 'ending', 'snapshot', 'setup'])('refuses restart after recording %s, including explicit zero', async kind => {
    time('2026-10-09');
    const run = await user();
    await run(({ client, ownerId }) => startOnboarding(client, ownerId, { startDate: '2026-09-09', openingBalance: '100', income: '0' }));
    const revision = { monthStart: '2026-10-01', expectedRevision: '0' };
    const edited = await run(context => {
      if (kind === 'income') return updateIncome(context, { ...revision, income: '0' });
      if (kind === 'ending') return updateEndingBalance(context, { ...revision, endingBalance: '0' });
      if (kind === 'snapshot') return recordSnapshot(context, { ...revision, observedOn: '2026-10-09', amount: '0' });
      return addRecurringExpense(context, { ...revision, name: 'Rent', kind: 'fixed', fixedAmount: '0' });
    });
    expect(await run(({ client, ownerId }) => readTrackingOptions(client, ownerId))).toMatchObject({ restart: { allowed: false, reason: 'RESTART_NOT_ALLOWED' } });
    await expect(run(context => restartTracking(context, { ...revision, expectedRevision: edited.revision, startDate: '2026-10-09', openingBalance: '500', income: '0' }))).rejects.toMatchObject({ code: 'RESTART_NOT_ALLOWED' });
    expect(await run(({ client, ownerId }) => getMonthView(client, ownerId, '2026-10-01'))).toEqual(edited);
  });

  it('accepts exactly 24 onboarding months across a leap day', async () => {
    time('2026-01-09');
    const run = await user();
    await run(({ client, ownerId }) => startOnboarding(client, ownerId, { startDate: '2024-02-29', openingBalance: '0', income: '0' }));
    const months = await run(({ client, ownerId }) => listMonthViews(client, ownerId));
    expect(months).toHaveLength(24);
    expect(months[23]).toMatchObject({ month: '2024-02', trackedFrom: '2024-02-29', lifecycle: 'closed', summary: { income: '0.00' } });
    await expect(run(({ client, ownerId }) => startOnboarding(client, ownerId, { openingBalance: '0', income: '0' }))).rejects.toMatchObject({ code: 'IDENTITY_CONFLICT' });
  });

  it('bounds prepends at 24 months and rolls back all new history on transaction failure', async () => {
    time('2026-10-09');
    const run = await user();
    await run(({ client, ownerId }) => startOnboarding(client, ownerId, { openingBalance: '1000', income: '0' }));
    const input = { startDate: '2024-09-30', openingBalance: '0', income: '0', expectedEarliestMonth: '2026-10', expectedEarliestRevision: '0' };
    await expect(run(context => backfillMonths(context, input))).rejects.toMatchObject({ code: 'DATE_RANGE_TOO_LARGE' });
    input.startDate = '2024-10-01';
    await expect(run(async context => { await backfillMonths(context, input); throw new Error('abort'); })).rejects.toThrow('abort');
    expect((await run(({ client, ownerId }) => listMonthViews(client, ownerId))).map(month => month.month)).toEqual(['2026-10']);
    const created = await run(context => backfillMonths(context, input));
    expect(created.createdMonthKeys).toHaveLength(24);
    expect(created.createdMonthKeys[0]).toBe('2024-10');
    expect(created.createdMonthKeys[23]).toBe('2026-09');
  });

  it('rejects prepending across the effective month after moving before existing history', async () => {
    time('2026-11-09');
    const run = await user();
    await run(({ client, ownerId }) => startOnboarding(client, ownerId, { openingBalance: '100', income: '0' }));
    time('2026-09-09');
    expect(await run(({ client, ownerId }) => readTrackingOptions(client, ownerId))).toMatchObject({ prepend: { allowed: false, reason: 'HISTORY_BOUNDARY_CONFLICT' } });
    await expect(run(context => backfillMonths(context, { startDate: '2026-08-01', openingBalance: '0', income: '0', expectedEarliestMonth: '2026-11', expectedEarliestRevision: '0' }))).rejects.toMatchObject({ code: 'HISTORY_BOUNDARY_CONFLICT' });
    expect((await run(({ client, ownerId }) => listMonthViews(client, ownerId))).map(month => month.month)).toEqual(['2026-11']);
  });

  it('serializes competing prepends and preserves another owner history', async () => {
    time('2026-10-09');
    const run = await user();
    const other = await user();
    const before = await other(({ client, ownerId }) => startOnboarding(client, ownerId, { openingBalance: '123', income: '0' }));
    await run(({ client, ownerId }) => startOnboarding(client, ownerId, { openingBalance: '100', income: '0' }));
    const input = { startDate: '2026-09-01', openingBalance: '0', income: '0', expectedEarliestMonth: '2026-10', expectedEarliestRevision: '0' };
    const results = await Promise.allSettled([run(context => backfillMonths(context, input)), run(context => backfillMonths(context, input))]);
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { code: 'HISTORY_BOUNDARY_CONFLICT' } });
    expect(await other(({ client, ownerId }) => listMonthViews(client, ownerId))).toEqual([before]);
  });

  it('preserves the operator resume marker when the clock is before restoration', async () => {
    time('2026-08-09');
    const run = await user();
    await run(({ client, ownerId }) => startOnboarding(client, ownerId, { openingBalance: '100', income: '0' }));
    const owner = await run(async ({ ownerId }) => ownerId);
    await archive(owner);
    time('2026-10-09');
    await restore(owner);
    time('2026-09-09');
    await expect(run(({ client, ownerId }) => resumeTracking(client, ownerId, { openingBalance: '42', income: '0' }))).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(await run(({ client, ownerId }) => readTrackingOptions(client, ownerId))).toMatchObject({ prepend: { allowed: false, reason: 'RESUME_REQUIRED' }, restart: { allowed: false, reason: 'RESUME_REQUIRED' } });
    time('2026-10-09');
    expect(await run(({ client, ownerId }) => resumeTracking(client, ownerId, { openingBalance: '42', income: '0' }))).toMatchObject({ month: '2026-10', trackedFrom: '2026-10-09', summary: { startingBalance: '42.00' } });
  });
  it('restarts untouched copied setup and isolates its supplied balance from old corrections', async () => {
    time('2026-09-09');
    const run = await user();
    let september = await run(({ client, ownerId }) => startOnboarding(client, ownerId, { openingBalance: '100', income: '0' }));
    september = await run(context => addRecurringExpense(context, { monthStart: '2026-09-01', expectedRevision: september.revision, name: 'Rent', kind: 'fixed', fixedAmount: '10' }));
    await run(context => updateRecurringExpense(context, { monthStart: '2026-09-01', expectedRevision: september.revision, setupItemId: september.setup[0]!.id, isPaused: true }));
    time('2026-10-09');
    const before = (await run(({ client, ownerId }) => getMonthView(client, ownerId, '2026-10-01')))!;
    expect(await run(({ client, ownerId }) => readTrackingOptions(client, ownerId))).toMatchObject({ restart: { allowed: true, month: '2026-10', expectedRevision: '0', minDate: '2026-10-01', maxDate: '2026-10-09' } });
    const input = { monthStart: '2026-10-01', startDate: '2026-10-09', openingBalance: '42', income: '0', expectedRevision: '0' };
    const restarted = await run(context => restartTracking(context, input));
    expect(restarted).toMatchObject({ trackedFrom: '2026-10-09', revision: '1', summary: { startingBalance: '42.00', income: '0.00' }, setup: before.setup });
    september = (await run(({ client, ownerId }) => getMonthView(client, ownerId, '2026-09-01')))!;
    await run(context => updateEndingBalance(context, { monthStart: '2026-09-01', expectedRevision: september.revision, endingBalance: '9000' }));
    expect(await run(({ client, ownerId }) => getMonthView(client, ownerId, '2026-10-01'))).toEqual(restarted);
    await expect(run(context => restartTracking(context, input))).rejects.toMatchObject({ code: 'REVISION_CONFLICT' });
  });
  it('prepends closed history while preserving the existing supplied boundary and rejects retries', async () => {
    time('2026-09-09');
    const run = await user();
    const before = await run(({ client, ownerId }) => startOnboarding(client, ownerId, { openingBalance: '1000', income: '0' }));
    const options = await run(({ client, ownerId }) => readTrackingOptions(client, ownerId));
    expect(options).toMatchObject({ businessDate: '2026-09-09', earliestMonth: '2026-09', earliestRevision: '0', prepend: { allowed: true, minDate: '2024-09-01', maxDate: '2026-08-31' } });
    const input = { startDate: '2026-08-15', openingBalance: '500', income: '0', expectedEarliestMonth: '2026-09', expectedEarliestRevision: before.revision };
    const result = await run(context => backfillMonths(context, input));
    expect(result).toMatchObject({ month: { month: '2026-08', lifecycle: 'closed', setup: [] }, createdMonthKeys: ['2026-08'], affectedMonthKeys: ['2026-08'] });
    await run(context => updateEndingBalance(context, { monthStart: '2026-08-01', expectedRevision: result.month.revision, endingBalance: '9000' }));
    expect(await run(({ client, ownerId }) => getMonthView(client, ownerId, '2026-09-01'))).toEqual(before);
    await expect(run(context => backfillMonths(context, input))).rejects.toMatchObject({ code: 'HISTORY_BOUNDARY_CONFLICT' });
  });
  it('starts in August and returns October without inventing intervening inputs', async () => {
    time('2026-10-09');
    const run = await user();
    const current = await run(({ client, ownerId }) => startOnboarding(client, ownerId, { startDate: '2026-08-15', openingBalance: '100', income: '20' }));
    expect(current).toMatchObject({ month: '2026-10', lifecycle: 'open', summary: { startingBalance: null, income: null } });
    const months = await run(({ client, ownerId }) => listMonthViews(client, ownerId));
    expect(months.map(month => [month.month, month.lifecycle, month.summary.income])).toEqual([['2026-10', 'open', null], ['2026-09', 'closed', null], ['2026-08', 'closed', '20.00']]);
    expect(months[2]).toMatchObject({ trackedFrom: '2026-08-15', summary: { startingBalance: '100.00' }, setup: [] });
  });
});
