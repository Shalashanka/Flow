import { send } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import { q } from '@actual-app/core/shared/query';

import { aqlQuery } from '#queries/aqlQuery';

export type FlowDateRange = {
  start: string;
  end: string;
};

export type FlowAccount = {
  id: string;
  name: string;
  balance?: number;
  offBudget?: boolean;
  closed?: boolean;
};

export type FlowTransaction = {
  id: string;
  date: string;
  accountId: string;
  accountName?: string;
  categoryId?: string;
  categoryName?: string;
  payeeId?: string;
  payeeName?: string;
  amount: number;
  notes?: string;
  cleared?: boolean;
  reconciled?: boolean;
};

export type FlowCashflowSummary = {
  month: string;
  income: number;
  expenses: number;
  net: number;
  accountCount: number;
  transactionCount: number;
};

export type FlowCashflowData = {
  summary: FlowCashflowSummary;
  transactions: FlowTransaction[];
};

export function getCurrentMonthDateRange(): FlowDateRange & { month: string } {
  const month = monthUtils.monthFromDate(new Date());
  return {
    month,
    start: monthUtils.firstDayOfMonth(month),
    end: monthUtils.lastDayOfMonth(month),
  };
}

export async function getFlowAccounts(): Promise<FlowAccount[]> {
  const accounts = await send('accounts-get');

  return accounts
    .filter(account => !account.tombstone)
    .map(account => ({
      id: account.id,
      name: account.name,
      offBudget: Boolean(account.offbudget),
      closed: Boolean(account.closed),
    }));
}

export async function getFlowTransactions(
  range: FlowDateRange,
): Promise<FlowTransaction[]> {
  const response: unknown = await aqlQuery(
    q('transactions')
      .filter({
        $and: [{ date: { $gte: range.start } }, { date: { $lte: range.end } }],
        'account.offbudget': false,
        'payee.transfer_acct': null,
      })
      .orderBy([{ date: 'desc' }, { sort_order: 'desc' }])
      .options({ splits: 'grouped' })
      .select([
        'id',
        'date',
        'account',
        'category',
        'payee',
        'amount',
        'notes',
        'cleared',
        'reconciled',
        { accountName: 'account.name' },
        { categoryName: 'category.name' },
        { payeeName: 'payee.name' },
      ]),
  );

  return getDataRows(response)
    .map(normalizeTransaction)
    .filter(transaction => transaction !== null);
}

export async function getCurrentMonthCashflowSummary(): Promise<FlowCashflowSummary> {
  const data = await getCurrentMonthCashflowData();
  return data.summary;
}

export async function getCurrentMonthCashflowData(): Promise<FlowCashflowData> {
  const { month, ...range } = getCurrentMonthDateRange();
  const [accounts, transactions] = await Promise.all([
    getFlowAccounts(),
    getFlowTransactions(range),
  ]);

  return {
    summary: calculateCashflowSummary(month, accounts, transactions),
    transactions,
  };
}

export function calculateCashflowSummary(
  month: string,
  accounts: FlowAccount[],
  transactions: FlowTransaction[],
): FlowCashflowSummary {
  const income = transactions.reduce(
    (sum, transaction) =>
      transaction.amount > 0 ? sum + transaction.amount : sum,
    0,
  );
  const expenses = Math.abs(
    transactions.reduce(
      (sum, transaction) =>
        transaction.amount < 0 ? sum + transaction.amount : sum,
      0,
    ),
  );

  return {
    month,
    income,
    expenses,
    net: income - expenses,
    accountCount: accounts.length,
    transactionCount: transactions.length,
  };
}

function getDataRows(response: unknown): unknown[] {
  if (
    response &&
    typeof response === 'object' &&
    'data' in response &&
    Array.isArray(response.data)
  ) {
    return response.data;
  }

  return [];
}

function normalizeTransaction(row: unknown): FlowTransaction | null {
  if (!row || typeof row !== 'object') {
    return null;
  }

  const id = getString(getValue(row, 'id'));
  const date = getString(getValue(row, 'date'));
  const accountId = getString(getValue(row, 'account'));
  const amount = getNumber(getValue(row, 'amount'));

  if (!id || !date || !accountId || amount == null) {
    return null;
  }

  return {
    id,
    date,
    accountId,
    accountName: getString(getValue(row, 'accountName')),
    categoryId: getString(getValue(row, 'category')),
    categoryName: getString(getValue(row, 'categoryName')),
    payeeId: getString(getValue(row, 'payee')),
    payeeName: getString(getValue(row, 'payeeName')),
    amount,
    notes: getString(getValue(row, 'notes')),
    cleared: getBoolean(getValue(row, 'cleared')),
    reconciled: getBoolean(getValue(row, 'reconciled')),
  };
}

function getValue(record: object, key: string): unknown {
  return Object.hasOwn(record, key) ? Reflect.get(record, key) : undefined;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return undefined;
}
