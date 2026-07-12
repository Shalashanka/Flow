import { describe, expect, it } from 'vitest';

import type { FlowTransaction } from '#flow/actual-adapter';

import {
  calculateFlowSubscriptions,
  getMonthlyEquivalent,
  getYearlyEquivalent,
} from './calculate';
import type { FlowSubscription, FlowSubscriptionMatch } from './types';

describe('subscription calculations', () => {
  it('uses integer-safe recurrence equivalents', () => {
    expect(getMonthlyEquivalent(1000, 'weekly')).toBe(4333);
    expect(getYearlyEquivalent(1000, 'weekly')).toBe(52000);
    expect(getMonthlyEquivalent(12000, 'yearly')).toBe(1000);
    expect(getYearlyEquivalent(12000, 'yearly')).toBe(12000);
    expect(getMonthlyEquivalent(999, 'unknown')).toBe(0);
  });

  it('summarizes confirmed subscriptions and emits reusable warnings', () => {
    const subscription = createSubscription();
    const matches: FlowSubscriptionMatch[] = [match('one'), match('two')];
    const transactions: FlowTransaction[] = [
      transaction('one', '2026-05-01', -1000),
      transaction('two', '2026-06-01', -1200),
    ];
    const result = calculateFlowSubscriptions({
      subscriptions: [subscription],
      matches,
      transactions,
      currentDate: '2026-07-12',
    });

    expect(result.summary).toMatchObject({
      confirmedCount: 1,
      candidateCount: 0,
      estimatedMonthlyTotal: 1200,
      estimatedYearlyTotal: 14400,
      priceChangeWarningCount: 1,
    });
    expect(result.rows[0]?.warnings.map(warning => warning.code)).toEqual(
      expect.arrayContaining(['expected-date-passed', 'price-changed']),
    );
  });
});

function createSubscription(): FlowSubscription {
  return {
    id: 'subscription-one',
    name: 'Stream Service',
    payeeId: 'payee-one',
    accountId: 'account-one',
    categoryId: 'category-one',
    amount: 1200,
    recurrence: 'monthly',
    firstSeen: '2026-05-01',
    lastSeen: '2026-06-01',
    nextExpectedDate: '2026-07-01',
    status: 'confirmed',
    confidence: 100,
  };
}

function match(actualTransactionId: string): FlowSubscriptionMatch {
  return {
    id: `match:${actualTransactionId}`,
    subscriptionId: 'subscription-one',
    actualTransactionId,
    matchType: 'recurrence',
    confidence: 100,
  };
}

function transaction(
  id: string,
  date: string,
  amount: number,
): FlowTransaction {
  return {
    id,
    date,
    amount,
    accountId: 'account-one',
    categoryId: 'category-one',
    payeeId: 'payee-one',
    payeeName: 'Stream Service',
  };
}
