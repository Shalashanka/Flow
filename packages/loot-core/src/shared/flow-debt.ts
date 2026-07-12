export const flowDebtPriorities = ['low', 'normal', 'high', 'urgent'] as const;

export type FlowDebtPriority = (typeof flowDebtPriorities)[number];

export const flowDebtStatuses = [
  'active',
  'paused',
  'paid-off',
  'closed',
  'ignored',
] as const;

export type FlowDebtStatus = (typeof flowDebtStatuses)[number];

export type FlowDebt = {
  id: string;
  name: string;
  lender?: string;
  actualAccountId?: string;
  actualCategoryId?: string;
  originalAmount: number;
  currentBalanceOverride?: number;
  minimumPayment: number;
  plannedPayment: number;
  dueDay?: number;
  interestRateBps: number;
  priority: FlowDebtPriority;
  status: FlowDebtStatus;
  active: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FlowDebtCurrentBalanceSource =
  | 'actual-account'
  | 'manual-override'
  | 'original-amount'
  | 'unknown';

export type FlowDebtComputed = {
  debt: FlowDebt;
  currentBalance: number;
  currentBalanceSource: FlowDebtCurrentBalanceSource;
  paidThisMonth: number;
  plannedPayment: number;
  remainingAfterPlannedPayment: number;
  payoffMonths?: number;
  payoffMonth?: string;
  estimatedMonthsToPayoff?: number;
  estimatedPayoffDate?: string;
  warnings: string[];
};

export type FlowDebtSummary = {
  totalDebtRemaining: number;
  totalPlannedMonthlyPayment: number;
  totalMinimumMonthlyPayment: number;
  paidThisMonth: number;
  activeDebtCount: number;
  estimatedDebtFreeMonth?: string;
  warningCount: number;
};

export function isFlowDebtPriority(
  value: string | undefined,
): value is FlowDebtPriority {
  return flowDebtPriorities.some(priority => priority === value);
}

export function isFlowDebtStatus(
  value: string | undefined,
): value is FlowDebtStatus {
  return flowDebtStatuses.some(status => status === value);
}
