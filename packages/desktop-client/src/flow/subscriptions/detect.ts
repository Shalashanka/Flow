import type { FlowTransaction } from '#flow/actual-adapter';

import type {
  FlowSubscriptionCandidate,
  FlowSubscriptionRecurrence,
  FlowSubscriptionWarning,
} from './types';

type TransactionGroup = {
  normalizedName: string;
  name: string;
  payeeId?: string;
  transactions: FlowTransaction[];
};

type RecurrenceBand = {
  recurrence: Exclude<FlowSubscriptionRecurrence, 'irregular' | 'unknown'>;
  minimumDays: number;
  maximumDays: number;
};

const recurrenceBands: RecurrenceBand[] = [
  { recurrence: 'weekly', minimumDays: 5, maximumDays: 9 },
  { recurrence: 'biweekly', minimumDays: 12, maximumDays: 16 },
  { recurrence: 'monthly', minimumDays: 26, maximumDays: 35 },
  { recurrence: 'quarterly', minimumDays: 80, maximumDays: 100 },
  { recurrence: 'yearly', minimumDays: 340, maximumDays: 390 },
];

export function detectSubscriptionCandidates(
  transactions: FlowTransaction[],
): FlowSubscriptionCandidate[] {
  return groupTransactions(transactions)
    .map(detectCandidate)
    .filter(isCandidate)
    .sort(
      (left, right) =>
        right.confidence - left.confidence ||
        left.name.localeCompare(right.name),
    );
}

export function normalizeSubscriptionPayeeName(name: string): string {
  return name
    .normalize('NFKD')
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function groupTransactions(
  transactions: FlowTransaction[],
): TransactionGroup[] {
  const groups = new Map<string, TransactionGroup>();

  for (const transaction of transactions) {
    if (transaction.amount >= 0 || !transaction.date) {
      continue;
    }

    const name = transaction.payeeName?.trim();
    const normalizedName = name ? normalizeSubscriptionPayeeName(name) : '';

    if (!transaction.payeeId && !normalizedName) {
      continue;
    }

    const key = transaction.payeeId
      ? `payee:${transaction.payeeId}`
      : `name:${normalizedName}`;
    const existing = groups.get(key);

    if (existing) {
      existing.transactions.push(transaction);
    } else {
      groups.set(key, {
        normalizedName,
        name: name || normalizedName,
        payeeId: transaction.payeeId,
        transactions: [transaction],
      });
    }
  }

  return [...groups.values()];
}

function detectCandidate(
  group: TransactionGroup,
): FlowSubscriptionCandidate | null {
  const transactions = [...group.transactions].sort((left, right) =>
    left.date.localeCompare(right.date),
  );

  if (
    transactions.length < 2 ||
    new Set(transactions.map(transaction => transaction.date.slice(0, 7)))
      .size < 2
  ) {
    return null;
  }

  const gaps = transactions
    .slice(1)
    .map((transaction, index) =>
      daysBetween(transactions[index].date, transaction.date),
    )
    .filter(gap => gap > 0);
  const recurrenceResult = detectRecurrence(gaps);

  if (!recurrenceResult) {
    return null;
  }

  const amounts = transactions.map(transaction => Math.abs(transaction.amount));
  const typicalAmount = median(amounts);
  const isAmountStable = amounts.every(amount =>
    isWithinTenPercent(amount, typicalAmount),
  );
  const categoryId = mostCommon(
    transactions.map(transaction => transaction.categoryId),
  );
  const accountId = mostCommon(
    transactions.map(transaction => transaction.accountId),
  );
  const isCategoryStable = hasStableValue(
    transactions.map(transaction => transaction.categoryId),
    categoryId,
  );
  const isAccountStable = hasStableValue(
    transactions.map(transaction => transaction.accountId),
    accountId,
  );
  const confidence = Math.min(
    100,
    40 +
      (isAmountStable ? 20 : 0) +
      (recurrenceResult.isStable ? 20 : 10) +
      (isCategoryStable ? 10 : 0) +
      (isAccountStable ? 10 : 0),
  );

  if (confidence < 60) {
    return null;
  }

  const latestTransaction = transactions.at(-1);

  if (!latestTransaction) {
    return null;
  }

  const priceChange = getPriceChange(transactions);
  const warnings: FlowSubscriptionWarning[] = [];

  if (confidence < 70) {
    warnings.push({ code: 'low-confidence' });
  }

  if (priceChange) {
    warnings.push({ code: 'price-changed', ...priceChange });
  }

  return {
    candidateId: createCandidateId(group.payeeId, group.normalizedName),
    name: group.name,
    normalizedName: group.normalizedName,
    payeeId: group.payeeId,
    categoryId,
    accountId,
    amount: priceChange ? priceChange.latestAmount : typicalAmount,
    recurrence: recurrenceResult.recurrence,
    firstSeen: transactions[0].date,
    lastSeen: latestTransaction.date,
    nextExpectedDate: addRecurrence(
      latestTransaction.date,
      recurrenceResult.recurrence,
    ),
    confidence,
    transactionIds: transactions.map(transaction => transaction.id),
    warnings,
  };
}

function detectRecurrence(
  gaps: number[],
): { recurrence: RecurrenceBand['recurrence']; isStable: boolean } | null {
  if (gaps.length === 0) {
    return null;
  }

  const typicalGap = median(gaps);
  const band = recurrenceBands.find(
    candidate =>
      typicalGap >= candidate.minimumDays &&
      typicalGap <= candidate.maximumDays,
  );

  if (!band) {
    return null;
  }

  const matchingGapCount = gaps.filter(
    gap => gap >= band.minimumDays && gap <= band.maximumDays,
  ).length;

  return {
    recurrence: band.recurrence,
    isStable: matchingGapCount / gaps.length >= 0.75,
  };
}

function getPriceChange(
  transactions: FlowTransaction[],
): { previousAmount: number; latestAmount: number } | null {
  if (transactions.length < 2) {
    return null;
  }

  const latestAmount = Math.abs(transactions.at(-1)?.amount ?? 0);
  const previousAmount = median(
    transactions.slice(0, -1).map(transaction => Math.abs(transaction.amount)),
  );

  if (
    previousAmount === 0 ||
    isWithinTenPercent(latestAmount, previousAmount)
  ) {
    return null;
  }

  return { previousAmount, latestAmount };
}

function addRecurrence(
  date: string,
  recurrence: RecurrenceBand['recurrence'],
): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));

  switch (recurrence) {
    case 'weekly':
      value.setUTCDate(value.getUTCDate() + 7);
      break;
    case 'biweekly':
      value.setUTCDate(value.getUTCDate() + 14);
      break;
    case 'monthly':
      setUtcMonthClamped(value, 1);
      break;
    case 'quarterly':
      setUtcMonthClamped(value, 3);
      break;
    case 'yearly':
      setUtcMonthClamped(value, 12);
      break;
    default:
      break;
  }

  return toDateString(value);
}

function setUtcMonthClamped(date: Date, months: number) {
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
}

function daysBetween(first: string, second: string): number {
  const milliseconds =
    Date.parse(`${second}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`);
  return Math.round(milliseconds / 86_400_000);
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  return sorted[middle] ?? 0;
}

function mostCommon(values: Array<string | undefined>): string | undefined {
  const counts = new Map<string, number>();

  for (const value of values) {
    if (value) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
  }

  return [...counts.entries()].sort(
    ([leftValue, leftCount], [rightValue, rightCount]) =>
      rightCount - leftCount || leftValue.localeCompare(rightValue),
  )[0]?.[0];
}

function hasStableValue(
  values: Array<string | undefined>,
  commonValue: string | undefined,
): boolean {
  return (
    commonValue != null &&
    values.filter(value => value === commonValue).length / values.length >= 0.75
  );
}

function isWithinTenPercent(value: number, reference: number): boolean {
  return Math.abs(value - reference) <= Math.max(1, Math.round(reference / 10));
}

function createCandidateId(
  payeeId: string | undefined,
  normalizedName: string,
) {
  if (payeeId) {
    return `flow-subscription:payee:${payeeId}`;
  }

  return `flow-subscription:name:${hashString(normalizedName)}`;
}

function hashString(value: string): string {
  let hash = 2_166_136_261;

  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16_777_619);
  }

  return (hash >>> 0).toString(36);
}

function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function isCandidate(
  candidate: FlowSubscriptionCandidate | null,
): candidate is FlowSubscriptionCandidate {
  return candidate !== null;
}
