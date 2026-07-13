import type { FlowCashflowCalculation } from '#flow/cashflow/types';

import type {
  FlowAffordabilityCalculation,
  FlowAffordabilityCheck,
  FlowAffordabilityDecision,
  FlowAffordabilitySimulatedRow,
} from './types';

export type FlowAffordabilityCalculationInput = {
  check: FlowAffordabilityCheck;
  baseCalculation?: FlowCashflowCalculation;
  cashflowSource: 'fresh' | 'saved' | 'unavailable';
  currentDate: string;
  activeHouseholdMemberCount: number;
  accountBalance?: number;
};

type DecisionResult = {
  decision: FlowAffordabilityDecision;
  reason: string;
  recommendedAction: string;
};

export function calculateFlowAffordability(
  input: FlowAffordabilityCalculationInput,
): FlowAffordabilityCalculation {
  const check = normalizeCheck(input.check);
  const warnings: string[] = [];
  const accountBalanceAfter =
    input.accountBalance == null
      ? undefined
      : input.accountBalance - check.amount;
  const personalShare = calculatePersonalShare(
    check,
    input.activeHouseholdMemberCount,
    warnings,
  );

  addInputWarnings(input, check, warnings);

  if (!canCalculate(check, input.baseCalculation)) {
    return {
      check: {
        ...check,
        decision: 'check',
        reason:
          'Check cashflow first: Flow could not generate a reliable projection for this month.',
        recommendedAction:
          'Generate or save a cashflow projection with a confirmed starting balance, then calculate again.',
      },
      warnings: unique(warnings),
      simulatedRows: [],
      personalShare,
      accountBalanceBefore: input.accountBalance,
      accountBalanceAfter,
      cashflowSource: 'unavailable',
    };
  }

  const baseCalculation = input.baseCalculation;
  const simulation = simulatePurchase(baseCalculation, check);
  const safeMinimumBalance = Math.max(
    0,
    baseCalculation.run.safeMinimumBalance,
  );
  const warningBalance = Math.max(
    safeMinimumBalance,
    baseCalculation.run.warningBalance,
  );
  const firstFailureDate = simulation.rows.find(
    row => row.balanceAfter < safeMinimumBalance,
  )?.date;
  const decisionResult = decide({
    lowestBalance: simulation.lowestBalance,
    safeMinimumBalance,
    warningBalance,
    firstFailureDate,
    accountBalanceAfter,
    canWait: check.canWait,
    nextIncomeDate: baseCalculation.nextIncomeDate,
  });

  return {
    check: {
      ...check,
      decision: decisionResult.decision,
      reason: decisionResult.reason,
      recommendedAction: decisionResult.recommendedAction,
      monthChecked: check.plannedDate.slice(0, 7),
      cashflowRunId: baseCalculation.run.id,
      balanceBefore: baseCalculation.summary.projectedEndBalance,
      balanceAfter: simulation.endBalance,
      lowestBalanceAfter: simulation.lowestBalance,
      firstFailureDate,
      safeMinimumBalance,
      warningBalance,
    },
    warnings: unique(warnings),
    simulatedRows: simulation.rows,
    purchaseBalanceBefore: simulation.purchaseBalanceBefore,
    personalShare,
    accountBalanceBefore: input.accountBalance,
    accountBalanceAfter,
    cashflowSource: input.cashflowSource,
  };
}

function normalizeCheck(check: FlowAffordabilityCheck): FlowAffordabilityCheck {
  return {
    ...check,
    purchaseName: check.purchaseName.trim(),
    amount: Math.max(0, Math.round(check.amount)),
    monthChecked: check.plannedDate.slice(0, 7),
    balanceBefore: Math.round(check.balanceBefore),
    balanceAfter: Math.round(check.balanceAfter),
    lowestBalanceAfter: Math.round(check.lowestBalanceAfter),
    safeMinimumBalance: Math.max(0, Math.round(check.safeMinimumBalance)),
    warningBalance: Math.max(0, Math.round(check.warningBalance)),
  };
}

function canCalculate(
  check: FlowAffordabilityCheck,
  baseCalculation: FlowCashflowCalculation | undefined,
): baseCalculation is FlowCashflowCalculation {
  return Boolean(
    check.purchaseName &&
    check.amount > 0 &&
    check.accountId &&
    check.categoryId &&
    /^\d{4}-\d{2}-\d{2}$/.test(check.plannedDate) &&
    baseCalculation &&
    baseCalculation.rows.length > 0 &&
    baseCalculation.run.month === check.plannedDate.slice(0, 7),
  );
}

function simulatePurchase(
  baseCalculation: FlowCashflowCalculation,
  check: FlowAffordabilityCheck,
): {
  rows: FlowAffordabilitySimulatedRow[];
  endBalance: number;
  lowestBalance: number;
  purchaseBalanceBefore: number;
} {
  const purchaseId = `affordability:${check.id || 'draft'}`;
  const pendingRows = [
    ...baseCalculation.rows.map((row, index) => ({
      id: row.id,
      index,
      date: row.date,
      name: row.name,
      inflow: row.inflow,
      outflow: row.outflow,
      source: row.source,
      isPurchase: false,
    })),
    {
      id: purchaseId,
      index: baseCalculation.rows.length,
      date: check.plannedDate,
      name: check.purchaseName,
      inflow: 0,
      outflow: check.amount,
      source: 'affordability-simulation',
      isPurchase: true,
    },
  ].sort(
    (left, right) =>
      left.date.localeCompare(right.date) ||
      Number(left.isPurchase) - Number(right.isPurchase) ||
      left.index - right.index ||
      left.id.localeCompare(right.id),
  );

  const rows: FlowAffordabilitySimulatedRow[] = [];
  let balance = 0;
  let lowestBalance = Number.POSITIVE_INFINITY;
  let purchaseBalanceBefore = 0;

  for (const row of pendingRows) {
    if (row.isPurchase) {
      purchaseBalanceBefore = balance;
    }
    balance += row.inflow - row.outflow;
    lowestBalance = Math.min(lowestBalance, balance);
    rows.push({
      date: row.date,
      name: row.name,
      inflow: row.inflow,
      outflow: row.outflow,
      balanceAfter: balance,
      source: row.source,
    });
  }

  return {
    rows,
    endBalance: balance,
    lowestBalance: Number.isFinite(lowestBalance) ? lowestBalance : balance,
    purchaseBalanceBefore,
  };
}

function decide({
  lowestBalance,
  safeMinimumBalance,
  warningBalance,
  firstFailureDate,
  accountBalanceAfter,
  canWait,
  nextIncomeDate,
}: {
  lowestBalance: number;
  safeMinimumBalance: number;
  warningBalance: number;
  firstFailureDate?: string;
  accountBalanceAfter?: number;
  canWait: boolean;
  nextIncomeDate?: string;
}): DecisionResult {
  if (accountBalanceAfter != null && accountBalanceAfter < 0) {
    return {
      decision: 'danger',
      reason: 'Danger: the selected account would go below zero.',
      recommendedAction:
        'Use another account, reduce the purchase amount, or wait for more money to arrive.',
    };
  }

  if (lowestBalance < 0) {
    return {
      decision: 'danger',
      reason: `Danger: this purchase makes projected cash go below zero${formatFailureSuffix(firstFailureDate)}.`,
      recommendedAction: getWaitAction(canWait, nextIncomeDate),
    };
  }

  if (lowestBalance < safeMinimumBalance) {
    return {
      decision: 'danger',
      reason: `Danger: this purchase breaks your safe minimum balance${formatFailureSuffix(firstFailureDate)}.`,
      recommendedAction: getWaitAction(canWait, nextIncomeDate),
    };
  }

  if (lowestBalance < warningBalance) {
    return {
      decision: 'wait',
      reason:
        'Wait: the month stays positive, but your lowest balance falls below the warning level.',
      recommendedAction: getWaitAction(canWait, nextIncomeDate),
    };
  }

  return {
    decision: 'ok',
    reason: "OK: the purchase fits inside this month's projected cashflow.",
    recommendedAction:
      'The projection remains above both safety thresholds. Review the selected account before buying.',
  };
}

function addInputWarnings(
  input: FlowAffordabilityCalculationInput,
  check: FlowAffordabilityCheck,
  warnings: string[],
) {
  if (!check.purchaseName) {
    warnings.push('Enter a purchase name.');
  }
  if (check.amount <= 0) {
    warnings.push('Enter a purchase amount greater than zero.');
  }
  if (!check.accountId) {
    warnings.push(
      'No account is selected, so account impact cannot be checked.',
    );
  } else if (input.accountBalance == null) {
    warnings.push('The selected account balance could not be checked.');
  }
  if (!check.categoryId) {
    warnings.push('No category is selected.');
  }
  if (check.plannedDate < input.currentDate) {
    warnings.push('The planned purchase date is in the past.');
  }
  if (
    input.baseCalculation &&
    input.baseCalculation.run.month !== check.plannedDate.slice(0, 7)
  ) {
    warnings.push('The cashflow projection does not match the purchase month.');
  }
  if (!input.baseCalculation) {
    warnings.push('No cashflow projection is available for this month.');
  }
}

function calculatePersonalShare(
  check: FlowAffordabilityCheck,
  activeHouseholdMemberCount: number,
  warnings: string[],
): number {
  if (check.sharedStatus !== 'shared') {
    return check.amount;
  }
  if (activeHouseholdMemberCount <= 0) {
    warnings.push(
      'This is shared, but no active household members are available.',
    );
    return check.amount;
  }
  if (check.splitMethod !== 'equal') {
    warnings.push(
      'Only equal split estimates are calculated in this affordability check.',
    );
    return check.amount;
  }
  return Math.round(check.amount / activeHouseholdMemberCount);
}

function getWaitAction(canWait: boolean, nextIncomeDate?: string): string {
  if (canWait && nextIncomeDate) {
    return `Wait until after the next projected income on ${formatDate(nextIncomeDate)}, then calculate again.`;
  }
  if (canWait) {
    return 'Wait for more available cash or reduce the purchase amount, then calculate again.';
  }
  return 'Reduce the amount, use a safer account, or adjust the monthly plan before buying.';
}

function formatFailureSuffix(date: string | undefined): string {
  return date ? ` on ${formatDate(date)}` : '';
}

function formatDate(date: string): string {
  const [year, month, day] = date.split('-');
  return year && month && day ? `${day}/${month}/${year}` : date;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
