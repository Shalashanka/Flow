import { describe, expect, it } from 'vitest';

import type { FlowTransaction } from '#flow/actual-adapter';

import { detectSubscriptionCandidates } from './detect';

describe('detectSubscriptionCandidates', () => {
  it('detects a stable monthly expense without confirming it', () => {
    const candidates = detectSubscriptionCandidates([
      transaction('one', '2026-01-15', -1299),
      transaction('two', '2026-02-15', -1299),
      transaction('three', '2026-03-15', -1299),
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0]).toMatchObject({
      name: 'Stream Service',
      recurrence: 'monthly',
      amount: 1299,
      confidence: 100,
      firstSeen: '2026-01-15',
      lastSeen: '2026-03-15',
      nextExpectedDate: '2026-04-15',
      transactionIds: ['one', 'two', 'three'],
    });
  });

  it('detects a price change above ten percent', () => {
    const candidates = detectSubscriptionCandidates([
      transaction('one', '2026-01-31', -1000),
      transaction('two', '2026-02-28', -1000),
      transaction('three', '2026-03-31', -1250),
    ]);

    expect(candidates[0]?.amount).toBe(1250);
    expect(candidates[0]?.nextExpectedDate).toBe('2026-04-30');
    expect(candidates[0]?.warnings).toContainEqual({
      code: 'price-changed',
      previousAmount: 1000,
      latestAmount: 1250,
    });
  });

  it('excludes inflows, one-offs, and non-recurring gaps', () => {
    const candidates = detectSubscriptionCandidates([
      transaction('income-one', '2026-01-01', 200000),
      transaction('income-two', '2026-02-01', 200000),
      transaction('one-off', '2026-01-10', -5000, 'Other Payee'),
      transaction('random-one', '2026-01-01', -800, 'Random Payee'),
      transaction('random-two', '2026-03-01', -800, 'Random Payee'),
    ]);

    expect(candidates).toEqual([]);
  });
});

function transaction(
  id: string,
  date: string,
  amount: number,
  payeeName = 'Stream Service',
): FlowTransaction {
  return {
    id,
    date,
    amount,
    accountId: 'account-one',
    accountName: 'Checking',
    categoryId: 'category-one',
    categoryName: 'Subscriptions',
    payeeId: `payee:${payeeName}`,
    payeeName,
  };
}
