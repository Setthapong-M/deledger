import { describe, it, expect, afterEach } from 'vitest';
import { Prisma } from '../src/generated/prisma/client.js';
import { deriveReconciliation } from '../src/server/domain/month-view.js';
import { currentBusinessDate } from '../src/server/domain/calendar.js';
import { setBusinessClock } from '../src/server/domain/clock.js';

afterEach(() => setBusinessClock(() => new Date()));
describe('accounting calendar and exact reconciliation', () => {
  it('crosses the reporting boundary at Bangkok midnight', () => {
    setBusinessClock(() => new Date('2026-01-31T16:59:59Z'));
    expect(currentBusinessDate()).toBe('2026-01-31');
    setBusinessClock(() => new Date('2026-01-31T17:00:00Z'));
    expect(currentBusinessDate()).toBe('2026-02-01');
  });
  it('distinguishes a one-cent excess without floating point loss', () => {
    const spending = new Prisma.Decimal('9999999999999.99').plus('0.02').minus('9999999999999.98').toFixed(2);
    expect(spending).toBe('0.03');
    expect(deriveReconciliation({lifecycle:'closed', startingBalance:'9999999999999.99',income:'0.02', endingBalance:'9999999999999.98',monthlySpending:spending,detailTotal:'0.04'})).toEqual({state:'inconsistent',issueCodes:['DETAILS_EXCEED_SPENDING']});
  });
});
