export const flowCashflowRowTypes = [
  'starting-cash',
  'actual-income',
  'actual-expense',
  'planned-income',
  'fixed-bill',
  'subscription',
  'debt-payment',
  'variable-forecast',
  'one-off',
  'adjustment',
] as const;

export type FlowCashflowRowType = (typeof flowCashflowRowTypes)[number];

export const flowCashflowRunStatuses = [
  'draft',
  'generated',
  'saved',
  'warning',
  'danger',
] as const;

export type FlowCashflowRunStatus = (typeof flowCashflowRunStatuses)[number];

export const flowCashflowStartingCashSources = [
  'manual',
  'actual-accounts',
] as const;

export type FlowCashflowStartingCashSource =
  (typeof flowCashflowStartingCashSources)[number];

export type FlowCashflowRow = {
  id: string;
  runId?: string;
  date: string;
  rowType: FlowCashflowRowType;
  name: string;
  accountId?: string;
  categoryId?: string;
  inflow: number;
  outflow: number;
  balanceAfter: number;
  confirmed: boolean;
  source: string;
  sourceId?: string;
  notes?: string;
};

export type FlowCashflowRun = {
  id: string;
  month: string;
  runName?: string;
  startingCash: number;
  startingCashSource: FlowCashflowStartingCashSource;
  selectedAccountIds: string[];
  safeMinimumBalance: number;
  warningBalance: number;
  oneOffName?: string;
  oneOffAmount?: number;
  oneOffDate?: string;
  status: FlowCashflowRunStatus;
  lowestBalance: number;
  projectedEndBalance: number;
  firstFailureDate?: string;
  generatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FlowCashflowSummary = {
  actualIncome: number;
  actualExpenses: number;
  plannedIncome: number;
  plannedOutflows: number;
  variableForecast: number;
  fixedBills: number;
  debtPayments: number;
  subscriptions: number;
  oneOff: number;
  projectedEndBalance: number;
  lowestBalance: number;
  firstFailureDate?: string;
};

export type FlowCashflowCalculation = {
  run: FlowCashflowRun;
  rows: FlowCashflowRow[];
  warnings: string[];
  nextIncomeDate?: string;
  summary: FlowCashflowSummary;
};

export function isFlowCashflowRowType(
  value: string | undefined,
): value is FlowCashflowRowType {
  return flowCashflowRowTypes.some(rowType => rowType === value);
}

export function isFlowCashflowRunStatus(
  value: string | undefined,
): value is FlowCashflowRunStatus {
  return flowCashflowRunStatuses.some(status => status === value);
}

export function isFlowCashflowStartingCashSource(
  value: string | undefined,
): value is FlowCashflowStartingCashSource {
  return flowCashflowStartingCashSources.some(source => source === value);
}
