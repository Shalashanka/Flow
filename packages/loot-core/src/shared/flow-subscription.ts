export const flowSubscriptionStatuses = [
  'candidate',
  'confirmed',
  'ignored',
  'cancelled',
  'paused',
] as const;

export type FlowSubscriptionStatus = (typeof flowSubscriptionStatuses)[number];

export const flowSubscriptionRecurrences = [
  'weekly',
  'biweekly',
  'monthly',
  'quarterly',
  'yearly',
  'irregular',
  'unknown',
] as const;

export type FlowSubscriptionRecurrence =
  (typeof flowSubscriptionRecurrences)[number];

export const flowSubscriptionMatchTypes = [
  'payee-pattern',
  'recurrence',
  'manual',
] as const;

export type FlowSubscriptionMatchType =
  (typeof flowSubscriptionMatchTypes)[number];

export type FlowSubscription = {
  id: string;
  name: string;
  payeeId?: string;
  merchantMatchId?: string;
  actualScheduleId?: string;
  categoryId?: string;
  accountId?: string;
  amount: number;
  recurrence: FlowSubscriptionRecurrence;
  firstSeen?: string;
  lastSeen?: string;
  nextExpectedDate?: string;
  status: FlowSubscriptionStatus;
  confidence: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FlowSubscriptionMatch = {
  id: string;
  subscriptionId: string;
  actualTransactionId: string;
  matchType: FlowSubscriptionMatchType;
  confidence: number;
  createdAt?: string;
  updatedAt?: string;
};

export function isFlowSubscriptionStatus(
  value: string | undefined,
): value is FlowSubscriptionStatus {
  return flowSubscriptionStatuses.some(status => status === value);
}

export function isFlowSubscriptionRecurrence(
  value: string | undefined,
): value is FlowSubscriptionRecurrence {
  return flowSubscriptionRecurrences.some(recurrence => recurrence === value);
}

export function isFlowSubscriptionMatchType(
  value: string | undefined,
): value is FlowSubscriptionMatchType {
  return flowSubscriptionMatchTypes.some(matchType => matchType === value);
}
