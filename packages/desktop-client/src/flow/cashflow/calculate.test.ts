import type { FlowDebt } from '@actual-app/core/shared/flow-debt';
import type { FlowSubscription } from '@actual-app/core/shared/flow-subscription';
import { describe, expect, it } from 'vitest';

import type { FlowTransaction } from '#flow/actual-adapter';
import { createDefaultFlowSettings } from '#flow/planning/defaults';

import {
  calculateFlowCashflow,
  createCalculationFromSavedRun,
} from './calculate';
import type { FlowCashflowCalculationInput } from './calculate';
import type { FlowCashflowRow, FlowCashflowRun } from './types';

describe('calculateFlowCashflow', () => {
  it('calculates ending cash from starting cash, income, and expenses', () => {
    const result = calculateFlowCashflow(
      input({
        startingCash: 100000,
        transactions: [
          transaction('income', '2026-07-02', 50000),
          transaction('expense', '2026-07-03', -25000),
        ],
      }),
    );

    expect(result.summary.projectedEndBalance).toBe(125000);
    expect(result.summary.actualIncome).toBe(50000);
    expect(result.summary.actualExpenses).toBe(25000);
  });

  it('detects the lowest balance and first danger date', () => {
    const result = calculateFlowCashflow(
      input({
        startingCash: 10000,
        safeMinimumBalance: 5000,
        transactions: [transaction('expense', '2026-07-03', -6000)],
      }),
    );

    expect(result.run.status).toBe('danger');
    expect(result.summary.lowestBalance).toBe(4000);
    expect(result.summary.firstFailureDate).toBe('2026-07-03');
  });

  it('includes an active debt payment on its due day', () => {
    const result = calculateFlowCashflow(
      input({ debts: [debt({ plannedPayment: 15000, dueDay: 20 })] }),
    );
    const row = result.rows.find(item => item.rowType === 'debt-payment');

    expect(row).toMatchObject({ date: '2026-07-20', outflow: 15000 });
  });

  it('includes a confirmed subscription on its expected date', () => {
    const result = calculateFlowCashflow(
      input({ subscriptions: [subscription()] }),
    );
    const row = result.rows.find(item => item.rowType === 'subscription');

    expect(row).toMatchObject({ date: '2026-07-18', outflow: 1299 });
  });

  it('subtracts actual category spending from variable forecast', () => {
    const settings = createDefaultFlowSettings();
    settings.variableSpendingRules = [
      {
        id: 'groceries',
        name: 'Groceries reserve',
        categoryId: 'category-one',
        monthlyBudget: 30000,
        forecastMethod: 'one-reserve',
        budgetWeight: 1,
        active: true,
      },
    ];
    const result = calculateFlowCashflow(
      input({
        settings,
        transactions: [transaction('groceries', '2026-07-04', -12000)],
      }),
    );

    expect(result.summary.variableForecast).toBe(18000);
  });

  it('turns danger when an enabled one-off cost is too large', () => {
    const result = calculateFlowCashflow(
      input({
        startingCash: 20000,
        oneOff: {
          enabled: true,
          name: 'Test purchase',
          amount: 25000,
          date: '2026-07-25',
        },
      }),
    );

    expect(result.run.status).toBe('danger');
    expect(result.summary.oneOff).toBe(25000);
    expect(result.summary.projectedEndBalance).toBe(-5000);
  });

  it('does not report a past income as next when loading a snapshot', () => {
    const run: FlowCashflowRun = {
      id: 'flow-cashflow-run:2026-07',
      month: '2026-07',
      startingCash: 10000,
      startingCashSource: 'manual',
      selectedAccountIds: ['account-one'],
      safeMinimumBalance: 0,
      warningBalance: 0,
      status: 'generated',
      lowestBalance: 10000,
      projectedEndBalance: 30000,
    };
    const rows: FlowCashflowRow[] = [
      cashflowIncomeRow('past', '2026-07-02', 'actual-income'),
      cashflowIncomeRow('future', '2026-07-20', 'planned-income'),
    ];

    const result = createCalculationFromSavedRun(run, rows, '2026-07-12');

    expect(result.nextIncomeDate).toBe('2026-07-20');
  });
});

function input(
  overrides: Partial<FlowCashflowCalculationInput> = {},
): FlowCashflowCalculationInput {
  return {
    month: '2026-07',
    currentDate: '2026-07-12',
    startingCash: 100000,
    startingCashSource: 'manual',
    selectedAccountIds: ['account-one'],
    safeMinimumBalance: 0,
    warningBalance: 10000,
    oneOff: { enabled: false, name: '', amount: 0, date: '2026-07-12' },
    transactions: [],
    transactionMetadata: [],
    settings: createDefaultFlowSettings(),
    subscriptions: [],
    debts: [],
    generatedAt: '2026-07-12T12:00:00.000Z',
    ...overrides,
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
    accountName: 'Checking',
    categoryId: 'category-one',
    categoryName: 'Groceries',
    payeeName: 'Payee',
  };
}

function debt(overrides: Partial<FlowDebt> = {}): FlowDebt {
  return {
    id: 'debt-one',
    name: 'Loan',
    originalAmount: 100000,
    minimumPayment: 10000,
    plannedPayment: 10000,
    interestRateBps: 0,
    priority: 'normal',
    status: 'active',
    active: true,
    ...overrides,
  };
}

function subscription(): FlowSubscription {
  return {
    id: 'subscription-one',
    name: 'Streaming',
    accountId: 'account-one',
    categoryId: 'category-one',
    amount: 1299,
    recurrence: 'monthly',
    firstSeen: '2026-06-18',
    lastSeen: '2026-06-18',
    nextExpectedDate: '2026-07-18',
    status: 'confirmed',
    confidence: 100,
  };
}

function cashflowIncomeRow(
  id: string,
  date: string,
  rowType: 'actual-income' | 'planned-income',
): FlowCashflowRow {
  return {
    id,
    runId: 'flow-cashflow-run:2026-07',
    date,
    rowType,
    name: 'Income',
    inflow: 10000,
    outflow: 0,
    balanceAfter: 20000,
    confirmed: rowType === 'actual-income',
    source:
      rowType === 'actual-income' ? 'actual-transaction' : 'flow-income-plan',
  };
}
