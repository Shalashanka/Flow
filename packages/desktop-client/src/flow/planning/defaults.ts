import type {
  FlowCashflowSettings,
  FlowFixedBill,
  FlowHouseholdMember,
  FlowIncomePlan,
  FlowScenario,
  FlowSettings,
  FlowTransactionRules,
  FlowVariableSpendingRule,
} from './types';

export function createFlowId(prefix: string): string {
  const randomValue =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return `${prefix}-${randomValue}`;
}

export function createDefaultFlowSettings(): FlowSettings {
  const householdMembers: FlowHouseholdMember[] = [
    {
      id: 'member-person-1',
      name: 'Person 1',
      role: 'owner',
      active: true,
    },
    {
      id: 'member-person-2',
      name: 'Person 2',
      role: 'partner',
      active: true,
    },
  ];

  const scenarios: FlowScenario[] = [
    createScenario({
      id: 'scenario-base',
      name: 'Base',
      type: 'base',
      active: true,
    }),
    createScenario({
      id: 'scenario-safe-mode',
      name: 'Safe Mode',
      type: 'stress',
      active: true,
      expenseMultiplier: 0.9,
    }),
    createScenario({
      id: 'scenario-conservative',
      name: 'Conservative',
      type: 'stress',
      active: true,
      incomeMultiplier: 0.95,
      expenseMultiplier: 1.1,
    }),
    createScenario({
      id: 'scenario-one-income-missing',
      name: 'One income missing',
      type: 'stress',
      active: true,
      incomeMultiplier: 0.5,
    }),
    createScenario({
      id: 'scenario-salary-delayed',
      name: 'Salary delayed',
      type: 'stress',
      active: true,
      incomeMultiplier: 0.8,
    }),
  ];

  return {
    version: 1,
    householdMembers,
    transactionRules: createTransactionRules(),
    cashflowSettings: createCashflowSettings(),
    incomePlans: [],
    fixedBills: [],
    variableSpendingRules: [],
    scenarios,
    updatedAt: new Date().toISOString(),
  };
}

export function createHouseholdMember(
  fields: Partial<FlowHouseholdMember> = {},
): FlowHouseholdMember {
  return {
    id: createFlowId('member'),
    name: '',
    role: 'other',
    active: true,
    ...fields,
  };
}

export function createTransactionRules(
  fields: Partial<FlowTransactionRules> = {},
): FlowTransactionRules {
  return {
    defaultSplitMethod: 'shared-50-50',
    defaultCashflowIncluded: true,
    ...fields,
  };
}

export function createCashflowSettings(
  fields: Partial<FlowCashflowSettings> = {},
): FlowCashflowSettings {
  return {
    defaultProjectionMode: 'current-month',
    defaultScenarioId: 'scenario-base',
    minimumSafeBalance: 0,
    warningBalance: 30000,
    defaultStartingBalanceMode: 'actual-accounts',
    includeOffBudgetAccounts: false,
    includeTransfers: false,
    ...fields,
  };
}

export function createIncomePlan(
  fields: Partial<FlowIncomePlan> = {},
): FlowIncomePlan {
  return {
    id: createFlowId('income'),
    name: '',
    amount: 0,
    dayOfMonth: 1,
    active: true,
    uncertain: false,
    ...fields,
  };
}

export function createFixedBill(
  fields: Partial<FlowFixedBill> = {},
): FlowFixedBill {
  return {
    id: createFlowId('bill'),
    name: '',
    amount: 0,
    dayOfMonth: 1,
    splitMethod: 'shared-50-50',
    active: true,
    ...fields,
  };
}

export function createVariableSpendingRule(
  fields: Partial<FlowVariableSpendingRule> = {},
): FlowVariableSpendingRule {
  return {
    id: createFlowId('variable'),
    name: '',
    monthlyBudget: 0,
    forecastMethod: 'daily-spread',
    budgetWeight: 1,
    active: true,
    ...fields,
  };
}

export function createScenario(
  fields: Partial<FlowScenario> = {},
): FlowScenario {
  return {
    id: createFlowId('scenario'),
    name: '',
    type: 'custom',
    active: true,
    incomeMultiplier: 1,
    expenseMultiplier: 1,
    savingsMultiplier: 1,
    ...fields,
  };
}
