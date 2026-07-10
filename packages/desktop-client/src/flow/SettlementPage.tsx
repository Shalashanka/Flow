import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgCheckCircle1 } from '@actual-app/components/icons/v2';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import { useQuery } from '@tanstack/react-query';
import { format as formatDate, parseISO } from 'date-fns';

import { FinancialText } from '#components/FinancialText';
import { Page } from '#components/Page';
import { DateSelect } from '#components/select/DateSelect';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';

import { getFlowSettings } from './planning/storage';
import { calculateFlowSettlement } from './settlement/calculate';
import {
  clearFlowSettlementSnapshot,
  getSavedFlowSettlements,
  markFlowSettlementTransactionsSettled,
  saveFlowSettlementSnapshot,
} from './settlement/storage';
import type {
  FlowSettlementCalculation,
  FlowSettlementItem,
  FlowSettlementSnapshot,
  FlowSettlementSummary,
} from './settlement/types';

type StatusState =
  | { kind: 'saved' | 'cleared' | 'loaded' | 'calculated' }
  | { kind: 'settled' | 'item-settled'; updated: number }
  | { kind: 'error'; message: string };

type SettlementMember = {
  id: string;
  name: string;
};

const receiverMoneyColor = '#8ee6a8';

export function SettlementPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const [selectedMonth, setSelectedMonth] = useState(() =>
    monthUtils.monthFromDate(new Date()),
  );
  const [calculation, setCalculation] =
    useState<FlowSettlementCalculation | null>(null);
  const [isCalculating, setCalculating] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [isSettling, setSettling] = useState(false);
  const [status, setStatus] = useState<StatusState | null>(null);
  const isValidMonth = /^\d{4}-\d{2}$/.test(selectedMonth);
  const selectedDate = monthUtils.firstDayOfMonth(selectedMonth);

  const savedQuery = useQuery({
    queryKey: ['flow', 'settlement', 'saved', selectedMonth],
    queryFn: () => getSavedFlowSettlements(selectedMonth),
    enabled: isValidMonth,
  });
  const settingsQuery = useQuery({
    queryKey: ['flow', 'settings', 'settlement-members'],
    queryFn: getFlowSettings,
  });

  async function handleCalculate() {
    if (!isValidMonth) {
      setStatus({
        kind: 'error',
        message: t('Use YYYY-MM format before calculating settlement.'),
      });
      return;
    }

    setCalculating(true);
    setStatus(null);

    try {
      const nextCalculation = await calculateFlowSettlement(selectedMonth);
      setCalculation(nextCalculation);
      setStatus({ kind: 'calculated' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Settlement could not be calculated. Try again.'),
      });
    } finally {
      setCalculating(false);
    }
  }

  async function handleSave() {
    if (!calculation) {
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      await saveFlowSettlementSnapshot(calculation);
      await savedQuery.refetch();
      setStatus({ kind: 'saved' });
    } catch {
      setStatus({
        kind: 'error',
        message: t('Settlement snapshot could not be saved. Try again.'),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleClear() {
    if (!isValidMonth) {
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      await clearFlowSettlementSnapshot(selectedMonth);
      await savedQuery.refetch();
      setStatus({ kind: 'cleared' });
    } catch {
      setStatus({
        kind: 'error',
        message: t('Saved settlement could not be cleared. Try again.'),
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkSettled() {
    const allItems = calculation?.items ?? savedQuery.data?.items ?? [];
    const itemsToSettle = allItems.filter(
      item => item.settlementStatus !== 'settled',
    );
    const summariesToClose =
      calculation?.summaries ?? savedQuery.data?.settlements ?? [];

    if (itemsToSettle.length === 0) {
      setStatus({
        kind: 'error',
        message: t('There are no settlement items to mark as settled.'),
      });
      return;
    }

    setSettling(true);
    setStatus(null);

    try {
      const settledCalculation: FlowSettlementCalculation = {
        month: selectedMonth,
        generatedAt: new Date().toISOString(),
        members: getSettlementMembers(settingsQuery.data, calculation),
        items: allItems.map(item => ({
          ...item,
          settlementStatus: 'settled',
        })),
        summaries: summariesToClose.map(summary => ({
          ...summary,
          status: 'closed',
        })),
        warnings: calculation?.warnings ?? [],
      };
      await saveFlowSettlementSnapshot(settledCalculation);
      const result = await markFlowSettlementTransactionsSettled(
        selectedMonth,
        itemsToSettle,
      );

      await savedQuery.refetch();
      setCalculation(settledCalculation);
      setStatus({ kind: 'settled', updated: result.updated });
      window.alert(
        t(
          'Settlement statuses were updated to settled. Remember to create the transfer transactions in Actual so the real money movement is recorded.',
        ),
      );
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Transaction settlement statuses could not be updated.'),
      });
    } finally {
      setSettling(false);
    }
  }

  async function handleMarkItemSettled(itemToSettle: FlowSettlementItem) {
    const allItems = calculation?.items ?? savedQuery.data?.items ?? [];
    const matchingItems = allItems.filter(
      item =>
        item.actualTransactionId === itemToSettle.actualTransactionId &&
        item.settlementStatus !== 'settled',
    );
    const summariesToClose =
      calculation?.summaries ?? savedQuery.data?.settlements ?? [];

    if (matchingItems.length === 0) {
      setStatus({
        kind: 'error',
        message: t('This transaction is already settled.'),
      });
      return;
    }

    setSettling(true);
    setStatus(null);

    try {
      const result = await markFlowSettlementTransactionsSettled(
        selectedMonth,
        matchingItems,
      );
      const settledCalculation: FlowSettlementCalculation = {
        month: selectedMonth,
        generatedAt: new Date().toISOString(),
        members: getSettlementMembers(settingsQuery.data, calculation),
        items: allItems.map(item =>
          item.actualTransactionId === itemToSettle.actualTransactionId
            ? { ...item, settlementStatus: 'settled' }
            : item,
        ),
        summaries: summariesToClose,
        warnings: calculation?.warnings ?? [],
      };

      await saveFlowSettlementSnapshot(settledCalculation);
      await savedQuery.refetch();
      setCalculation(settledCalculation);
      setStatus({ kind: 'item-settled', updated: result.updated });
      window.alert(
        t(
          'This transaction was marked settled. Remember to create the matching transfer transaction in Actual so the real money movement is recorded.',
        ),
      );
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Transaction settlement status could not be updated.'),
      });
    } finally {
      setSettling(false);
    }
  }

  useEffect(() => {
    if (isValidMonth) {
      void handleCalculate();
    }
    // The calculation should rerun when the selected month changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  const savedSnapshot = savedQuery.data;
  const activeSummaries =
    calculation?.summaries ?? savedSnapshot?.settlements ?? [];
  const activeItems = calculation?.items ?? savedSnapshot?.items ?? [];
  const hasUnsettledSettlementItems = activeItems.some(
    item => item.settlementStatus !== 'settled',
  );
  const activeMembers = useMemo(
    () => getSettlementMembers(settingsQuery.data, calculation),
    [calculation, settingsQuery.data],
  );
  const memberNamesById = useMemo(
    () => new Map(activeMembers.map(member => [member.id, member.name])),
    [activeMembers],
  );
  const formatMoney = (amount: number) => `€${format(amount, 'financial')}`;

  return (
    <Page
      header={
        <SettlementPageHeader
          isSaving={isSaving}
          isSettling={isSettling}
          hasCalculation={calculation !== null}
          hasSettlementItems={hasUnsettledSettlementItems}
          onSave={handleSave}
          onClear={handleClear}
          onMarkSettled={handleMarkSettled}
          onReloadSaved={() => {
            void savedQuery.refetch();
            setStatus({ kind: 'loaded' });
          }}
        />
      }
    >
      <View
        style={{
          flexDirection: 'column',
          maxWidth: 1180,
          minHeight: 'auto',
          gap: 18,
          paddingTop: 10,
        }}
      >
        <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
          <Trans>
            Calculate who owes whom from shared transactions and Flow metadata.
          </Trans>
        </Text>

        {status && <StatusPanel status={status} />}

        <SettlementDetailsPanel
          selectedDate={selectedDate}
          selectedMonth={selectedMonth}
          dateFormat={dateFormat}
          isCalculating={isCalculating}
          onMonthChange={value => setSelectedMonth(value)}
          onCalculate={handleCalculate}
          calculation={calculation}
          savedSnapshot={savedSnapshot}
          items={activeItems}
          summaries={activeSummaries}
          formatAmount={formatMoney}
        />

        <SettlementBreakdown
          members={activeMembers}
          summaries={activeSummaries}
          memberNamesById={memberNamesById}
          formatAmount={formatMoney}
        />

        <SavedSnapshotPanel
          snapshot={savedSnapshot}
          isLoading={savedQuery.isLoading}
          error={savedQuery.error}
        />

        <ExpandableSettlementSection
          title={t('Settlement money flow')}
          count={activeSummaries.length}
        >
          <SettlementMatrix
            members={activeMembers}
            summaries={activeSummaries}
            formatAmount={formatMoney}
          />
        </ExpandableSettlementSection>

        <ExpandableSettlementSection
          title={t('Warnings')}
          count={calculation?.warnings.length ?? 0}
        >
          {calculation?.warnings && calculation.warnings.length > 0 ? (
            <WarningsList warnings={calculation.warnings} />
          ) : (
            <InfoPanel>
              <Trans>No settlement warnings for this month.</Trans>
            </InfoPanel>
          )}
        </ExpandableSettlementSection>

        <ExpandableSettlementSection
          title={t('Settlement items')}
          count={activeItems.length}
        >
          <SettlementItemsTable
            items={activeItems}
            memberNamesById={memberNamesById}
            dateFormat={dateFormat}
            formatAmount={formatMoney}
            isSettling={isSettling}
            onMarkItemSettled={handleMarkItemSettled}
          />
        </ExpandableSettlementSection>
      </View>
    </Page>
  );
}

type SettlementPageHeaderProps = {
  isSaving: boolean;
  isSettling: boolean;
  hasCalculation: boolean;
  hasSettlementItems: boolean;
  onSave: () => void;
  onClear: () => void;
  onMarkSettled: () => void;
  onReloadSaved: () => void;
};

function SettlementPageHeader({
  isSaving,
  isSettling,
  hasCalculation,
  hasSettlementItems,
  onSave,
  onClear,
  onMarkSettled,
  onReloadSaved,
}: SettlementPageHeaderProps) {
  const { t } = useTranslation();
  const isBusy = isSaving || isSettling;

  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        margin: '18px 20px 8px',
      }}
    >
      <Text style={{ fontSize: 25, fontWeight: 500 }}>
        <Trans>Settlement</Trans>
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          gap: 8,
        }}
      >
        <Button
          variant="normal"
          onPress={onSave}
          isDisabled={!hasCalculation || isBusy}
          style={actionButtonStyle('green')}
        >
          <Trans>Save snapshot</Trans>
        </Button>
        <Button
          variant="normal"
          onPress={onReloadSaved}
          isDisabled={isBusy}
          style={actionButtonStyle('blue')}
        >
          <Trans>Reload saved</Trans>
        </Button>
        <Button
          variant="normal"
          onPress={onMarkSettled}
          isDisabled={!hasSettlementItems || isBusy}
          style={actionButtonStyle('green')}
        >
          {isSettling ? t('Updating...') : t('Mark all settled')}
        </Button>
        <Button
          variant="normal"
          onPress={onClear}
          isDisabled={isBusy}
          style={actionButtonStyle('red')}
        >
          <Trans>Clear saved</Trans>
        </Button>
      </View>
    </View>
  );
}

type SettlementDetailsPanelProps = {
  selectedMonth: string;
  selectedDate: string;
  dateFormat: string;
  isCalculating: boolean;
  onMonthChange: (value: string) => void;
  onCalculate: () => void;
  calculation: FlowSettlementCalculation | null;
  savedSnapshot: FlowSettlementSnapshot | undefined;
  items: FlowSettlementItem[];
  summaries: FlowSettlementSummary[];
  formatAmount: (amount: number) => string;
};

function SettlementDetailsPanel({
  selectedMonth,
  selectedDate,
  dateFormat,
  isCalculating,
  onMonthChange,
  onCalculate,
  calculation,
  savedSnapshot,
  items,
  summaries,
  formatAmount,
}: SettlementDetailsPanelProps) {
  const { t } = useTranslation();
  const sharedTransactionCount = getSharedTransactionCount(items);
  const totalSharedExpenses = getTotalSharedExpenseAmount(items);
  const netAmount = summaries.reduce((sum, summary) => sum + summary.amount, 0);
  const cards = [
    { label: t('Selected month'), value: selectedMonth },
    {
      label: t('Shared transactions found'),
      value: String(sharedTransactionCount),
    },
    {
      label: t('Total shared expenses'),
      value: formatAmount(totalSharedExpenses),
      financial: true,
      color: theme.budgetNumberNegative,
    },
    { label: t('Settlement items'), value: String(items.length) },
    {
      label: t('Total to settle'),
      value: formatAmount(netAmount),
      financial: true,
      color:
        netAmount > 0 ? theme.budgetNumberNegative : theme.budgetNumberZero,
    },
    {
      label: t('Warnings'),
      value: String(calculation?.warnings.length ?? 0),
    },
    {
      label: t('Saved rows'),
      value: String(savedSnapshot?.settlements.length ?? 0),
    },
  ];

  return (
    <View
      style={{
        flexDirection: 'column',
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 8,
        backgroundColor: theme.tableBackground,
        padding: 14,
        gap: 14,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'end',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: 600 }}>
            <Trans>Settlement details</Trans>
          </Text>
          <label
            htmlFor="flow-settlement-month"
            style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
          >
            <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
              <Trans>Settlement month</Trans>
            </Text>
            <DateSelect
              id="flow-settlement-month"
              value={selectedDate}
              dateFormat={dateFormat}
              inputProps={{
                'aria-label': t('Settlement month'),
                style: { width: 130 },
              }}
              onSelect={date => onMonthChange(monthUtils.monthFromDate(date))}
            />
          </label>
        </View>

        <Button
          variant="primary"
          onPress={onCalculate}
          isDisabled={isCalculating}
          style={actionButtonStyle('yellow')}
        >
          {isCalculating ? t('Calculating...') : t('Calculate')}
        </Button>
      </View>

      <View
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 10,
        }}
      >
        {cards.map(card => (
          <View
            key={card.label}
            style={{
              border: `1px solid ${theme.tableBorder}`,
              borderRadius: 6,
              backgroundColor: theme.tableBackground,
              padding: 12,
              minHeight: 68,
              gap: 6,
            }}
          >
            <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
              {card.label}
            </Text>
            {card.financial ? (
              <FinancialText
                style={{
                  color: card.color,
                  fontSize: 18,
                  fontWeight: 600,
                }}
              >
                {card.value}
              </FinancialText>
            ) : (
              <Text style={{ fontSize: 18, fontWeight: 600 }}>
                {card.value}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function ExpandableSettlementSection({
  title,
  count,
  children,
}: {
  title: string;
  count: number;
  children: ReactNode;
}) {
  const { t } = useTranslation();
  const [isExpanded, setExpanded] = useState(false);

  return (
    <View
      style={{
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 8,
        backgroundColor: theme.tableBackground,
        overflow: 'hidden',
      }}
    >
      <Button
        variant="bare"
        onPress={() => setExpanded(current => !current)}
        style={{
          width: '100%',
          justifyContent: 'space-between',
          padding: '12px 14px',
          color: theme.pageText,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: 600 }}>{title}</Text>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            {count}
          </Text>
        </View>
        <Text style={{ color: theme.pageTextSubdued }}>
          {isExpanded ? t('Hide') : t('Show')}
        </Text>
      </Button>

      {isExpanded && (
        <View
          style={{
            borderTop: `1px solid ${theme.tableBorder}`,
            padding: 14,
          }}
        >
          {children}
        </View>
      )}
    </View>
  );
}

function actionButtonStyle(
  tone: 'green' | 'blue' | 'red' | 'yellow',
): CSSProperties {
  switch (tone) {
    case 'green':
      return {
        backgroundColor: '#d8f5df',
        borderColor: '#8bcf9f',
        color: '#14532d',
      };
    case 'blue':
      return {
        backgroundColor: '#dbeafe',
        borderColor: '#93c5fd',
        color: '#1e3a8a',
      };
    case 'red':
      return {
        backgroundColor: '#fee2e2',
        borderColor: '#fca5a5',
        color: '#7f1d1d',
      };
    case 'yellow':
      return {
        backgroundColor: '#facc15',
        borderColor: '#eab308',
        color: '#111827',
      };
    default:
      return {};
  }
}

type SettlementBreakdownProps = {
  members: SettlementMember[];
  summaries: FlowSettlementSummary[];
  memberNamesById: Map<string, string>;
  formatAmount: (amount: number) => string;
};

function SettlementBreakdown({
  members,
  summaries,
  memberNamesById,
  formatAmount,
}: SettlementBreakdownProps) {
  const balances = getMemberSettlementBalances(members, summaries);
  const netAmount = summaries.reduce((sum, summary) => sum + summary.amount, 0);

  return (
    <View
      style={{
        flexDirection: 'column',
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 8,
        backgroundColor: theme.tableBackground,
        padding: 16,
        gap: 16,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ flexDirection: 'column', gap: 8 }}>
          <Text style={{ fontSize: 18, fontWeight: 600 }}>
            <Trans>Who owes whom</Trans>
          </Text>
          <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.4 }}>
            <Trans>
              These are the final net payments to make for this month.
            </Trans>
          </Text>
        </View>

        <View
          style={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}
        >
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>Total to settle</Trans>
          </Text>
          <FinancialText
            style={{
              color:
                netAmount > 0
                  ? theme.budgetNumberNegative
                  : theme.budgetNumberZero,
              fontSize: 28,
              fontWeight: 700,
              ...styles.tnum,
            }}
          >
            {formatAmount(netAmount)}
          </FinancialText>
        </View>
      </View>

      {summaries.length === 0 ? (
        <View
          style={{
            flexDirection: 'column',
            border: `1px solid ${theme.tableBorder}`,
            borderRadius: 8,
            backgroundColor: theme.pageBackground,
            padding: 18,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 20, fontWeight: 600 }}>
            <Trans>No payment needed</Trans>
          </Text>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              Shared expenses are already balanced for the selected month.
            </Trans>
          </Text>
        </View>
      ) : (
        <View
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: 12,
          }}
        >
          {summaries.map(summary => (
            <PaymentInstructionCard
              key={`${summary.month}-${summary.fromMemberId}-${summary.toMemberId}`}
              summary={summary}
              memberNamesById={memberNamesById}
              formatAmount={formatAmount}
            />
          ))}
        </View>
      )}

      {balances.length > 0 && (
        <View style={{ flexDirection: 'column', gap: 10 }}>
          <Text style={{ fontSize: 15, fontWeight: 600 }}>
            <Trans>Per-person breakdown</Trans>
          </Text>
          <View
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
              gap: 12,
            }}
          >
            {balances.map(balance => (
              <PersonBalanceCard
                key={balance.member.id}
                balance={balance}
                formatAmount={formatAmount}
              />
            ))}
          </View>
        </View>
      )}
    </View>
  );
}

function PaymentInstructionCard({
  summary,
  memberNamesById,
  formatAmount,
}: {
  summary: FlowSettlementSummary;
  memberNamesById: Map<string, string>;
  formatAmount: (amount: number) => string;
}) {
  return (
    <View
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'center',
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 8,
        backgroundColor: theme.pageBackground,
        padding: 16,
        gap: 16,
      }}
    >
      <View style={{ flexDirection: 'column', gap: 6 }}>
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          <Trans>Payment to make</Trans>
        </Text>
        <Text style={{ fontSize: 18, fontWeight: 600 }}>
          {getMemberName(summary.fromMemberId, memberNamesById)}
          <Text style={{ color: theme.pageTextSubdued, fontWeight: 400 }}>
            {' '}
            <Trans>pays</Trans>{' '}
          </Text>
          {getMemberName(summary.toMemberId, memberNamesById)}
        </Text>
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          <Trans>Create the matching transfer in Actual after payment.</Trans>
        </Text>
      </View>
      <FinancialText
        style={{
          color: theme.budgetNumberNegative,
          fontSize: 32,
          fontWeight: 700,
          textAlign: 'right',
          ...styles.tnum,
        }}
      >
        {formatAmount(summary.amount)}
      </FinancialText>
    </View>
  );
}

type MemberSettlementBalance = {
  member: SettlementMember;
  netAmount: number;
  outgoing: Array<{ member: SettlementMember; amount: number }>;
  incoming: Array<{ member: SettlementMember; amount: number }>;
};

function PersonBalanceCard({
  balance,
  formatAmount,
}: {
  balance: MemberSettlementBalance;
  formatAmount: (amount: number) => string;
}) {
  const { t } = useTranslation();
  const isPayer = balance.netAmount < 0;
  const isReceiver = balance.netAmount > 0;
  const color = isReceiver
    ? receiverMoneyColor
    : isPayer
      ? theme.budgetNumberNegative
      : theme.budgetNumberZero;
  const label = isReceiver
    ? t('Receives')
    : isPayer
      ? t('Pays')
      : t('Balanced');
  const counterparties = isPayer ? balance.outgoing : balance.incoming;

  return (
    <View
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        alignItems: 'start',
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 8,
        backgroundColor: theme.pageBackground,
        padding: 14,
        minHeight: 82,
        gap: 12,
      }}
    >
      <View style={{ flexDirection: 'column', gap: 8 }}>
        <Text style={{ fontSize: 17, fontWeight: 600 }}>
          {balance.member.name}
        </Text>
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          {label}
        </Text>

        {counterparties.length === 0 ? (
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>No one owes or receives money.</Trans>
          </Text>
        ) : (
          <View style={{ flexDirection: 'column', gap: 6 }}>
            {counterparties.map(counterparty => (
              <View
                key={counterparty.member.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                  {isPayer ? t('To') : t('From')} {counterparty.member.name}
                </Text>
                <FinancialText
                  style={{
                    color: isReceiver ? receiverMoneyColor : undefined,
                    fontSize: 12,
                    textAlign: 'right',
                    ...styles.tnum,
                  }}
                >
                  {formatAmount(counterparty.amount)}
                </FinancialText>
              </View>
            ))}
          </View>
        )}
      </View>
      <FinancialText
        style={{
          color,
          fontSize: 26,
          fontWeight: 700,
          textAlign: 'right',
          ...styles.tnum,
        }}
      >
        {formatAmount(Math.abs(balance.netAmount))}
      </FinancialText>
    </View>
  );
}

type SettlementMatrixProps = {
  members: SettlementMember[];
  summaries: FlowSettlementSummary[];
  formatAmount: (amount: number) => string;
};

function SettlementMatrix({
  members,
  summaries,
  formatAmount,
}: SettlementMatrixProps) {
  const displayMembers = getMatrixMembers(members, summaries);

  if (displayMembers.length === 0) {
    return null;
  }

  const matrix = createSettlementMatrix(displayMembers, summaries);

  return (
    <View style={{ gap: 10 }}>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        <Trans>
          Positive numbers mean the person receives money. Negative numbers mean
          the person pays money.
        </Trans>
      </Text>

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
            minWidth: Math.max(640, displayMembers.length * 130 + 190),
            borderCollapse: 'collapse',
          }}
        >
          <thead>
            <tr>
              <th style={tableHeaderStyle}>
                <Trans>Person</Trans>
              </th>
              {displayMembers.map(member => (
                <th key={member.id} style={rightTableHeaderStyle}>
                  {member.name}
                </th>
              ))}
              <th style={rightTableHeaderStyle}>
                <Trans>Net</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {displayMembers.map(rowMember => {
              const rowTotal = displayMembers.reduce(
                (sum, columnMember) =>
                  sum + getMatrixValue(matrix, rowMember.id, columnMember.id),
                0,
              );

              return (
                <tr key={rowMember.id}>
                  <td style={tableCellStyle}>{rowMember.name}</td>
                  {displayMembers.map(columnMember => {
                    const value = getMatrixValue(
                      matrix,
                      rowMember.id,
                      columnMember.id,
                    );

                    return (
                      <td key={columnMember.id} style={rightTableCellStyle}>
                        {rowMember.id === columnMember.id ? (
                          <Text style={{ color: theme.pageTextSubdued }}>
                            -
                          </Text>
                        ) : (
                          <SignedFinancialText
                            amount={value}
                            formatAmount={formatAmount}
                          />
                        )}
                      </td>
                    );
                  })}
                  <td style={rightTableCellStyle}>
                    <SignedFinancialText
                      amount={rowTotal}
                      formatAmount={formatAmount}
                      strong
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </View>
    </View>
  );
}

function SignedFinancialText({
  amount,
  formatAmount,
  strong = false,
}: {
  amount: number;
  formatAmount: (amount: number) => string;
  strong?: boolean;
}) {
  const color =
    amount > 0
      ? receiverMoneyColor
      : amount < 0
        ? theme.budgetNumberNegative
        : theme.budgetNumberZero;
  const prefix = amount > 0 ? '+' : amount < 0 ? '-' : '';

  return (
    <FinancialText style={{ color, fontWeight: strong ? 600 : undefined }}>
      {prefix}
      {formatAmount(Math.abs(amount))}
    </FinancialText>
  );
}

type SettlementItemsTableProps = {
  items: FlowSettlementItem[];
  memberNamesById: Map<string, string>;
  dateFormat: string;
  formatAmount: (amount: number) => string;
  isSettling: boolean;
  onMarkItemSettled: (item: FlowSettlementItem) => void;
};

function SettlementItemsTable({
  items,
  memberNamesById,
  dateFormat,
  formatAmount,
  isSettling,
  onMarkItemSettled,
}: SettlementItemsTableProps) {
  const { t } = useTranslation();
  const headers = [
    t('Date'),
    t('Payee'),
    t('Amount'),
    t('Paid by'),
    t('Owed by'),
    t('Owed to'),
    t('Owed amount'),
    t('Split method'),
    t('Settlement status'),
    t('Source transaction'),
    t('Action'),
  ];

  return (
    <View style={{ gap: 10 }}>
      {items.length === 0 ? (
        <InfoPanel>
          <Trans>
            No settlement items were generated for this month. Open the
            Transactions page and make sure the relevant expenses are marked
            Shared, have a Paid by member, use a supported split method, and
            have settlement status Open.
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
              minWidth: 980,
              borderCollapse: 'collapse',
            }}
          >
            <thead>
              <tr>
                {headers.map(header => (
                  <th key={header} style={tableHeaderStyle}>
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => (
                <tr key={item.id}>
                  <td style={tableCellStyle}>
                    {item.transactionDate
                      ? formatDate(parseISO(item.transactionDate), dateFormat)
                      : ''}
                  </td>
                  <td style={tableCellStyle}>
                    {item.payeeName || item.notes || ''}
                  </td>
                  <td style={rightTableCellStyle}>
                    <FinancialText>
                      {formatAmount(item.sourceAmount)}
                    </FinancialText>
                  </td>
                  <td style={tableCellStyle}>
                    {getMemberName(
                      item.paidByMemberId ?? item.owedToMemberId,
                      memberNamesById,
                    )}
                  </td>
                  <td style={tableCellStyle}>
                    {getMemberName(item.owedByMemberId, memberNamesById)}
                  </td>
                  <td style={tableCellStyle}>
                    {getMemberName(item.owedToMemberId, memberNamesById)}
                  </td>
                  <td style={rightTableCellStyle}>
                    <FinancialText>{formatAmount(item.amount)}</FinancialText>
                  </td>
                  <td style={tableCellStyle}>{item.splitMethod}</td>
                  <td style={tableCellStyle}>
                    {item.settlementStatus ?? 'open'}
                  </td>
                  <td style={tableCellStyle}>{item.actualTransactionId}</td>
                  <td style={tableCellStyle}>
                    <Button
                      variant="normal"
                      isDisabled={
                        isSettling || item.settlementStatus === 'settled'
                      }
                      onPress={() => onMarkItemSettled(item)}
                      style={actionButtonStyle('green')}
                    >
                      {item.settlementStatus === 'settled'
                        ? t('Settled')
                        : t('Mark settled')}
                    </Button>
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

function SavedSnapshotPanel({
  snapshot,
  isLoading,
  error,
}: {
  snapshot: FlowSettlementSnapshot | undefined;
  isLoading: boolean;
  error: Error | null;
}) {
  if (isLoading) {
    return <InfoPanel>Loading saved settlement snapshot...</InfoPanel>;
  }

  if (error) {
    return (
      <InfoPanel>
        <Trans>Saved settlement snapshot could not be loaded.</Trans>
      </InfoPanel>
    );
  }

  return (
    <InfoPanel>
      {snapshot && snapshot.settlements.length > 0 ? (
        <Trans>
          Saved settlement snapshot found for this month. Recalculate to compare
          it with current transaction metadata.
        </Trans>
      ) : (
        <Trans>No saved settlement snapshot exists for this month.</Trans>
      )}
    </InfoPanel>
  );
}

function WarningsList({ warnings }: { warnings: string[] }) {
  return (
    <View style={{ gap: 8 }}>
      <View
        style={{
          border: `1px solid ${theme.warningText}`,
          borderRadius: 8,
          backgroundColor: theme.warningBackground,
          padding: 12,
          gap: 6,
        }}
      >
        {warnings.map((warning, index) => (
          <Text
            key={`${warning}-${index}`}
            style={{ color: theme.warningText }}
          >
            {warning}
          </Text>
        ))}
      </View>
    </View>
  );
}

function StatusPanel({ status }: { status: StatusState }) {
  if (status.kind === 'error') {
    return (
      <InfoPanel tone="error">
        <Text style={{ color: theme.errorText }}>{status.message}</Text>
      </InfoPanel>
    );
  }

  const label =
    status.kind === 'saved'
      ? 'Settlement snapshot saved.'
      : status.kind === 'cleared'
        ? 'Saved settlement snapshot cleared.'
        : status.kind === 'loaded'
          ? 'Saved settlement snapshot reloaded.'
          : status.kind === 'settled'
            ? `${status.updated} transaction status update${
                status.updated === 1 ? '' : 's'
              } saved as settled.`
            : status.kind === 'item-settled'
              ? `${status.updated} transaction status update${
                  status.updated === 1 ? '' : 's'
                } saved as settled.`
              : 'Settlement calculated.';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        color: theme.noticeTextLight,
        lineHeight: 1.4,
      }}
    >
      <SvgCheckCircle1 width={14} height={14} />
      <Text style={{ color: theme.noticeTextLight }}>{label}</Text>
    </View>
  );
}

function InfoPanel({
  children,
  tone = 'normal',
}: {
  children: ReactNode;
  tone?: 'normal' | 'error';
}) {
  return (
    <View
      style={{
        border: `1px solid ${
          tone === 'error' ? theme.errorText : theme.tableBorder
        }`,
        borderRadius: 8,
        backgroundColor:
          tone === 'error' ? theme.errorBackground : theme.tableBackground,
        padding: 12,
      }}
    >
      <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
        {children}
      </Text>
    </View>
  );
}

function getSharedTransactionCount(items: FlowSettlementItem[]) {
  return new Set(items.map(item => item.actualTransactionId)).size;
}

function getSettlementMembers(
  settings: Awaited<ReturnType<typeof getFlowSettings>> | undefined,
  calculation: FlowSettlementCalculation | null,
): SettlementMember[] {
  if (settings) {
    return settings.householdMembers
      .filter(member => member.active)
      .map(member => ({
        id: member.id,
        name: member.name,
      }));
  }

  return calculation?.members ?? [];
}

function getMatrixMembers(
  members: SettlementMember[],
  summaries: FlowSettlementSummary[],
): SettlementMember[] {
  const membersById = new Map(members.map(member => [member.id, member]));

  for (const summary of summaries) {
    if (!membersById.has(summary.fromMemberId)) {
      membersById.set(summary.fromMemberId, {
        id: summary.fromMemberId,
        name: `Unknown member (${summary.fromMemberId})`,
      });
    }

    if (!membersById.has(summary.toMemberId)) {
      membersById.set(summary.toMemberId, {
        id: summary.toMemberId,
        name: `Unknown member (${summary.toMemberId})`,
      });
    }
  }

  return [...membersById.values()].sort((left, right) =>
    left.name.localeCompare(right.name),
  );
}

function getMemberSettlementBalances(
  members: SettlementMember[],
  summaries: FlowSettlementSummary[],
): MemberSettlementBalance[] {
  const displayMembers = getMatrixMembers(members, summaries);
  const balancesByMemberId = new Map<string, MemberSettlementBalance>(
    displayMembers.map(member => [
      member.id,
      {
        member,
        netAmount: 0,
        outgoing: [],
        incoming: [],
      },
    ]),
  );

  for (const summary of summaries) {
    const payer = balancesByMemberId.get(summary.fromMemberId);
    const receiver = balancesByMemberId.get(summary.toMemberId);

    if (!payer || !receiver) {
      continue;
    }

    payer.netAmount -= summary.amount;
    payer.outgoing.push({
      member: receiver.member,
      amount: summary.amount,
    });

    receiver.netAmount += summary.amount;
    receiver.incoming.push({
      member: payer.member,
      amount: summary.amount,
    });
  }

  return [...balancesByMemberId.values()].sort(
    (left, right) =>
      Math.abs(right.netAmount) - Math.abs(left.netAmount) ||
      left.member.name.localeCompare(right.member.name),
  );
}

function createSettlementMatrix(
  members: SettlementMember[],
  summaries: FlowSettlementSummary[],
): Map<string, Map<string, number>> {
  const matrix = new Map<string, Map<string, number>>();

  for (const member of members) {
    matrix.set(member.id, new Map());
  }

  for (const summary of summaries) {
    addMatrixValue(
      matrix,
      summary.fromMemberId,
      summary.toMemberId,
      -summary.amount,
    );
    addMatrixValue(
      matrix,
      summary.toMemberId,
      summary.fromMemberId,
      summary.amount,
    );
  }

  return matrix;
}

function addMatrixValue(
  matrix: Map<string, Map<string, number>>,
  rowMemberId: string,
  columnMemberId: string,
  amount: number,
) {
  const row = matrix.get(rowMemberId) ?? new Map<string, number>();
  row.set(columnMemberId, (row.get(columnMemberId) ?? 0) + amount);
  matrix.set(rowMemberId, row);
}

function getMatrixValue(
  matrix: Map<string, Map<string, number>>,
  rowMemberId: string,
  columnMemberId: string,
) {
  return matrix.get(rowMemberId)?.get(columnMemberId) ?? 0;
}

function getTotalSharedExpenseAmount(items: FlowSettlementItem[]) {
  const sourceAmountByTransaction = new Map<string, number>();

  for (const item of items) {
    sourceAmountByTransaction.set(item.actualTransactionId, item.sourceAmount);
  }

  return [...sourceAmountByTransaction.values()].reduce(
    (sum, amount) => sum + amount,
    0,
  );
}

function getMemberName(memberId: string, memberNamesById: Map<string, string>) {
  return memberNamesById.get(memberId) ?? `Unknown member (${memberId})`;
}

const tableHeaderStyle: CSSProperties = {
  ...styles.smallText,
  color: theme.tableHeaderText,
  backgroundColor: theme.tableHeaderBackground,
  borderBottom: `1px solid ${theme.tableBorder}`,
  padding: '8px 10px',
  textAlign: 'left',
  whiteSpace: 'nowrap',
};

const rightTableHeaderStyle: CSSProperties = {
  ...tableHeaderStyle,
  textAlign: 'right',
};

const tableCellStyle: CSSProperties = {
  ...styles.smallText,
  borderBottom: `1px solid ${theme.tableBorder}`,
  padding: '8px 10px',
  whiteSpace: 'nowrap',
};

const rightTableCellStyle: CSSProperties = {
  ...tableCellStyle,
  textAlign: 'right',
  ...styles.tnum,
};
