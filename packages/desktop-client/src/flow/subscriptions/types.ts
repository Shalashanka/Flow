import type {
  FlowSubscription,
  FlowSubscriptionRecurrence,
} from '@actual-app/core/shared/flow-subscription';

import type { FlowTransaction } from '#flow/actual-adapter';

export type {
  FlowSubscription,
  FlowSubscriptionMatch,
  FlowSubscriptionMatchType,
  FlowSubscriptionRecurrence,
  FlowSubscriptionStatus,
} from '@actual-app/core/shared/flow-subscription';

export {
  flowSubscriptionMatchTypes,
  flowSubscriptionRecurrences,
  flowSubscriptionStatuses,
  isFlowSubscriptionMatchType,
  isFlowSubscriptionRecurrence,
  isFlowSubscriptionStatus,
} from '@actual-app/core/shared/flow-subscription';

export type FlowSubscriptionWarningCode =
  | 'low-confidence'
  | 'stale-confirmed'
  | 'expected-date-passed'
  | 'price-changed'
  | 'missing-account'
  | 'missing-category'
  | 'missing-payee'
  | 'duplicate-payee'
  | 'unknown-recurrence';

export type FlowSubscriptionWarning = {
  code: FlowSubscriptionWarningCode;
  previousAmount?: number;
  latestAmount?: number;
};

export type FlowSubscriptionCandidate = {
  candidateId: string;
  name: string;
  normalizedName: string;
  payeeId?: string;
  categoryId?: string;
  accountId?: string;
  amount: number;
  recurrence: FlowSubscriptionRecurrence;
  firstSeen: string;
  lastSeen: string;
  nextExpectedDate: string;
  confidence: number;
  transactionIds: string[];
  warnings: FlowSubscriptionWarning[];
};

export type FlowSubscriptionComputed = {
  subscription: FlowSubscription;
  transactions: FlowTransaction[];
  linkedTransactionCount: number;
  monthlyEquivalent: number;
  yearlyEquivalent: number;
  warnings: FlowSubscriptionWarning[];
};

export type FlowSubscriptionSummary = {
  confirmedCount: number;
  candidateCount: number;
  ignoredOrCancelledCount: number;
  estimatedMonthlyTotal: number;
  estimatedYearlyTotal: number;
  priceChangeWarningCount: number;
};
