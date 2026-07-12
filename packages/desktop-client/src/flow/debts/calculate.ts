import * as monthUtils from '@actual-app/core/shared/months';

import type {
  FlowDebt,
  FlowDebtComputed,
  FlowDebtCurrentBalanceSource,
  FlowDebtSummary,
} from './types';

export type FlowDebtActualAccount = {
  id: string;
  name: string;
  balanceCurrent?: number | null;
  closed?: boolean;
};

export type FlowDebtActualCategory = {
  id: string;
  name: string;
  hidden?: boolean;
};

export function calculateFlowDebts({
  debts,
  accounts,
  categories,
  paidThisMonthByCategoryId,
  month,
}: {
  debts: FlowDebt[];
  accounts: FlowDebtActualAccount[];
  categories: FlowDebtActualCategory[];
  paidThisMonthByCategoryId: Record<string, number>;
  month: string;
}): { rows: FlowDebtComputed[]; summary: FlowDebtSummary } {
  const accountsById = new Map(accounts.map(account => [account.id, account]));
  const categoriesById = new Map(
    categories.map(category => [category.id, category]),
  );
  const rows = debts.map(debt =>
    calculateFlowDebt({
      debt,
      accountsById,
      categoriesById,
      paidThisMonthByCategoryId,
      month,
    }),
  );
  const activeRows = rows.filter(row => row.debt.active);
  const payoffMonths = activeRows.map(row => row.payoffMonths).filter(isNumber);
  const maxPayoffMonths =
    payoffMonths.length > 0 ? Math.max(...payoffMonths) : undefined;

  return {
    rows,
    summary: {
      totalDebtRemaining: activeRows.reduce(
        (sum, row) => sum + row.currentBalance,
        0,
      ),
      totalPlannedMonthlyPayment: activeRows.reduce(
        (sum, row) => sum + row.debt.plannedPayment,
        0,
      ),
      totalMinimumMonthlyPayment: activeRows.reduce(
        (sum, row) => sum + row.debt.minimumPayment,
        0,
      ),
      paidThisMonth: activeRows.reduce(
        (sum, row) => sum + row.paidThisMonth,
        0,
      ),
      activeDebtCount: activeRows.length,
      estimatedDebtFreeMonth:
        maxPayoffMonths == null
          ? undefined
          : addMonthsToMonth(month, maxPayoffMonths),
      warningCount: rows.reduce((sum, row) => sum + row.warnings.length, 0),
    },
  };
}

function calculateFlowDebt({
  debt,
  accountsById,
  categoriesById,
  paidThisMonthByCategoryId,
  month,
}: {
  debt: FlowDebt;
  accountsById: Map<string, FlowDebtActualAccount>;
  categoriesById: Map<string, FlowDebtActualCategory>;
  paidThisMonthByCategoryId: Record<string, number>;
  month: string;
}): FlowDebtComputed {
  const warnings: string[] = [];
  const account = debt.actualAccountId
    ? accountsById.get(debt.actualAccountId)
    : undefined;
  const category = debt.actualCategoryId
    ? categoriesById.get(debt.actualCategoryId)
    : undefined;
  const { currentBalance, source } = getCurrentBalance(debt, account);
  const plannedPayment = Math.max(0, debt.plannedPayment);
  const minimumPayment = Math.max(0, debt.minimumPayment);
  const payoffMonths =
    plannedPayment > 0 && currentBalance > 0
      ? Math.ceil(currentBalance / plannedPayment)
      : undefined;

  if (
    debt.active &&
    !debt.actualAccountId &&
    debt.currentBalanceOverride == null
  ) {
    warnings.push('Active debt has no linked account and no manual balance.');
  }

  if (debt.actualAccountId && !account) {
    warnings.push('Linked Actual account is missing.');
  }

  if (debt.active && !debt.actualCategoryId) {
    warnings.push(
      'No linked payment category. Paid-this-month cannot be read.',
    );
  }

  if (debt.actualCategoryId && !category) {
    warnings.push('Linked Actual category is missing.');
  }

  if (debt.active && plannedPayment < minimumPayment) {
    warnings.push('Planned payment is below the minimum payment.');
  }

  if (debt.active && plannedPayment === 0) {
    warnings.push('Planned payment is zero, so payoff cannot be estimated.');
  }

  if (source === 'unknown') {
    warnings.push(
      'Current balance is unknown. Add a linked account or manual balance.',
    );
  }

  if (debt.active && currentBalance === 0 && debt.status !== 'paid-off') {
    warnings.push('This debt appears paid off but is still active.');
  }

  if (debt.active && debt.status === 'paid-off') {
    warnings.push('Paid-off debt is still marked active.');
  }

  if (debt.status === 'paid-off' && currentBalance > 0) {
    warnings.push('Debt is marked paid off but still has a balance.');
  }

  return {
    debt,
    currentBalance,
    currentBalanceSource: source,
    paidThisMonth: debt.actualCategoryId
      ? (paidThisMonthByCategoryId[debt.actualCategoryId] ?? 0)
      : 0,
    plannedPayment,
    remainingAfterPlannedPayment: Math.max(0, currentBalance - plannedPayment),
    payoffMonths,
    payoffMonth:
      payoffMonths == null ? undefined : addMonthsToMonth(month, payoffMonths),
    estimatedMonthsToPayoff: payoffMonths,
    estimatedPayoffDate:
      payoffMonths == null ? undefined : addMonthsToMonth(month, payoffMonths),
    warnings,
  };
}

function getCurrentBalance(
  debt: FlowDebt,
  account: FlowDebtActualAccount | undefined,
): { currentBalance: number; source: FlowDebtCurrentBalanceSource } {
  if (account && typeof account.balanceCurrent === 'number') {
    return {
      currentBalance: Math.abs(account.balanceCurrent),
      source: 'actual-account',
    };
  }

  if (debt.currentBalanceOverride != null) {
    return {
      currentBalance: Math.max(0, debt.currentBalanceOverride),
      source: 'manual-override',
    };
  }

  if (debt.originalAmount > 0) {
    return {
      currentBalance: debt.originalAmount,
      source: 'original-amount',
    };
  }

  return {
    currentBalance: 0,
    source: 'unknown',
  };
}

function addMonthsToMonth(month: string, monthsToAdd: number): string {
  const [yearText, monthText] = month.split('-');
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    return month;
  }

  return monthUtils.monthFromDate(new Date(year, monthIndex + monthsToAdd, 1));
}

function isNumber(value: number | undefined): value is number {
  return typeof value === 'number';
}
