export type FlowHouseholdRole = 'owner' | 'partner' | 'child' | 'other';

export type FlowSplitMethod = 'shared-50-50' | 'only-member' | 'custom';

export type FlowHouseholdMember = {
  id: string;
  name: string;
  role: FlowHouseholdRole;
  active: boolean;
  defaultAccountId?: string;
};

export type FlowTransactionRules = {
  defaultPaidByMemberId?: string;
  defaultEnteredByMemberId?: string;
  defaultSplitMethod: FlowSplitMethod;
  defaultCashflowIncluded: boolean;
};

export type FlowCashflowSettings = {
  defaultProjectionMode: 'current-month' | 'next-month';
  defaultScenarioId: string;
  minimumSafeBalance: number;
  warningBalance: number;
  defaultStartingBalanceMode: 'actual-accounts' | 'manual';
  includeOffBudgetAccounts: boolean;
  includeTransfers: boolean;
};

export type FlowIncomePlan = {
  id: string;
  name: string;
  memberId?: string;
  amount: number;
  dayOfMonth: number;
  accountId?: string;
  categoryId?: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
  uncertain?: boolean;
  notes?: string;
};

export type FlowFixedBill = {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  accountId?: string;
  categoryId?: string;
  splitMethod: FlowSplitMethod;
  memberId?: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
  notes?: string;
};

export type FlowVariableSpendingRule = {
  id: string;
  name: string;
  categoryId?: string;
  monthlyBudget: number;
  forecastMethod: 'daily-spread' | 'weekly-spread' | 'one-reserve' | 'manual';
  budgetWeight: number;
  active: boolean;
  notes?: string;
};

export type FlowScenario = {
  id: string;
  name: string;
  type: 'base' | 'stress' | 'custom';
  active: boolean;
  incomeMultiplier: number;
  expenseMultiplier: number;
  savingsMultiplier: number;
  notes?: string;
};

export type FlowSettings = {
  version: 1;
  householdMembers: FlowHouseholdMember[];
  transactionRules: FlowTransactionRules;
  cashflowSettings: FlowCashflowSettings;
  incomePlans: FlowIncomePlan[];
  fixedBills: FlowFixedBill[];
  variableSpendingRules: FlowVariableSpendingRule[];
  scenarios: FlowScenario[];
  updatedAt: string;
};

export type FlowPlanningSetup = FlowSettings;

export const flowHouseholdRoles: FlowHouseholdRole[] = [
  'owner',
  'partner',
  'child',
  'other',
];

export const flowSplitMethods: FlowSplitMethod[] = [
  'shared-50-50',
  'only-member',
  'custom',
];

export const flowForecastMethods: FlowVariableSpendingRule['forecastMethod'][] =
  ['daily-spread', 'weekly-spread', 'one-reserve', 'manual'];

export const flowScenarioTypes: FlowScenario['type'][] = [
  'base',
  'stress',
  'custom',
];
