import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { listen } from '@actual-app/core/platform/client/connection';
import { useQuery } from '@tanstack/react-query';
import { format as formatDate, parseISO } from 'date-fns';

import { FinancialText } from '#components/FinancialText';
import { Page } from '#components/Page';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import type { UseFormatResult } from '#hooks/useFormat';

import { getCurrentMonthCashflowData } from './actual-adapter';
import type { FlowCashflowSummary, FlowTransaction } from './actual-adapter';

const previewTransactionCount = 8;

export function CashflowPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';

  const query = useQuery({
    queryKey: ['flow', 'cashflow', 'current-month'],
    queryFn: getCurrentMonthCashflowData,
  });
  const { refetch } = query;

  useEffect(() => {
    return listen('sync-event', event => {
      if (
        'tables' in event &&
        event.tables.some(table =>
          [
            'accounts',
            'transactions',
            'category_mapping',
            'payee_mapping',
          ].includes(table),
        )
      ) {
        void refetch();
      }
    });
  }, [refetch]);

  const summary = query.data?.summary;
  const transactions = query.data?.transactions ?? [];
  const previewTransactions = transactions.slice(0, previewTransactionCount);

  return (
    <Page header={t('Cashflow')}>
      <View style={{ maxWidth: 1100, gap: 18, paddingTop: 10 }}>
        <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
          <Trans>
            Read-only prototype using existing Flow transaction data.
          </Trans>
        </Text>

        {query.isLoading ? (
          <InfoPanel>
            <Trans>Loading cashflow data...</Trans>
          </InfoPanel>
        ) : query.error ? (
          <ErrorPanel error={query.error} />
        ) : summary ? (
          <>
            <SummaryCards summary={summary} format={format} />
            <TransactionPreview
              transactions={previewTransactions}
              dateFormat={dateFormat}
              formatAmount={amount => format(amount, 'financial')}
            />
          </>
        ) : (
          <InfoPanel>
            <Trans>No cashflow data is available yet.</Trans>
          </InfoPanel>
        )}
      </View>
    </Page>
  );
}

type SummaryCardsProps = {
  summary: FlowCashflowSummary;
  format: UseFormatResult;
};

function SummaryCards({ summary, format }: SummaryCardsProps) {
  const { t } = useTranslation();
  const cards = [
    { label: t('Current month'), value: summary.month },
    {
      label: t('Income this month'),
      value: format(summary.income, 'financial'),
      financial: true,
      color: theme.budgetNumberPositive,
    },
    {
      label: t('Expenses this month'),
      value: format(summary.expenses, 'financial'),
      financial: true,
      color: theme.budgetNumberNegative,
    },
    {
      label: t('Net cashflow this month'),
      value: format(summary.net, 'financial-with-sign'),
      financial: true,
      color:
        summary.net < 0
          ? theme.budgetNumberNegative
          : summary.net > 0
            ? theme.budgetNumberPositive
            : theme.budgetNumberZero,
    },
    {
      label: t('Transactions counted'),
      value: String(summary.transactionCount),
    },
    { label: t('Accounts found'), value: String(summary.accountCount) },
  ];

  return (
    <View
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
      }}
    >
      {cards.map(card => (
        <View
          key={card.label}
          style={{
            border: `1px solid ${theme.tableBorder}`,
            borderRadius: 8,
            backgroundColor: theme.tableBackground,
            padding: 14,
            gap: 8,
          }}
        >
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            {card.label}
          </Text>
          {card.financial ? (
            <FinancialText
              style={{
                color: card.color,
                fontSize: 20,
                fontWeight: 600,
              }}
            >
              {card.value}
            </FinancialText>
          ) : (
            <Text style={{ fontSize: 20, fontWeight: 600 }}>{card.value}</Text>
          )}
        </View>
      ))}
    </View>
  );
}

type TransactionPreviewProps = {
  transactions: FlowTransaction[];
  dateFormat: string;
  formatAmount: (amount: number) => string;
};

function TransactionPreview({
  transactions,
  dateFormat,
  formatAmount,
}: TransactionPreviewProps) {
  const { t } = useTranslation();
  const headers: Array<{ label: string; align: 'left' | 'right' }> = [
    { label: t('Date'), align: 'left' },
    { label: t('Account'), align: 'left' },
    { label: t('Payee or notes'), align: 'left' },
    { label: t('Category'), align: 'left' },
    { label: t('Amount'), align: 'right' },
  ];

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ fontSize: 17, fontWeight: 600 }}>
        <Trans>Transaction preview</Trans>
      </Text>

      {transactions.length === 0 ? (
        <InfoPanel>
          <Trans>
            No current-month transactions found yet. Create or import
            transactions in Flow, then return here.
          </Trans>
        </InfoPanel>
      ) : (
        <View
          style={{
            border: `1px solid ${theme.tableBorder}`,
            borderRadius: 8,
            backgroundColor: theme.tableBackground,
            overflowX: 'auto',
          }}
        >
          <table
            style={{
              width: '100%',
              minWidth: 680,
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr>
                {headers.map(header => (
                  <th
                    key={header.label}
                    style={{
                      padding: '10px 12px',
                      textAlign: header.align,
                      borderBottom: `1px solid ${theme.tableBorder}`,
                      color: theme.pageTextSubdued,
                      fontWeight: 600,
                    }}
                  >
                    {header.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map(transaction => (
                <tr key={transaction.id}>
                  <td style={cellStyle}>
                    {formatTransactionDate(transaction.date, dateFormat)}
                  </td>
                  <td style={cellStyle}>
                    {transaction.accountName ?? t('No account')}
                  </td>
                  <td style={cellStyle}>
                    {transaction.payeeName ||
                      transaction.notes ||
                      t('No payee or notes')}
                  </td>
                  <td style={cellStyle}>
                    {transaction.categoryName ?? t('Uncategorized')}
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      ...styles.tnum,
                      textAlign: 'right',
                    }}
                  >
                    <FinancialText>
                      {formatAmount(transaction.amount)}
                    </FinancialText>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </View>
      )}
    </View>
  );
}

function InfoPanel({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 8,
        backgroundColor: theme.tableBackground,
        padding: 16,
      }}
    >
      <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
        {children}
      </Text>
    </View>
  );
}

function ErrorPanel({ error }: { error: Error }) {
  return (
    <View
      style={{
        border: `1px solid ${theme.errorText}`,
        borderRadius: 8,
        backgroundColor: theme.tableBackground,
        padding: 16,
        gap: 6,
      }}
    >
      <Text style={{ color: theme.errorText, fontWeight: 600 }}>
        <Trans>Cashflow data could not be loaded.</Trans>
      </Text>
      <Text style={{ color: theme.pageTextSubdued }}>{error.message}</Text>
    </View>
  );
}

const cellStyle = {
  padding: '10px 12px',
  borderBottom: `1px solid ${theme.tableBorder}`,
  color: theme.tableText,
  verticalAlign: 'top',
};

function formatTransactionDate(date: string, dateFormat: string) {
  try {
    return formatDate(parseISO(date), dateFormat);
  } catch {
    return date;
  }
}
