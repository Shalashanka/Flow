export const flowAffordabilityDecisions = [
  'ok',
  'wait',
  'danger',
  'check',
] as const;

export type FlowAffordabilityDecision =
  (typeof flowAffordabilityDecisions)[number];

export const flowAffordabilityPriorities = [
  'low',
  'normal',
  'high',
  'urgent',
] as const;

export type FlowAffordabilityPriority =
  (typeof flowAffordabilityPriorities)[number];

export const flowAffordabilitySharedStatuses = [
  'personal',
  'shared',
  'ignored',
] as const;

export type FlowAffordabilitySharedStatus =
  (typeof flowAffordabilitySharedStatuses)[number];

export const flowAffordabilitySplitMethods = [
  'none',
  'equal',
  'percentage',
  'fixed-amount',
  'custom',
] as const;

export type FlowAffordabilitySplitMethod =
  (typeof flowAffordabilitySplitMethods)[number];

export type FlowAffordabilityCheck = {
  id: string;
  purchaseName: string;
  amount: number;
  plannedDate: string;
  accountId?: string;
  categoryId?: string;
  paidByMemberId?: string;
  sharedStatus: FlowAffordabilitySharedStatus;
  splitMethod: FlowAffordabilitySplitMethod;
  priority: FlowAffordabilityPriority;
  canWait: boolean;
  notes?: string;
  decision: FlowAffordabilityDecision;
  reason?: string;
  recommendedAction?: string;
  monthChecked: string;
  cashflowRunId?: string;
  balanceBefore: number;
  balanceAfter: number;
  lowestBalanceAfter: number;
  firstFailureDate?: string;
  safeMinimumBalance: number;
  warningBalance: number;
  createdAt?: string;
  updatedAt?: string;
};

export type FlowAffordabilitySimulatedRow = {
  date: string;
  name: string;
  inflow: number;
  outflow: number;
  balanceAfter: number;
  source: string;
};

export type FlowAffordabilityCalculation = {
  check: FlowAffordabilityCheck;
  warnings: string[];
  simulatedRows: FlowAffordabilitySimulatedRow[];
  purchaseBalanceBefore?: number;
  personalShare: number;
  accountBalanceBefore?: number;
  accountBalanceAfter?: number;
  cashflowSource: 'fresh' | 'saved' | 'unavailable';
};

export function isFlowAffordabilityDecision(
  value: string | undefined,
): value is FlowAffordabilityDecision {
  return flowAffordabilityDecisions.some(decision => decision === value);
}

export function isFlowAffordabilityPriority(
  value: string | undefined,
): value is FlowAffordabilityPriority {
  return flowAffordabilityPriorities.some(priority => priority === value);
}

export function isFlowAffordabilitySharedStatus(
  value: string | undefined,
): value is FlowAffordabilitySharedStatus {
  return flowAffordabilitySharedStatuses.some(status => status === value);
}

export function isFlowAffordabilitySplitMethod(
  value: string | undefined,
): value is FlowAffordabilitySplitMethod {
  return flowAffordabilitySplitMethods.some(method => method === value);
}
