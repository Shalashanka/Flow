import { describe, expect, it } from 'vitest';

import type { FlowCashflowCalculation } from '#flow/cashflow/types';

import { calculateFlowAffordability } from './calculate';
import type { FlowAffordabilityCheck } from './types';

describe('calculateFlowAffordability', () => {
  it('returns OK when the purchase stays above both thresholds', () => {
    const result = calculateFlowAffordability(
      input({ amount: 10000 }, cashflow(100000, 80000, 20000, 40000)),
    );

    expect(result.check.decision).toBe('ok');
    expect(result.check.balanceBefore).toBe(80000);
    expect(result.check.balanceAfter).toBe(70000);
  });

  it('returns WAIT below the warning balance but above the safe minimum', () => {
    const result = calculateFlowAffordability(
      input({ amount: 50000 }, cashflow(100000, 80000, 20000, 40000)),
    );

    expect(result.check.decision).toBe('wait');
    expect(result.check.lowestBalanceAfter).toBe(30000);
  });

  it('returns DANGER below zero', () => {
    const result = calculateFlowAffordability(
      input({ amount: 90000 }, cashflow(100000, 80000, 0, 30000)),
    );

    expect(result.check.decision).toBe('danger');
    expect(result.check.firstFailureDate).toBe('2026-07-25');
  });

  it('returns DANGER below the safe minimum', () => {
    const result = calculateFlowAffordability(
      input({ amount: 65000 }, cashflow(100000, 80000, 20000, 40000)),
    );

    expect(result.check.decision).toBe('danger');
  });

  it('returns CHECK when cashflow is unavailable', () => {
    const result = calculateFlowAffordability(input({}, undefined));

    expect(result.check.decision).toBe('check');
    expect(result.warnings).toContain(
      'No cashflow projection is available for this month.',
    );
  });

  it('uses gross cashflow impact and an equal personal share', () => {
    const result = calculateFlowAffordability(
      input(
        { amount: 90000, sharedStatus: 'shared', splitMethod: 'equal' },
        cashflow(200000, 180000, 20000, 40000),
        { activeHouseholdMemberCount: 3 },
      ),
    );

    expect(result.personalShare).toBe(30000);
    expect(result.check.balanceAfter).toBe(90000);
  });

  it('warns when the planned date is in the past', () => {
    const result = calculateFlowAffordability(
      input({ plannedDate: '2026-07-01' }, cashflow(100000, 80000, 0, 20000)),
    );

    expect(result.warnings).toContain(
      'The planned purchase date is in the past.',
    );
  });
});

function input(
  checkOverrides: Partial<FlowAffordabilityCheck>,
  baseCalculation: FlowCashflowCalculation | undefined,
  overrides: Partial<Parameters<typeof calculateFlowAffordability>[0]> = {},
): Parameters<typeof calculateFlowAffordability>[0] {
  return {
    check: check(checkOverrides),
    baseCalculation,
    cashflowSource: baseCalculation ? 'fresh' : 'unavailable',
    currentDate: '2026-07-13',
    activeHouseholdMemberCount: 2,
    accountBalance: 200000,
    ...overrides,
  };
}

function check(
  overrides: Partial<FlowAffordabilityCheck> = {},
): FlowAffordabilityCheck {
  return {
    id: 'check-1',
    purchaseName: 'Test purchase',
    amount: 10000,
    plannedDate: '2026-07-20',
    accountId: 'account-1',
    categoryId: 'category-1',
    sharedStatus: 'personal',
    splitMethod: 'none',
    priority: 'normal',
    canWait: true,
    decision: 'check',
    monthChecked: '2026-07',
    balanceBefore: 0,
    balanceAfter: 0,
    lowestBalanceAfter: 0,
    safeMinimumBalance: 0,
    warningBalance: 0,
    ...overrides,
  };
}

function cashflow(
  startingCash: number,
  endBalance: number,
  safeMinimumBalance: number,
  warningBalance: number,
): FlowCashflowCalculation {
  return {
    run: {
      id: 'flow-cashflow-run:2026-07',
      month: '2026-07',
      startingCash,
      startingCashSource: 'manual',
      selectedAccountIds: ['account-1'],
      safeMinimumBalance,
      warningBalance,
      status: 'generated',
      lowestBalance: endBalance,
      projectedEndBalance: endBalance,
      generatedAt: '2026-07-13T12:00:00.000Z',
    },
    rows: [
      {
        id: 'starting-cash',
        runId: 'flow-cashflow-run:2026-07',
        date: '2026-07-01',
        rowType: 'starting-cash',
        name: 'Starting cash',
        inflow: startingCash,
        outflow: 0,
        balanceAfter: startingCash,
        confirmed: true,
        source: 'manual',
      },
      {
        id: 'expense',
        runId: 'flow-cashflow-run:2026-07',
        date: '2026-07-25',
        rowType: 'fixed-bill',
        name: 'Bill',
        inflow: 0,
        outflow: startingCash - endBalance,
        balanceAfter: endBalance,
        confirmed: false,
        source: 'flow-fixed-bill',
      },
    ],
    warnings: [],
    nextIncomeDate: '2026-07-26',
    summary: {
      actualIncome: 0,
      actualExpenses: 0,
      plannedIncome: 0,
      plannedOutflows: startingCash - endBalance,
      variableForecast: 0,
      fixedBills: startingCash - endBalance,
      debtPayments: 0,
      subscriptions: 0,
      oneOff: 0,
      projectedEndBalance: endBalance,
      lowestBalance: endBalance,
    },
  };
}
