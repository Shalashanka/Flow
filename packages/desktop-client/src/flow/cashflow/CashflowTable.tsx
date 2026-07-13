import type { CSSProperties } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';

import type { FlowCashflowRow, FlowCashflowRowType } from './types';

export function CashflowTable({
  rows,
  accountNames,
  categoryNames,
  formatAmount,
  formatDate,
}: {
  rows: FlowCashflowRow[];
  accountNames: Map<string, string>;
  categoryNames: Map<string, string>;
  formatAmount: (amount: number) => string;
  formatDate: (date: string) => string;
}) {
  const { t } = useTranslation();

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 17, fontWeight: 600 }}>
        <Trans>Monthly projection</Trans>
      </Text>
      <View style={tableContainerStyle}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>
                <Trans>Date</Trans>
              </th>
              <th style={tableHeaderStyle}>
                <Trans>Type</Trans>
              </th>
              <th style={tableHeaderStyle}>
                <Trans>Name</Trans>
              </th>
              <th style={tableHeaderStyle}>
                <Trans>Account</Trans>
              </th>
              <th style={tableHeaderStyle}>
                <Trans>Category</Trans>
              </th>
              <th style={rightTableHeaderStyle}>
                <Trans>Inflow</Trans>
              </th>
              <th style={rightTableHeaderStyle}>
                <Trans>Outflow</Trans>
              </th>
              <th style={rightTableHeaderStyle}>
                <Trans>Balance after</Trans>
              </th>
              <th style={tableHeaderStyle}>
                <Trans>Source</Trans>
              </th>
              <th style={tableHeaderStyle}>
                <Trans>State</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td style={tableCellStyle}>{formatDate(row.date)}</td>
                <td style={tableCellStyle}>{formatRowType(row.rowType, t)}</td>
                <td style={tableCellStyle}>{row.name}</td>
                <td style={tableCellStyle}>
                  {row.accountId
                    ? (accountNames.get(row.accountId) ?? t('Missing account'))
                    : '-'}
                </td>
                <td style={tableCellStyle}>
                  {row.categoryId
                    ? (categoryNames.get(row.categoryId) ??
                      t('Missing category'))
                    : '-'}
                </td>
                <MoneyCell amount={row.inflow} formatAmount={formatAmount} />
                <MoneyCell amount={row.outflow} formatAmount={formatAmount} />
                <td style={rightTableCellStyle}>
                  <FinancialText
                    style={{
                      ...styles.tnum,
                      color:
                        row.balanceAfter < 0
                          ? theme.budgetNumberNegative
                          : theme.pageText,
                      fontWeight: 600,
                    }}
                  >
                    {formatAmount(row.balanceAfter)}
                  </FinancialText>
                </td>
                <td style={tableCellStyle}>{formatSource(row.source, t)}</td>
                <td style={tableCellStyle}>
                  {row.confirmed ? t('Actual') : t('Planned')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </View>
    </View>
  );
}

function MoneyCell({
  amount,
  formatAmount,
}: {
  amount: number;
  formatAmount: (amount: number) => string;
}) {
  return (
    <td style={rightTableCellStyle}>
      {amount > 0 ? (
        <FinancialText style={styles.tnum}>
          {formatAmount(amount)}
        </FinancialText>
      ) : (
        '-'
      )}
    </td>
  );
}

function formatRowType(
  rowType: FlowCashflowRowType,
  t: (key: string) => string,
): string {
  switch (rowType) {
    case 'starting-cash':
      return t('Starting cash');
    case 'actual-income':
      return t('Actual income');
    case 'actual-expense':
      return t('Actual expense');
    case 'planned-income':
      return t('Planned income');
    case 'fixed-bill':
      return t('Fixed bill');
    case 'subscription':
      return t('Subscription');
    case 'debt-payment':
      return t('Debt payment');
    case 'variable-forecast':
      return t('Variable forecast');
    case 'one-off':
      return t('One-off test');
    case 'adjustment':
    default:
      return t('Adjustment');
  }
}

function formatSource(source: string, t: (key: string) => string): string {
  switch (source) {
    case 'manual':
      return t('Manual');
    case 'actual-accounts':
      return t('Actual accounts');
    case 'actual-transaction':
      return t('Actual transaction');
    case 'flow-income-plan':
      return t('Flow income plan');
    case 'flow-fixed-bill':
      return t('Flow fixed bill');
    case 'flow-subscription':
      return t('Flow subscription');
    case 'flow-debt':
      return t('Flow debt');
    case 'flow-variable-rule':
      return t('Flow variable rule');
    case 'manual-one-off':
      return t('Manual one-off');
    default:
      return source;
  }
}

const tableContainerStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.tableBackground,
  overflowX: 'auto',
};

const tableStyle: CSSProperties = {
  width: '100%',
  minWidth: 1120,
  borderCollapse: 'collapse',
};

const tableHeaderStyle: CSSProperties = {
  borderBottom: `1px solid ${theme.tableBorder}`,
  color: theme.pageTextSubdued,
  padding: '9px 10px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const rightTableHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  textAlign: 'right',
};

const tableCellStyle: CSSProperties = {
  borderBottom: `1px solid ${theme.tableBorder}`,
  color: theme.tableText,
  padding: '9px 10px',
  verticalAlign: 'top',
  whiteSpace: 'nowrap',
};

const rightTableCellStyle: CSSProperties = {
  ...tableCellStyle,
  ...styles.tnum,
  textAlign: 'right',
};
