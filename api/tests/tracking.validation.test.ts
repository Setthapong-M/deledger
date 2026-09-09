import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { prisma, disconnectDatabase } from '../src/server/db/pool.js';
import { setBusinessClock } from '../src/server/domain/clock.js';
import { startOnboarding } from '../src/server/services/lifecycle.js';
import { backfillMonths, restartTracking } from '../src/server/services/tracking.js';

afterAll(disconnectDatabase);
afterEach(() => setBusinessClock(() => new Date()));

describe('tracking rejects invalid periods before database access', () => {
  it.each(['2026-02-29', '2026-04-31', '2026-13-01', '2026-10-10', 'not-a-date'])('rejects onboarding start %s', async startDate => {
    setBusinessClock(() => new Date('2026-10-09T05:00:00Z'));
    await expect(startOnboarding(prisma, 'unused-owner', { startDate, openingBalance: '0', income: '0' })).rejects.toMatchObject({ code: 'INVALID_INPUT', field: 'startDate' });
  });

  it('rejects 25 onboarding months without starting a transaction', async () => {
    setBusinessClock(() => new Date('2026-10-09T05:00:00Z'));
    await expect(startOnboarding(prisma, 'unused-owner', { startDate: '2024-10-01', openingBalance: '0', income: '0' })).rejects.toMatchObject({ code: 'DATE_RANGE_TOO_LARGE' });
  });

  it.each(['2026-09-30', '2026-10-10', '2026-02-29'])('rejects restart outside the effective current period: %s', async startDate => {
    setBusinessClock(() => new Date('2026-10-09T05:00:00Z'));
    await expect(restartTracking({ client: prisma, ownerId: 'unused-owner', requestId: 'validation' }, { monthStart: '2026-10-01', startDate, openingBalance: '0', income: '0', expectedRevision: '0' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });

  it('rejects an invalid backfill date before locking', async () => {
    setBusinessClock(() => new Date('2026-10-09T05:00:00Z'));
    await expect(backfillMonths({ client: prisma, ownerId: 'unused-owner', requestId: 'validation' }, { startDate: '2026-02-29', openingBalance: '0', income: '0', expectedEarliestMonth: '2026-10', expectedEarliestRevision: '0' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
  });
});
