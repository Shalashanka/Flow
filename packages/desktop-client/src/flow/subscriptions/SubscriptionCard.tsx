import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { FinancialText } from '#components/FinancialText';

import { detailGridStyle, panelStyle } from './styles';
import type {
  FlowSubscriptionComputed,
  FlowSubscriptionStatus,
  FlowSubscriptionWarning,
} from './types';

export function SubscriptionCard({
  row,
  accountName,
  categoryName,
  payeeName,
  isExpanded,
  formatAmount,
  formatDate,
  onSetStatus,
  onEdit,
  onArchive,
  onToggleMatches,
}: {
  row: FlowSubscriptionComputed;
  accountName?: string;
  categoryName?: string;
  payeeName?: string;
  isExpanded: boolean;
  formatAmount: (amount: number) => string;
  formatDate: (date: string | undefined) => string;
  onSetStatus: (status: FlowSubscriptionStatus) => void;
  onEdit: () => void;
  onArchive: () => void;
  onToggleMatches: () => void;
}) {
  const { t } = useTranslation();
  const { subscription } = row;

  return (
    <View style={panelStyle}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ gap: 6, minWidth: 220 }}>
          <Text style={{ fontSize: 18, fontWeight: 600 }}>
            {subscription.name}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <StatusBadge status={subscription.status} />
            <Badge>{formatRecurrence(subscription.recurrence, t)}</Badge>
            <Badge>
              {t('{{confidence}}% confidence', {
                confidence: subscription.confidence,
              })}
            </Badge>
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>Expected charge</Trans>
          </Text>
          <FinancialText
            style={{
              ...styles.tnum,
              color: theme.budgetNumberNegative,
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {formatAmount(subscription.amount)}
          </FinancialText>
        </View>
      </View>

      <View style={detailGridStyle}>
        <Metric
          label={t('Monthly equivalent')}
          value={formatAmount(row.monthlyEquivalent)}
          financial
        />
        <Metric
          label={t('Yearly equivalent')}
          value={formatAmount(row.yearlyEquivalent)}
          financial
        />
        <Metric
          label={t('Account')}
          value={accountName ?? t('Missing linked account')}
        />
        <Metric
          label={t('Category')}
          value={categoryName ?? t('Missing linked category')}
        />
        <Metric
          label={t('Payee')}
          value={payeeName ?? t('Missing linked payee')}
        />
        <Metric
          label={t('First seen')}
          value={formatDate(subscription.firstSeen)}
        />
        <Metric
          label={t('Last seen')}
          value={formatDate(subscription.lastSeen)}
        />
        <Metric
          label={t('Next expected')}
          value={formatDate(subscription.nextExpectedDate)}
        />
        <Metric
          label={t('Linked transactions')}
          value={String(row.linkedTransactionCount)}
        />
        <Metric
          label={t('Actual schedule')}
          value={subscription.actualScheduleId ?? t('Link schedule later')}
        />
      </View>

      {subscription.notes && (
        <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
          {subscription.notes}
        </Text>
      )}

      {row.warnings.length > 0 && (
        <Warnings warnings={row.warnings} formatAmount={formatAmount} />
      )}

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        {subscription.status !== 'confirmed' && (
          <Button variant="normal" onPress={() => onSetStatus('confirmed')}>
            <Trans>Confirm</Trans>
          </Button>
        )}
        {subscription.status !== 'ignored' && (
          <Button variant="normal" onPress={() => onSetStatus('ignored')}>
            <Trans>Ignore</Trans>
          </Button>
        )}
        {subscription.status !== 'cancelled' && (
          <Button variant="normal" onPress={() => onSetStatus('cancelled')}>
            <Trans>Mark cancelled</Trans>
          </Button>
        )}
        <Button variant="normal" onPress={onToggleMatches}>
          {isExpanded ? t('Hide matches') : t('View matches')}
        </Button>
        <Button variant="normal" onPress={onEdit}>
          <Trans>Edit</Trans>
        </Button>
        <Button variant="normal" onPress={onArchive}>
          <Trans>Archive</Trans>
        </Button>
      </View>

      {isExpanded && (
        <MatchesTable
          row={row}
          formatAmount={formatAmount}
          formatDate={formatDate}
        />
      )}
    </View>
  );
}

function MatchesTable({
  row,
  formatAmount,
  formatDate,
}: {
  row: FlowSubscriptionComputed;
  formatAmount: (amount: number) => string;
  formatDate: (date: string | undefined) => string;
}) {
  if (row.transactions.length === 0) {
    return (
      <View style={emptyMatchesStyle}>
        <Text style={{ color: theme.pageTextSubdued }}>
          <Trans>
            No matched transactions are available in the current scan period.
          </Trans>
        </Text>
      </View>
    );
  }

  return (
    <View style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={tableHeaderStyle}>
              <Trans>Date</Trans>
            </th>
            <th style={tableHeaderStyle}>
              <Trans>Payee</Trans>
            </th>
            <th style={tableHeaderStyle}>
              <Trans>Account</Trans>
            </th>
            <th style={tableHeaderStyle}>
              <Trans>Category</Trans>
            </th>
            <th style={rightTableHeaderStyle}>
              <Trans>Amount</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {row.transactions.map(transaction => (
            <tr key={transaction.id}>
              <td style={tableCellStyle}>{formatDate(transaction.date)}</td>
              <td style={tableCellStyle}>{transaction.payeeName ?? '-'}</td>
              <td style={tableCellStyle}>{transaction.accountName ?? '-'}</td>
              <td style={tableCellStyle}>{transaction.categoryName ?? '-'}</td>
              <td style={rightTableCellStyle}>
                <FinancialText style={styles.tnum}>
                  {formatAmount(Math.abs(transaction.amount))}
                </FinancialText>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
}

function Warnings({
  warnings,
  formatAmount,
}: {
  warnings: FlowSubscriptionWarning[];
  formatAmount: (amount: number) => string;
}) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        border: `1px solid ${theme.warningText}`,
        borderRadius: 8,
        backgroundColor: theme.warningBackground,
        padding: 10,
        gap: 6,
      }}
    >
      {warnings.map((warning, index) => (
        <Text
          key={`${warning.code}-${index}`}
          style={{ color: theme.warningText }}
        >
          {formatWarning(warning, formatAmount, t)}
        </Text>
      ))}
    </View>
  );
}

function Metric({
  label,
  value,
  financial,
}: {
  label: string;
  value: string;
  financial?: boolean;
}) {
  return (
    <View style={{ gap: 5, minWidth: 0 }}>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        {label}
      </Text>
      {financial ? (
        <FinancialText
          style={{ ...styles.tnum, color: theme.pageText, fontWeight: 600 }}
        >
          {value}
        </FinancialText>
      ) : (
        <Text style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
          {value}
        </Text>
      )}
    </View>
  );
}

function StatusBadge({ status }: { status: FlowSubscriptionStatus }) {
  const { t } = useTranslation();
  const color =
    status === 'confirmed'
      ? theme.budgetNumberPositive
      : status === 'candidate'
        ? theme.warningText
        : status === 'cancelled'
          ? theme.errorText
          : theme.pageTextSubdued;

  return <Badge color={color}>{formatStatus(status, t)}</Badge>;
}

function Badge({
  color = theme.pageTextSubdued,
  children,
}: {
  color?: string;
  children: ReactNode;
}) {
  return (
    <Text
      style={{
        border: `1px solid ${color}`,
        borderRadius: 999,
        color,
        padding: '2px 8px',
        fontSize: 12,
      }}
    >
      {children}
    </Text>
  );
}

function formatWarning(
  warning: FlowSubscriptionWarning,
  formatAmount: (amount: number) => string,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  switch (warning.code) {
    case 'low-confidence':
      return t('Low-confidence candidate. Review it before confirming.');
    case 'stale-confirmed':
      return t(
        'No recent matched transaction was found for this subscription.',
      );
    case 'expected-date-passed':
      return t('The next expected date has passed.');
    case 'price-changed':
      return t('Price changed from about {{previous}} to {{latest}}.', {
        previous: formatAmount(warning.previousAmount ?? 0),
        latest: formatAmount(warning.latestAmount ?? 0),
      });
    case 'missing-account':
      return t('The linked Actual account is missing.');
    case 'missing-category':
      return t('The linked Actual category is missing.');
    case 'missing-payee':
      return t('The linked Actual payee is missing.');
    case 'duplicate-payee':
      return t('Another subscription uses the same Actual payee.');
    case 'unknown-recurrence':
      return t('The recurrence is unknown or irregular.');
    default:
      return t('Subscription warning.');
  }
}

function formatStatus(
  status: FlowSubscriptionStatus,
  t: (key: string) => string,
): string {
  switch (status) {
    case 'confirmed':
      return t('Confirmed');
    case 'ignored':
      return t('Ignored');
    case 'cancelled':
      return t('Cancelled');
    case 'paused':
      return t('Paused');
    case 'candidate':
    default:
      return t('Candidate');
  }
}

function formatRecurrence(
  recurrence: FlowSubscriptionComputed['subscription']['recurrence'],
  t: (key: string) => string,
): string {
  switch (recurrence) {
    case 'weekly':
      return t('Weekly');
    case 'biweekly':
      return t('Every two weeks');
    case 'monthly':
      return t('Monthly');
    case 'quarterly':
      return t('Quarterly');
    case 'yearly':
      return t('Yearly');
    case 'irregular':
      return t('Irregular');
    case 'unknown':
    default:
      return t('Unknown');
  }
}

const emptyMatchesStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.pageBackground,
  padding: 12,
};

const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  backgroundColor: theme.pageBackground,
};

const tableHeaderStyle: CSSProperties = {
  borderBottom: `1px solid ${theme.tableBorder}`,
  color: theme.pageText,
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
  color: theme.pageText,
  padding: '9px 10px',
  whiteSpace: 'nowrap',
};

const rightTableCellStyle: CSSProperties = {
  ...tableCellStyle,
  textAlign: 'right',
};
