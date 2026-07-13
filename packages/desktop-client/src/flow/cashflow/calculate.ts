import type { FlowDebt } from '@actual-app/core/shared/flow-debt';
import type { FlowSubscription } from '@actual-app/core/shared/flow-subscription';

import type { FlowTransaction } from '#flow/actual-adapter';
import type {
  FlowFixedBill,
  FlowIncomePlan,
  FlowSettings,
  FlowVariableSpendingRule,
} from '#flow/planning/types';
import type { FlowTransactionMetadataRecord } from '#flow/transaction-metadata/types';

import type {
  FlowCashflowCalculation,
  FlowCashflowRow,
  FlowCashflowRowType,
  FlowCashflowRun,
  FlowCashflowSummary,
} from './types';

export type FlowCashflowOneOff = {
  enabled: boolean;
  name: string;
  amount: number;
  date: string;
};

export type FlowCashflowCalculationInput = {
  month: string;
  currentDate: string;
  startingCash: number;
  startingCashSource: FlowCashflowRun['startingCashSource'];
  selectedAccountIds: string[];
  safeMinimumBalance: number;
  warningBalance: number;
  oneOff: FlowCashflowOneOff;
  transactions: FlowTransaction[];
  transactionMetadata: FlowTransactionMetadataRecord[];
  settings: FlowSettings;
  subscriptions: FlowSubscription[];
  debts: FlowDebt[];
  sourceWarnings?: string[];
  generatedAt?: string;
};

type PendingRow = Omit<FlowCashflowRow, 'balanceAfter'>;

export function calculateFlowCashflow(
  input: FlowCashflowCalculationInput,
): FlowCashflowCalculation {
  const monthStart = `${input.month}-01`;
  const monthEnd = lastDayOfMonth(input.month);
  const runId = `flow-cashflow-run:${input.month}`;
  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const selectedAccountIds = [...new Set(input.selectedAccountIds)].sort();
  const selectedAccountIdSet = new Set(selectedAccountIds);
  const metadataByTransactionId = new Map(
    input.transactionMetadata.map(record => [
      record.actualTransactionId,
      record,
    ]),
  );
  const warnings = [...(input.sourceWarnings ?? [])];
  const excludedTransactions: FlowTransaction[] = [];
  const includedTransactions = input.transactions.filter(transaction => {
    if (!selectedAccountIdSet.has(transaction.accountId)) {
      return false;
    }

    const metadata = metadataByTransactionId.get(transaction.id);
    if (metadata && !metadata.data.cashflowIncluded) {
      excludedTransactions.push(transaction);
      return false;
    }

    return true;
  });
  const rows: PendingRow[] = [
    createPendingRow({
      id: `${runId}:starting-cash`,
      runId,
      date: monthStart,
      rowType: 'starting-cash',
      name: 'Starting cash',
      inflow: Math.max(0, input.startingCash),
      outflow: Math.max(0, -input.startingCash),
      confirmed: input.startingCashSource === 'manual',
      source: input.startingCashSource,
    }),
    ...createActualRows(runId, includedTransactions),
  ];

  rows.push(
    ...createIncomeRows({
      runId,
      month: input.month,
      currentDate: input.currentDate,
      plans: input.settings.incomePlans,
    }),
  );
  rows.push(
    ...createFixedBillRows({
      runId,
      month: input.month,
      currentDate: input.currentDate,
      bills: input.settings.fixedBills,
    }),
  );

  const subscriptionResult = createSubscriptionRows({
    runId,
    month: input.month,
    currentDate: input.currentDate,
    subscriptions: input.subscriptions,
  });
  rows.push(...subscriptionResult.rows);
  warnings.push(...subscriptionResult.warnings);

  const debtResult = createDebtRows({
    runId,
    month: input.month,
    currentDate: input.currentDate,
    debts: input.debts,
  });
  rows.push(...debtResult.rows);
  warnings.push(...debtResult.warnings);

  const variableResult = createVariableForecastRows({
    runId,
    month: input.month,
    currentDate: input.currentDate,
    rules: input.settings.variableSpendingRules,
    actualTransactions: includedTransactions,
  });
  rows.push(...variableResult.rows);
  warnings.push(...variableResult.warnings);

  if (
    input.oneOff.enabled &&
    input.oneOff.amount > 0 &&
    input.oneOff.date >= monthStart &&
    input.oneOff.date <= monthEnd
  ) {
    rows.push(
      createPendingRow({
        id: `${runId}:one-off`,
        runId,
        date: input.oneOff.date,
        rowType: 'one-off',
        name: input.oneOff.name.trim() || 'One-off test cost',
        inflow: 0,
        outflow: Math.max(0, Math.round(input.oneOff.amount)),
        confirmed: false,
        source: 'manual-one-off',
        notes: 'Test only. No Actual transaction was created.',
      }),
    );
  }

  if (selectedAccountIds.length === 0) {
    warnings.push(
      'No accounts are selected, so Actual transactions are excluded.',
    );
  }
  if (input.startingCashSource === 'manual' && input.startingCash === 0) {
    warnings.push(
      'Manual starting cash is zero. Confirm that this is intentional.',
    );
  }
  if (excludedTransactions.length > 0) {
    warnings.push(
      `${excludedTransactions.length} Actual transaction(s) were excluded by Flow cashflow metadata.`,
    );
  }
  if (
    !input.settings.incomePlans.some(plan => plan.active && plan.amount > 0)
  ) {
    warnings.push('No active Flow Settings income plan is available.');
  }
  if (
    !input.settings.fixedBills.some(bill => bill.active && bill.amount > 0) &&
    subscriptionResult.rows.length === 0 &&
    debtResult.rows.length === 0
  ) {
    warnings.push(
      'No future fixed bill, subscription, or debt source was found.',
    );
  }

  const sortedRows = [...rows].sort(comparePendingRows);
  const completedRows: FlowCashflowRow[] = [];
  let runningBalance = 0;
  let lowestBalance = Number.POSITIVE_INFINITY;
  let firstFailureDate: string | undefined;
  const dangerThreshold = Math.max(0, input.safeMinimumBalance);

  for (const row of sortedRows) {
    runningBalance += row.inflow - row.outflow;
    lowestBalance = Math.min(lowestBalance, runningBalance);
    if (firstFailureDate == null && runningBalance < dangerThreshold) {
      firstFailureDate = row.date;
    }
    completedRows.push({ ...row, balanceAfter: runningBalance });
  }

  if (!Number.isFinite(lowestBalance)) {
    lowestBalance = input.startingCash;
  }

  const status =
    lowestBalance < dangerThreshold
      ? 'danger'
      : lowestBalance < input.warningBalance
        ? 'warning'
        : 'generated';
  const summary = summarizeRows(
    completedRows,
    runningBalance,
    lowestBalance,
    firstFailureDate,
  );
  const nextIncomeDate = completedRows.find(
    row =>
      row.inflow > 0 &&
      row.rowType !== 'starting-cash' &&
      row.date >= planningReferenceDate(input.month, input.currentDate),
  )?.date;
  const run: FlowCashflowRun = {
    id: runId,
    month: input.month,
    runName: `Monthly cashflow ${input.month}`,
    startingCash: input.startingCash,
    startingCashSource: input.startingCashSource,
    selectedAccountIds,
    safeMinimumBalance: Math.max(0, Math.round(input.safeMinimumBalance)),
    warningBalance: Math.max(0, Math.round(input.warningBalance)),
    oneOffName: input.oneOff.enabled
      ? input.oneOff.name.trim() || undefined
      : undefined,
    oneOffAmount: input.oneOff.enabled
      ? Math.max(0, Math.round(input.oneOff.amount))
      : 0,
    oneOffDate: input.oneOff.enabled ? input.oneOff.date : undefined,
    status,
    lowestBalance,
    projectedEndBalance: runningBalance,
    firstFailureDate,
    generatedAt,
  };

  return {
    run,
    rows: completedRows,
    warnings: [...new Set(warnings)],
    nextIncomeDate,
    summary,
  };
}

export function createCalculationFromSavedRun(
  run: FlowCashflowRun,
  rows: FlowCashflowRow[],
  currentDate: string,
): FlowCashflowCalculation {
  const sortedRows = [...rows].sort(compareCashflowRows);
  const summary = summarizeRows(
    sortedRows,
    run.projectedEndBalance,
    run.lowestBalance,
    run.firstFailureDate,
  );
  const nextIncomeDate = sortedRows.find(
    row =>
      row.inflow > 0 &&
      row.rowType !== 'starting-cash' &&
      row.date >= planningReferenceDate(run.month, currentDate),
  )?.date;

  return {
    run,
    rows: sortedRows,
    warnings: ['Loaded saved snapshot. Recalculate to refresh source data.'],
    nextIncomeDate,
    summary,
  };
}

function createActualRows(
  runId: string,
  transactions: FlowTransaction[],
): PendingRow[] {
  return transactions.map(transaction => {
    const isIncome = transaction.amount > 0;
    return createPendingRow({
      id: `${runId}:actual:${transaction.id}`,
      runId,
      date: transaction.date,
      rowType: isIncome ? 'actual-income' : 'actual-expense',
      name:
        transaction.payeeName ||
        transaction.notes ||
        (isIncome ? 'Actual income' : 'Actual expense'),
      accountId: transaction.accountId,
      categoryId: transaction.categoryId,
      inflow: isIncome ? transaction.amount : 0,
      outflow: isIncome ? 0 : Math.abs(transaction.amount),
      confirmed: true,
      source: 'actual-transaction',
      sourceId: transaction.id,
      notes: transaction.notes,
    });
  });
}

function createIncomeRows({
  runId,
  month,
  currentDate,
  plans,
}: {
  runId: string;
  month: string;
  currentDate: string;
  plans: FlowIncomePlan[];
}): PendingRow[] {
  return plans.flatMap(plan => {
    const date = dateFromDay(month, plan.dayOfMonth);
    if (
      !plan.active ||
      plan.amount <= 0 ||
      !isFuturePlanningDate(date, month, currentDate) ||
      !isWithinPlanDates(date, plan.startDate, plan.endDate)
    ) {
      return [];
    }

    return [
      createPendingRow({
        id: `${runId}:income:${plan.id}:${date}`,
        runId,
        date,
        rowType: 'planned-income',
        name: plan.name || 'Planned income',
        accountId: plan.accountId,
        categoryId: plan.categoryId,
        inflow: Math.max(0, Math.round(plan.amount)),
        outflow: 0,
        confirmed: false,
        source: 'flow-income-plan',
        sourceId: plan.id,
        notes: plan.notes,
      }),
    ];
  });
}

function createFixedBillRows({
  runId,
  month,
  currentDate,
  bills,
}: {
  runId: string;
  month: string;
  currentDate: string;
  bills: FlowFixedBill[];
}): PendingRow[] {
  return bills.flatMap(bill => {
    const date = dateFromDay(month, bill.dayOfMonth);
    if (
      !bill.active ||
      bill.amount <= 0 ||
      !isFuturePlanningDate(date, month, currentDate) ||
      !isWithinPlanDates(date, bill.startDate, bill.endDate)
    ) {
      return [];
    }

    return [
      createPendingRow({
        id: `${runId}:bill:${bill.id}:${date}`,
        runId,
        date,
        rowType: 'fixed-bill',
        name: bill.name || 'Fixed bill',
        accountId: bill.accountId,
        categoryId: bill.categoryId,
        inflow: 0,
        outflow: Math.max(0, Math.round(bill.amount)),
        confirmed: false,
        source: 'flow-fixed-bill',
        sourceId: bill.id,
        notes: bill.notes,
      }),
    ];
  });
}

function createSubscriptionRows({
  runId,
  month,
  currentDate,
  subscriptions,
}: {
  runId: string;
  month: string;
  currentDate: string;
  subscriptions: FlowSubscription[];
}): { rows: PendingRow[]; warnings: string[] } {
  const rows: PendingRow[] = [];
  const warnings: string[] = [];

  for (const subscription of subscriptions) {
    if (subscription.status !== 'confirmed' || subscription.amount <= 0) {
      continue;
    }

    const dates = getSubscriptionDates(subscription, month);
    if (dates.length === 0) {
      if (!subscription.nextExpectedDate && !subscription.lastSeen) {
        warnings.push(
          `${subscription.name}: confirmed subscription has no expected or last-seen date.`,
        );
      } else if (
        subscription.recurrence === 'unknown' ||
        subscription.recurrence === 'irregular'
      ) {
        warnings.push(
          `${subscription.name}: unknown or irregular recurrence was excluded because no expected date falls in this month.`,
        );
      }
      continue;
    }

    for (const date of dates) {
      if (!isFuturePlanningDate(date, month, currentDate)) {
        continue;
      }
      rows.push(
        createPendingRow({
          id: `${runId}:subscription:${subscription.id}:${date}`,
          runId,
          date,
          rowType: 'subscription',
          name: subscription.name,
          accountId: subscription.accountId,
          categoryId: subscription.categoryId,
          inflow: 0,
          outflow: Math.max(0, Math.round(subscription.amount)),
          confirmed: false,
          source: 'flow-subscription',
          sourceId: subscription.id,
          notes: subscription.notes,
        }),
      );
    }
  }

  return { rows, warnings };
}

function createDebtRows({
  runId,
  month,
  currentDate,
  debts,
}: {
  runId: string;
  month: string;
  currentDate: string;
  debts: FlowDebt[];
}): { rows: PendingRow[]; warnings: string[] } {
  const rows: PendingRow[] = [];
  const warnings: string[] = [];

  for (const debt of debts) {
    if (!debt.active || debt.status !== 'active') {
      continue;
    }
    const amount = debt.plannedPayment || debt.minimumPayment;
    if (amount <= 0) {
      warnings.push(
        `${debt.name}: active debt has no planned or minimum payment.`,
      );
      continue;
    }
    const date = debt.dueDay
      ? dateFromDay(month, debt.dueDay)
      : lastDayOfMonth(month);
    if (!debt.dueDay) {
      warnings.push(
        `${debt.name}: no due day is set, so the payment is placed on the last day of the month.`,
      );
    }
    if (!isFuturePlanningDate(date, month, currentDate)) {
      continue;
    }
    rows.push(
      createPendingRow({
        id: `${runId}:debt:${debt.id}:${date}`,
        runId,
        date,
        rowType: 'debt-payment',
        name: debt.name,
        accountId: debt.actualAccountId,
        categoryId: debt.actualCategoryId,
        inflow: 0,
        outflow: Math.max(0, Math.round(amount)),
        confirmed: false,
        source: 'flow-debt',
        sourceId: debt.id,
        notes: debt.notes,
      }),
    );
  }

  return { rows, warnings };
}

function createVariableForecastRows({
  runId,
  month,
  currentDate,
  rules,
  actualTransactions,
}: {
  runId: string;
  month: string;
  currentDate: string;
  rules: FlowVariableSpendingRule[];
  actualTransactions: FlowTransaction[];
}): { rows: PendingRow[]; warnings: string[] } {
  const rows: PendingRow[] = [];
  const warnings: string[] = [];
  const activeRules = rules.filter(
    rule => rule.active && rule.monthlyBudget > 0,
  );

  if (activeRules.length === 0) {
    warnings.push(
      'No active variable spending rules are configured in Flow Settings.',
    );
    return { rows, warnings };
  }

  for (const rule of activeRules) {
    if (!rule.categoryId) {
      warnings.push(
        `${rule.name}: variable spending rule has no linked category.`,
      );
      continue;
    }
    const spent = actualTransactions.reduce(
      (sum, transaction) =>
        transaction.categoryId === rule.categoryId && transaction.amount < 0
          ? sum + Math.abs(transaction.amount)
          : sum,
      0,
    );
    const remaining = Math.max(0, Math.round(rule.monthlyBudget) - spent);
    if (remaining === 0) {
      continue;
    }
    const dates = getForecastDates(month, currentDate, rule.forecastMethod);
    const amounts = splitInteger(remaining, dates.length);
    dates.forEach((date, index) => {
      rows.push(
        createPendingRow({
          id: `${runId}:variable:${rule.id}:${date}`,
          runId,
          date,
          rowType: 'variable-forecast',
          name: rule.name || 'Variable spending',
          categoryId: rule.categoryId,
          inflow: 0,
          outflow: amounts[index] ?? 0,
          confirmed: false,
          source: 'flow-variable-rule',
          sourceId: rule.id,
          notes: rule.notes,
        }),
      );
    });
  }

  return { rows, warnings };
}

function getSubscriptionDates(
  subscription: FlowSubscription,
  month: string,
): string[] {
  const monthStart = `${month}-01`;
  const monthEnd = lastDayOfMonth(month);
  const isRecurring = !['unknown', 'irregular'].includes(
    subscription.recurrence,
  );
  let date = subscription.nextExpectedDate;

  if (!date && subscription.lastSeen && isRecurring) {
    date = addRecurrence(subscription.lastSeen, subscription.recurrence);
  }
  if (!date) {
    return [];
  }
  if (!isRecurring) {
    return date >= monthStart && date <= monthEnd ? [date] : [];
  }

  let guard = 0;
  while (date < monthStart && guard < 240) {
    date = addRecurrence(date, subscription.recurrence);
    guard += 1;
  }

  const dates: string[] = [];
  while (date <= monthEnd && guard < 260) {
    if (date >= monthStart) {
      dates.push(date);
    }
    date = addRecurrence(date, subscription.recurrence);
    guard += 1;
  }
  return dates;
}

function getForecastDates(
  month: string,
  currentDate: string,
  method: FlowVariableSpendingRule['forecastMethod'],
): string[] {
  const start = planningReferenceDate(month, currentDate);
  const end = lastDayOfMonth(month);
  if (start > end) {
    return [];
  }
  if (method === 'one-reserve' || method === 'manual') {
    return [end];
  }

  const step = method === 'daily-spread' ? 1 : 7;
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end) {
    dates.push(cursor);
    cursor = addDays(cursor, step);
  }
  return dates;
}

function summarizeRows(
  rows: FlowCashflowRow[],
  projectedEndBalance: number,
  lowestBalance: number,
  firstFailureDate: string | undefined,
): FlowCashflowSummary {
  const sumInflow = (...types: FlowCashflowRowType[]) =>
    rows.reduce(
      (sum, row) => (types.includes(row.rowType) ? sum + row.inflow : sum),
      0,
    );
  const sumOutflow = (...types: FlowCashflowRowType[]) =>
    rows.reduce(
      (sum, row) => (types.includes(row.rowType) ? sum + row.outflow : sum),
      0,
    );
  const fixedBills = sumOutflow('fixed-bill');
  const variableForecast = sumOutflow('variable-forecast');
  const debtPayments = sumOutflow('debt-payment');
  const subscriptions = sumOutflow('subscription');
  const oneOff = sumOutflow('one-off');

  return {
    actualIncome: sumInflow('actual-income'),
    actualExpenses: sumOutflow('actual-expense'),
    plannedIncome: sumInflow('planned-income'),
    plannedOutflows:
      fixedBills + variableForecast + debtPayments + subscriptions + oneOff,
    variableForecast,
    fixedBills,
    debtPayments,
    subscriptions,
    oneOff,
    projectedEndBalance,
    lowestBalance,
    firstFailureDate,
  };
}

function createPendingRow(row: PendingRow): PendingRow {
  return row;
}

function comparePendingRows(left: PendingRow, right: PendingRow): number {
  return (
    left.date.localeCompare(right.date) ||
    rowOrder(left.rowType) - rowOrder(right.rowType) ||
    Number(right.inflow > 0) - Number(left.inflow > 0) ||
    left.name.localeCompare(right.name) ||
    left.id.localeCompare(right.id)
  );
}

function compareCashflowRows(
  left: FlowCashflowRow,
  right: FlowCashflowRow,
): number {
  return comparePendingRows(left, right);
}

function rowOrder(rowType: FlowCashflowRowType): number {
  switch (rowType) {
    case 'starting-cash':
      return 0;
    case 'actual-income':
    case 'actual-expense':
      return 1;
    case 'planned-income':
      return 2;
    default:
      return 3;
  }
}

function planningReferenceDate(month: string, currentDate: string): string {
  const currentMonth = currentDate.slice(0, 7);
  if (month < currentMonth) {
    return addDays(lastDayOfMonth(month), 1);
  }
  if (month > currentMonth) {
    return `${month}-01`;
  }
  return addDays(currentDate, 1);
}

function isFuturePlanningDate(
  date: string,
  month: string,
  currentDate: string,
): boolean {
  return date >= planningReferenceDate(month, currentDate);
}

function isWithinPlanDates(
  date: string,
  startDate: string | undefined,
  endDate: string | undefined,
): boolean {
  return (!startDate || date >= startDate) && (!endDate || date <= endDate);
}

function dateFromDay(month: string, day: number): string {
  const lastDay = Number(lastDayOfMonth(month).slice(-2));
  return `${month}-${String(Math.max(1, Math.min(lastDay, Math.round(day)))).padStart(2, '0')}`;
}

function lastDayOfMonth(month: string): string {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber, 0));
  return date.toISOString().slice(0, 10);
}

function addRecurrence(
  date: string,
  recurrence: FlowSubscription['recurrence'],
): string {
  switch (recurrence) {
    case 'weekly':
      return addDays(date, 7);
    case 'biweekly':
      return addDays(date, 14);
    case 'monthly':
      return addMonthsClamped(date, 1);
    case 'quarterly':
      return addMonthsClamped(date, 3);
    case 'yearly':
      return addMonthsClamped(date, 12);
    case 'irregular':
    case 'unknown':
    default:
      return addMonthsClamped(date, 1);
  }
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function addMonthsClamped(date: string, months: number): string {
  const [year, month, day] = date.split('-').map(Number);
  const value = new Date(Date.UTC(year, month - 1, 1));
  value.setUTCMonth(value.getUTCMonth() + months);
  const lastDay = new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0),
  ).getUTCDate();
  value.setUTCDate(Math.min(day, lastDay));
  return value.toISOString().slice(0, 10);
}

function splitInteger(amount: number, count: number): number[] {
  if (count <= 0) {
    return [];
  }
  const base = Math.floor(amount / count);
  const remainder = amount % count;
  return Array.from({ length: count }, (_, index) =>
    index < remainder ? base + 1 : base,
  );
}
