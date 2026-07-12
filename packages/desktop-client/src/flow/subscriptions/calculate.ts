import type { FlowTransaction } from '#flow/actual-adapter';

import type {
  FlowSubscription,
  FlowSubscriptionComputed,
  FlowSubscriptionMatch,
  FlowSubscriptionRecurrence,
  FlowSubscriptionSummary,
  FlowSubscriptionWarning,
} from './types';

export function calculateFlowSubscriptions({
  subscriptions,
  matches,
  transactions,
  currentDate,
}: {
  subscriptions: FlowSubscription[];
  matches: FlowSubscriptionMatch[];
  transactions: FlowTransaction[];
  currentDate: string;
}): {
  rows: FlowSubscriptionComputed[];
  summary: FlowSubscriptionSummary;
} {
  const transactionsById = new Map(
    transactions.map(transaction => [transaction.id, transaction]),
  );
  const matchesBySubscriptionId = groupMatches(matches);
  const duplicatePayeeIds = getDuplicatePayeeIds(subscriptions);
  const rows = subscriptions.map(subscription => {
    const subscriptionMatches =
      matchesBySubscriptionId.get(subscription.id) ?? [];
    const linkedTransactions = subscriptionMatches
      .map(match => transactionsById.get(match.actualTransactionId))
      .filter(isTransaction)
      .sort((left, right) => left.date.localeCompare(right.date));
    const monthlyEquivalent = getMonthlyEquivalent(
      subscription.amount,
      subscription.recurrence,
    );

    return {
      subscription,
      transactions: linkedTransactions,
      linkedTransactionCount: subscriptionMatches.length,
      monthlyEquivalent,
      yearlyEquivalent: getYearlyEquivalent(
        subscription.amount,
        subscription.recurrence,
      ),
      warnings: getSubscriptionWarnings({
        subscription,
        transactions: linkedTransactions,
        currentDate,
        hasDuplicatePayee: Boolean(
          subscription.payeeId && duplicatePayeeIds.has(subscription.payeeId),
        ),
      }),
    };
  });
  const confirmedRows = rows.filter(
    row => row.subscription.status === 'confirmed',
  );

  return {
    rows,
    summary: {
      confirmedCount: confirmedRows.length,
      candidateCount: rows.filter(
        row => row.subscription.status === 'candidate',
      ).length,
      ignoredOrCancelledCount: rows.filter(row =>
        ['ignored', 'cancelled'].includes(row.subscription.status),
      ).length,
      estimatedMonthlyTotal: confirmedRows.reduce(
        (sum, row) => sum + row.monthlyEquivalent,
        0,
      ),
      estimatedYearlyTotal: confirmedRows.reduce(
        (sum, row) => sum + row.yearlyEquivalent,
        0,
      ),
      priceChangeWarningCount: rows.filter(row =>
        row.warnings.some(warning => warning.code === 'price-changed'),
      ).length,
    },
  };
}

export function getMonthlyEquivalent(
  amount: number,
  recurrence: FlowSubscriptionRecurrence,
): number {
  const normalizedAmount = Math.max(0, Math.round(amount));

  switch (recurrence) {
    case 'weekly':
      return divideAndRound(normalizedAmount * 52, 12);
    case 'biweekly':
      return divideAndRound(normalizedAmount * 26, 12);
    case 'monthly':
      return normalizedAmount;
    case 'quarterly':
      return divideAndRound(normalizedAmount, 3);
    case 'yearly':
      return divideAndRound(normalizedAmount, 12);
    case 'irregular':
    case 'unknown':
    default:
      return 0;
  }
}

export function getYearlyEquivalent(
  amount: number,
  recurrence: FlowSubscriptionRecurrence,
): number {
  const normalizedAmount = Math.max(0, Math.round(amount));

  switch (recurrence) {
    case 'weekly':
      return normalizedAmount * 52;
    case 'biweekly':
      return normalizedAmount * 26;
    case 'monthly':
      return normalizedAmount * 12;
    case 'quarterly':
      return normalizedAmount * 4;
    case 'yearly':
      return normalizedAmount;
    case 'irregular':
    case 'unknown':
    default:
      return 0;
  }
}

function getSubscriptionWarnings({
  subscription,
  transactions,
  currentDate,
  hasDuplicatePayee,
}: {
  subscription: FlowSubscription;
  transactions: FlowTransaction[];
  currentDate: string;
  hasDuplicatePayee: boolean;
}): FlowSubscriptionWarning[] {
  const warnings: FlowSubscriptionWarning[] = [];
  const isReviewed = ['confirmed', 'paused'].includes(subscription.status);

  if (subscription.status === 'candidate' && subscription.confidence < 70) {
    warnings.push({ code: 'low-confidence' });
  }

  if (isReviewed && isStale(subscription, currentDate)) {
    warnings.push({ code: 'stale-confirmed' });
  }

  if (
    ['candidate', 'confirmed', 'paused'].includes(subscription.status) &&
    subscription.nextExpectedDate &&
    subscription.nextExpectedDate < currentDate
  ) {
    warnings.push({ code: 'expected-date-passed' });
  }

  if (
    (subscription.status === 'confirmed' || subscription.confidence >= 70) &&
    transactions.length >= 2
  ) {
    const priceChange = getPriceChange(transactions);

    if (priceChange) {
      warnings.push({ code: 'price-changed', ...priceChange });
    }
  }

  if (!subscription.accountId) {
    warnings.push({ code: 'missing-account' });
  }

  if (!subscription.categoryId) {
    warnings.push({ code: 'missing-category' });
  }

  if (!subscription.payeeId) {
    warnings.push({ code: 'missing-payee' });
  }

  if (hasDuplicatePayee) {
    warnings.push({ code: 'duplicate-payee' });
  }

  if (
    subscription.recurrence === 'unknown' ||
    subscription.recurrence === 'irregular'
  ) {
    warnings.push({ code: 'unknown-recurrence' });
  }

  return warnings;
}

function isStale(subscription: FlowSubscription, currentDate: string): boolean {
  if (!subscription.lastSeen) {
    return true;
  }

  const staleAfterDays = {
    weekly: 21,
    biweekly: 42,
    monthly: 75,
    quarterly: 200,
    yearly: 500,
    irregular: 120,
    unknown: 120,
  } satisfies Record<FlowSubscriptionRecurrence, number>;

  return (
    daysBetween(subscription.lastSeen, currentDate) >
    staleAfterDays[subscription.recurrence]
  );
}

function getPriceChange(
  transactions: FlowTransaction[],
): { previousAmount: number; latestAmount: number } | null {
  const sorted = [...transactions].sort((left, right) =>
    left.date.localeCompare(right.date),
  );
  const latestAmount = Math.abs(sorted.at(-1)?.amount ?? 0);
  const previousAmounts = sorted
    .slice(0, -1)
    .map(transaction => Math.abs(transaction.amount));
  const previousAmount = median(previousAmounts);

  if (
    previousAmount === 0 ||
    Math.abs(latestAmount - previousAmount) <=
      Math.max(1, Math.round(previousAmount / 10))
  ) {
    return null;
  }

  return { previousAmount, latestAmount };
}

function groupMatches(matches: FlowSubscriptionMatch[]) {
  const grouped = new Map<string, FlowSubscriptionMatch[]>();

  for (const match of matches) {
    const current = grouped.get(match.subscriptionId) ?? [];
    current.push(match);
    grouped.set(match.subscriptionId, current);
  }

  return grouped;
}

function getDuplicatePayeeIds(subscriptions: FlowSubscription[]) {
  const counts = new Map<string, number>();

  for (const subscription of subscriptions) {
    if (subscription.payeeId) {
      counts.set(
        subscription.payeeId,
        (counts.get(subscription.payeeId) ?? 0) + 1,
      );
    }
  }

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([payeeId]) => payeeId),
  );
}

function divideAndRound(value: number, divisor: number): number {
  return Math.round(value / divisor);
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length === 0) {
    return 0;
  }

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  return sorted[middle] ?? 0;
}

function daysBetween(first: string, second: string): number {
  return Math.round(
    (Date.parse(`${second}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) /
      86_400_000,
  );
}

function isTransaction(
  transaction: FlowTransaction | undefined,
): transaction is FlowTransaction {
  return transaction !== undefined;
}
