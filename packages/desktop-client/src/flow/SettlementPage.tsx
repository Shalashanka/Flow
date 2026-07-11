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

import {
  getFlowPaymentCandidateTransactions,
  getFlowPaymentTransactionsByIds,
} from './actual-adapter';
import type { FlowTransaction } from './actual-adapter';
import { getFlowSettings } from './planning/storage';
import { calculateFlowSettlement } from './settlement/calculate';
import {
  clearFlowSettlementSnapshot,
  closeSettlementMonth,
  deleteSettlementPaymentLink,
  getSavedFlowSettlements,
  getSettlementId,
  getSettlementMonthClose,
  getSettlementPaymentLinks,
  markFlowSettlementTransactionsSettled,
  reopenSettlementMonth,
  saveFlowSettlementSnapshot,
  saveSettlementPaymentLink,
} from './settlement/storage';
import type {
  FlowSettlementCalculation,
  FlowSettlementItem,
  FlowSettlementMonthClosure,
  FlowSettlementMonthStatus,
  FlowSettlementPaymentLink,
  FlowSettlementSnapshot,
  FlowSettlementSummary,
} from './settlement/types';

type StatusState =
  | {
      kind:
        | 'saved'
        | 'cleared'
        | 'loaded'
        | 'calculated'
        | 'closed-preview'
        | 'payment-linked'
        | 'payment-unlinked'
        | 'month-reopened';
    }
  | { kind: 'settled' | 'item-settled' | 'month-closed'; updated: number }
  | { kind: 'error'; message: string };

type SettlementMember = {
  id: string;
  name: string;
};

const receiverMoneyColor = '#8ee6a8';
const emptyPaymentLinks: FlowSettlementPaymentLink[] = [];
const emptyTransactions: FlowTransaction[] = [];

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
  const [isLinkingPayment, setLinkingPayment] = useState(false);
  const [isClosingMonth, setClosingMonth] = useState(false);
  const [linkingSettlementId, setLinkingSettlementId] = useState<string | null>(
    null,
  );
  const [paymentSearch, setPaymentSearch] = useState('');
  const [paymentCandidateMonth, setPaymentCandidateMonth] =
    useState(selectedMonth);
  const [status, setStatus] = useState<StatusState | null>(null);
  const isValidMonth = /^\d{4}-\d{2}$/.test(selectedMonth);
  const isValidPaymentCandidateMonth = /^\d{4}-\d{2}$/.test(
    paymentCandidateMonth,
  );
  const selectedDate = monthUtils.firstDayOfMonth(selectedMonth);
  const paymentCandidateDate = monthUtils.firstDayOfMonth(
    paymentCandidateMonth,
  );

  const savedQuery = useQuery({
    queryKey: ['flow', 'settlement', 'saved', selectedMonth],
    queryFn: () => getSavedFlowSettlements(selectedMonth),
    enabled: isValidMonth,
  });
  const settingsQuery = useQuery({
    queryKey: ['flow', 'settings', 'settlement-members'],
    queryFn: getFlowSettings,
  });
  const paymentLinksQuery = useQuery({
    queryKey: ['flow', 'settlement', 'payment-links', selectedMonth],
    queryFn: () => getSettlementPaymentLinks(selectedMonth),
    enabled: isValidMonth,
  });
  const monthCloseQuery = useQuery({
    queryKey: ['flow', 'settlement', 'month-close', selectedMonth],
    queryFn: () => getSettlementMonthClose(selectedMonth),
    enabled: isValidMonth,
  });
  const paymentCandidatesQuery = useQuery({
    queryKey: [
      'flow',
      'settlement',
      'payment-candidates',
      paymentCandidateMonth,
    ],
    queryFn: () =>
      getFlowPaymentCandidateTransactions({
        start: monthUtils.firstDayOfMonth(paymentCandidateMonth),
        end: monthUtils.lastDayOfMonth(paymentCandidateMonth),
      }),
    enabled: isValidPaymentCandidateMonth,
  });
  const linkedTransactionIds = useMemo(
    () => [
      ...new Set(
        (paymentLinksQuery.data ?? [])
          .map(link => link.paymentTransactionId)
          .filter(Boolean),
      ),
    ],
    [paymentLinksQuery.data],
  );
  const linkedPaymentTransactionsQuery = useQuery({
    queryKey: [
      'flow',
      'settlement',
      'linked-payment-transactions',
      selectedMonth,
      linkedTransactionIds,
    ],
    queryFn: () => getFlowPaymentTransactionsByIds(linkedTransactionIds),
    enabled: isValidMonth && linkedTransactionIds.length > 0,
  });

  async function refetchSettlementState() {
    await Promise.all([
      savedQuery.refetch(),
      paymentLinksQuery.refetch(),
      monthCloseQuery.refetch(),
      linkedPaymentTransactionsQuery.refetch(),
    ]);
  }

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
      setStatus({ kind: isMonthClosed ? 'closed-preview' : 'calculated' });
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

    if (isMonthClosed) {
      setStatus({
        kind: 'error',
        message: t('This settlement month is closed. Reopen it before saving.'),
      });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      await saveFlowSettlementSnapshot(calculation);
      await refetchSettlementState();
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

    if (isMonthClosed) {
      setStatus({
        kind: 'error',
        message: t(
          'This settlement month is closed. Reopen it before clearing.',
        ),
      });
      return;
    }

    setSaving(true);
    setStatus(null);

    try {
      await clearFlowSettlementSnapshot(selectedMonth);
      await refetchSettlementState();
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
    if (isMonthClosed) {
      setStatus({
        kind: 'error',
        message: t(
          'This settlement month is already closed. Reopen it before changing settlement statuses.',
        ),
      });
      return;
    }

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

      await refetchSettlementState();
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
    if (isMonthClosed) {
      setStatus({
        kind: 'error',
        message: t(
          'This settlement month is already closed. Reopen it before changing settlement statuses.',
        ),
      });
      return;
    }

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
      await refetchSettlementState();
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

  async function handleLinkPayment(
    summary: FlowSettlementSummary,
    transaction: FlowTransaction,
  ) {
    if (isMonthClosed) {
      setStatus({
        kind: 'error',
        message: t(
          'This settlement month is closed. Reopen it before linking.',
        ),
      });
      return;
    }

    if (!savedSnapshot || savedSnapshot.settlements.length === 0) {
      setStatus({
        kind: 'error',
        message: t('Save the settlement snapshot before linking payments.'),
      });
      return;
    }

    setLinkingPayment(true);
    setStatus(null);

    try {
      await saveSettlementPaymentLink({
        settlementId: getSettlementId(summary),
        month: selectedMonth,
        paymentTransactionId: transaction.id,
        amount: Math.abs(transaction.amount),
      });
      await refetchSettlementState();
      setLinkingSettlementId(null);
      setPaymentSearch('');
      setStatus({ kind: 'payment-linked' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Payment transaction could not be linked.'),
      });
    } finally {
      setLinkingPayment(false);
    }
  }

  async function handleUnlinkPayment(summary: FlowSettlementSummary) {
    if (isMonthClosed) {
      setStatus({
        kind: 'error',
        message: t(
          'This settlement month is closed. Reopen it before unlinking.',
        ),
      });
      return;
    }

    setLinkingPayment(true);
    setStatus(null);

    try {
      await deleteSettlementPaymentLink(
        getSettlementId(summary),
        selectedMonth,
      );
      await refetchSettlementState();
      setStatus({ kind: 'payment-unlinked' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Payment transaction could not be unlinked.'),
      });
    } finally {
      setLinkingPayment(false);
    }
  }

  async function handleCloseMonth() {
    if (isMonthClosed) {
      setStatus({
        kind: 'error',
        message: t('This settlement month is already closed.'),
      });
      return;
    }

    if (!savedSnapshot || savedSnapshot.settlements.length === 0) {
      setStatus({
        kind: 'error',
        message: t('Save a settlement snapshot before closing the month.'),
      });
      return;
    }

    const closeWarnings = getMonthCloseWarnings({
      summaries: activeSummaries,
      paymentLinksBySettlementId,
      linkedTransactionsById,
      formatAmount: formatMoney,
    });

    if (
      closeWarnings.length > 0 &&
      !window.confirm(
        `${t('Close this settlement month anyway?')}\n\n${closeWarnings.join(
          '\n',
        )}`,
      )
    ) {
      return;
    }

    setClosingMonth(true);
    setStatus(null);

    try {
      await closeSettlementMonth(selectedMonth);
      const itemsToSettle = activeItems.filter(
        item => item.settlementStatus !== 'settled',
      );
      const result = await markFlowSettlementTransactionsSettled(
        selectedMonth,
        itemsToSettle,
      );

      await refetchSettlementState();
      setCalculation(null);
      setStatus({ kind: 'month-closed', updated: result.updated });
      window.alert(
        t(
          'Settlement month closed. Make sure the matching transfer transactions exist in Actual; Flow did not create or edit any Actual transaction.',
        ),
      );
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Settlement month could not be closed.'),
      });
    } finally {
      setClosingMonth(false);
    }
  }

  async function handleReopenMonth() {
    if (
      !window.confirm(
        t(
          'Reopen this settlement month? Existing linked payments will be kept, but source transaction metadata will not be automatically reverted.',
        ),
      )
    ) {
      return;
    }

    setClosingMonth(true);
    setStatus(null);

    try {
      await reopenSettlementMonth(selectedMonth);
      await refetchSettlementState();
      setStatus({ kind: 'month-reopened' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Settlement month could not be reopened.'),
      });
    } finally {
      setClosingMonth(false);
    }
  }

  useEffect(() => {
    if (isValidMonth) {
      void handleCalculate();
    }
    // The calculation should rerun when the selected month changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  useEffect(() => {
    setPaymentCandidateMonth(selectedMonth);
    setLinkingSettlementId(null);
    setPaymentSearch('');
  }, [selectedMonth]);

  const savedSnapshot = savedQuery.data;
  const paymentLinks = paymentLinksQuery.data ?? emptyPaymentLinks;
  const monthClosure = monthCloseQuery.data ?? null;
  const paymentCandidates = paymentCandidatesQuery.data ?? emptyTransactions;
  const paymentLinksBySettlementId = new Map(
    paymentLinks.map(link => [link.settlementId, link]),
  );
  const linkedTransactionsById = new Map(
    (linkedPaymentTransactionsQuery.data ?? emptyTransactions).map(
      transaction => [transaction.id, transaction],
    ),
  );
  const monthStatus = getEffectiveMonthStatus({
    closure: monthClosure,
    snapshot: savedSnapshot,
    paymentLinks,
  });
  const isMonthClosed = monthStatus === 'closed';
  const baseSummaries =
    isMonthClosed && savedSnapshot?.settlements.length
      ? savedSnapshot.settlements
      : (calculation?.summaries ?? savedSnapshot?.settlements ?? []);
  const activeSummaries = mergeSummariesWithPaymentLinks(
    baseSummaries,
    paymentLinksBySettlementId,
  );
  const activeItems =
    isMonthClosed && savedSnapshot?.items.length
      ? savedSnapshot.items
      : (calculation?.items ?? savedSnapshot?.items ?? []);
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
    <Page header={null}>
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
          monthStatus={monthStatus}
          monthClosure={monthClosure}
          linkedPaymentCount={paymentLinks.length}
          isSaving={isSaving}
          isSettling={isSettling}
          isClosingMonth={isClosingMonth}
          isMonthClosed={isMonthClosed}
          hasCalculation={calculation !== null}
          hasSettlementItems={hasUnsettledSettlementItems}
          hasSavedSnapshot={Boolean(savedSnapshot?.settlements.length)}
          onSave={handleSave}
          onClear={handleClear}
          onCloseMonth={handleCloseMonth}
          onReopenMonth={handleReopenMonth}
          onMarkSettled={handleMarkSettled}
          onReloadSaved={() => {
            void refetchSettlementState();
            setStatus({ kind: 'loaded' });
          }}
          formatAmount={formatMoney}
        />

        <SettlementBreakdown
          members={activeMembers}
          summaries={activeSummaries}
          memberNamesById={memberNamesById}
          paymentLinksBySettlementId={paymentLinksBySettlementId}
          linkedTransactionsById={linkedTransactionsById}
          paymentCandidates={paymentCandidates}
          linkingSettlementId={linkingSettlementId}
          paymentSearch={paymentSearch}
          paymentCandidateDate={paymentCandidateDate}
          paymentCandidateMonth={paymentCandidateMonth}
          isLinkingPayment={isLinkingPayment}
          isMonthClosed={isMonthClosed}
          dateFormat={dateFormat}
          onStartLink={summary => {
            setLinkingSettlementId(getSettlementId(summary));
            setPaymentSearch('');
            setPaymentCandidateMonth(selectedMonth);
          }}
          onCancelLink={() => {
            setLinkingSettlementId(null);
            setPaymentSearch('');
          }}
          onPaymentSearchChange={setPaymentSearch}
          onPaymentCandidateMonthChange={value =>
            setPaymentCandidateMonth(value)
          }
          onLinkPayment={handleLinkPayment}
          onUnlinkPayment={handleUnlinkPayment}
          formatAmount={formatMoney}
        />

        <SavedSnapshotPanel
          snapshot={savedSnapshot}
          monthStatus={monthStatus}
          monthClosure={monthClosure}
          paymentLinks={paymentLinks}
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
            isMonthClosed={isMonthClosed}
            onMarkItemSettled={handleMarkItemSettled}
          />
        </ExpandableSettlementSection>
      </View>
    </Page>
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
  monthStatus: FlowSettlementMonthStatus;
  monthClosure: FlowSettlementMonthClosure | null;
  linkedPaymentCount: number;
  isSaving: boolean;
  isSettling: boolean;
  isClosingMonth: boolean;
  isMonthClosed: boolean;
  hasCalculation: boolean;
  hasSettlementItems: boolean;
  hasSavedSnapshot: boolean;
  onSave: () => void;
  onClear: () => void;
  onCloseMonth: () => void;
  onReopenMonth: () => void;
  onMarkSettled: () => void;
  onReloadSaved: () => void;
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
  monthStatus,
  monthClosure,
  linkedPaymentCount,
  isSaving,
  isSettling,
  isClosingMonth,
  isMonthClosed,
  hasCalculation,
  hasSettlementItems,
  hasSavedSnapshot,
  onSave,
  onClear,
  onCloseMonth,
  onReopenMonth,
  onMarkSettled,
  onReloadSaved,
  formatAmount,
}: SettlementDetailsPanelProps) {
  const { t } = useTranslation();
  const isBusy = isSaving || isSettling || isClosingMonth;
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
    {
      label: t('Linked payments'),
      value: String(linkedPaymentCount),
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
          alignItems: 'flex-start',
          gap: 14,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: 600 }}>
            <Trans>Settlement details</Trans>
          </Text>
          <View style={{ flexDirection: 'column', gap: 2 }}>
            <Text
              style={{
                color: getMonthStatusColor(monthStatus),
                fontWeight: 600,
              }}
            >
              {selectedMonth} settlement: {formatMonthStatus(monthStatus)}
            </Text>
            {monthClosure?.closedAt && (
              <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                <Trans>Closed at</Trans>{' '}
                {formatDate(parseISO(monthClosure.closedAt), dateFormat)}
              </Text>
            )}
            {monthClosure?.reopenedAt && (
              <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                <Trans>Reopened at</Trans>{' '}
                {formatDate(parseISO(monthClosure.reopenedAt), dateFormat)}
              </Text>
            )}
          </View>
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

        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: 8,
            maxWidth: 720,
          }}
        >
          <Button
            variant="primary"
            onPress={onCalculate}
            isDisabled={isCalculating}
          >
            {isCalculating ? t('Calculating...') : t('Calculate')}
          </Button>
          <Button
            variant="normal"
            onPress={onSave}
            isDisabled={!hasCalculation || isBusy || isMonthClosed}
          >
            <Trans>Save snapshot</Trans>
          </Button>
          <Button variant="normal" onPress={onReloadSaved} isDisabled={isBusy}>
            <Trans>Reload saved</Trans>
          </Button>
          <Button
            variant="normal"
            onPress={onMarkSettled}
            isDisabled={!hasSettlementItems || isBusy || isMonthClosed}
          >
            {isSettling ? t('Updating...') : t('Mark all settled')}
          </Button>
          {isMonthClosed ? (
            <Button
              variant="normal"
              onPress={onReopenMonth}
              isDisabled={isBusy}
            >
              {isClosingMonth ? t('Reopening...') : t('Reopen month')}
            </Button>
          ) : (
            <Button
              variant="normal"
              onPress={onCloseMonth}
              isDisabled={!hasSavedSnapshot || isBusy}
            >
              {isClosingMonth ? t('Closing...') : t('Close month')}
            </Button>
          )}
          <Button
            variant="normal"
            onPress={onClear}
            isDisabled={isBusy || isMonthClosed}
          >
            <Trans>Clear saved</Trans>
          </Button>
        </View>
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
  paymentLinksBySettlementId: Map<string, FlowSettlementPaymentLink>;
  linkedTransactionsById: Map<string, FlowTransaction>;
  paymentCandidates: FlowTransaction[];
  linkingSettlementId: string | null;
  paymentSearch: string;
  paymentCandidateDate: string;
  paymentCandidateMonth: string;
  isLinkingPayment: boolean;
  isMonthClosed: boolean;
  dateFormat: string;
  onStartLink: (summary: FlowSettlementSummary) => void;
  onCancelLink: () => void;
  onPaymentSearchChange: (value: string) => void;
  onPaymentCandidateMonthChange: (value: string) => void;
  onLinkPayment: (
    summary: FlowSettlementSummary,
    transaction: FlowTransaction,
  ) => void;
  onUnlinkPayment: (summary: FlowSettlementSummary) => void;
  formatAmount: (amount: number) => string;
};

function SettlementBreakdown({
  members,
  summaries,
  memberNamesById,
  paymentLinksBySettlementId,
  linkedTransactionsById,
  paymentCandidates,
  linkingSettlementId,
  paymentSearch,
  paymentCandidateDate,
  paymentCandidateMonth,
  isLinkingPayment,
  isMonthClosed,
  dateFormat,
  onStartLink,
  onCancelLink,
  onPaymentSearchChange,
  onPaymentCandidateMonthChange,
  onLinkPayment,
  onUnlinkPayment,
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
              paymentLink={paymentLinksBySettlementId.get(
                getSettlementId(summary),
              )}
              linkedTransaction={
                summary.paymentTransactionId
                  ? linkedTransactionsById.get(summary.paymentTransactionId)
                  : undefined
              }
              paymentCandidates={paymentCandidates}
              isLinking={linkingSettlementId === getSettlementId(summary)}
              paymentSearch={paymentSearch}
              paymentCandidateDate={paymentCandidateDate}
              paymentCandidateMonth={paymentCandidateMonth}
              isLinkingPayment={isLinkingPayment}
              isMonthClosed={isMonthClosed}
              dateFormat={dateFormat}
              onStartLink={onStartLink}
              onCancelLink={onCancelLink}
              onPaymentSearchChange={onPaymentSearchChange}
              onPaymentCandidateMonthChange={onPaymentCandidateMonthChange}
              onLinkPayment={onLinkPayment}
              onUnlinkPayment={onUnlinkPayment}
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
  paymentLink,
  linkedTransaction,
  paymentCandidates,
  isLinking,
  paymentSearch,
  paymentCandidateDate,
  paymentCandidateMonth,
  isLinkingPayment,
  isMonthClosed,
  dateFormat,
  onStartLink,
  onCancelLink,
  onPaymentSearchChange,
  onPaymentCandidateMonthChange,
  onLinkPayment,
  onUnlinkPayment,
  formatAmount,
}: {
  summary: FlowSettlementSummary;
  memberNamesById: Map<string, string>;
  paymentLink: FlowSettlementPaymentLink | undefined;
  linkedTransaction: FlowTransaction | undefined;
  paymentCandidates: FlowTransaction[];
  isLinking: boolean;
  paymentSearch: string;
  paymentCandidateDate: string;
  paymentCandidateMonth: string;
  isLinkingPayment: boolean;
  isMonthClosed: boolean;
  dateFormat: string;
  onStartLink: (summary: FlowSettlementSummary) => void;
  onCancelLink: () => void;
  onPaymentSearchChange: (value: string) => void;
  onPaymentCandidateMonthChange: (value: string) => void;
  onLinkPayment: (
    summary: FlowSettlementSummary,
    transaction: FlowTransaction,
  ) => void;
  onUnlinkPayment: (summary: FlowSettlementSummary) => void;
  formatAmount: (amount: number) => string;
}) {
  const { t } = useTranslation();
  const match = getPaymentMatch(summary, linkedTransaction, formatAmount);
  const visibleCandidates = getSortedPaymentCandidates({
    candidates: paymentCandidates,
    summary,
    memberNamesById,
    search: paymentSearch,
  });
  const displayedCandidates = visibleCandidates.slice(0, 25);
  const paymentMonthInputId = `flow-payment-month-${summary.fromMemberId}-${summary.toMemberId}`;
  const paymentSearchInputId = `flow-payment-search-${summary.fromMemberId}-${summary.toMemberId}`;

  return (
    <View
      style={{
        flexDirection: 'column',
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 8,
        backgroundColor: theme.pageBackground,
        padding: 16,
        gap: 14,
      }}
    >
      <View
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'start',
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
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>Status</Trans>: {formatSettlementStatus(summary.status)}
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

      <View
        style={{
          borderTop: `1px solid ${theme.tableBorder}`,
          paddingTop: 12,
          gap: 10,
        }}
      >
        {paymentLink ? (
          <View style={{ flexDirection: 'column', gap: 6 }}>
            <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
              <Trans>Linked payment</Trans>
            </Text>
            {linkedTransaction ? (
              <PaymentTransactionSummary
                transaction={linkedTransaction}
                dateFormat={dateFormat}
                formatAmount={formatAmount}
              />
            ) : (
              <Text style={{ color: theme.warningText, fontSize: 12 }}>
                <Trans>
                  Payment transaction was linked but could not be found.
                </Trans>
              </Text>
            )}
            <Text style={{ color: match.color, fontSize: 12 }}>
              {match.label}
            </Text>
          </View>
        ) : (
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>No Actual payment transaction is linked yet.</Trans>
          </Text>
        )}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Button
            variant="normal"
            onPress={() => (isLinking ? onCancelLink() : onStartLink(summary))}
            isDisabled={isLinkingPayment || isMonthClosed}
            style={actionButtonStyle('blue')}
          >
            {isLinking
              ? t('Cancel link')
              : paymentLink
                ? t('Change payment')
                : t('Link payment')}
          </Button>
          {paymentLink && (
            <Button
              variant="normal"
              onPress={() => onUnlinkPayment(summary)}
              isDisabled={isLinkingPayment || isMonthClosed}
              style={actionButtonStyle('red')}
            >
              <Trans>Unlink</Trans>
            </Button>
          )}
        </View>

        {isLinking && (
          <View
            style={{
              border: `1px solid ${theme.tableBorder}`,
              borderRadius: 8,
              padding: 10,
              gap: 10,
            }}
          >
            <View
              style={{
                display: 'grid',
                gridTemplateColumns: '160px minmax(180px, 1fr)',
                gap: 10,
                alignItems: 'end',
              }}
            >
              <label
                htmlFor={paymentMonthInputId}
                aria-label={t('Payment month')}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                <span style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                  <Trans>Payment month</Trans>
                </span>
                <DateSelect
                  id={paymentMonthInputId}
                  value={paymentCandidateDate}
                  dateFormat={dateFormat}
                  inputProps={{
                    'aria-label': t('Payment transaction month'),
                    style: { width: 140 },
                  }}
                  onSelect={date =>
                    onPaymentCandidateMonthChange(
                      monthUtils.monthFromDate(date),
                    )
                  }
                />
              </label>
              <label
                htmlFor={paymentSearchInputId}
                aria-label={t('Search')}
                style={{ display: 'flex', flexDirection: 'column', gap: 4 }}
              >
                <span style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                  <Trans>Search</Trans>
                </span>
                <input
                  id={paymentSearchInputId}
                  value={paymentSearch}
                  placeholder={t('Search transactions')}
                  onChange={event => onPaymentSearchChange(event.target.value)}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    backgroundColor: theme.formInputBackground,
                    color: theme.formInputText,
                    border: `1px solid ${theme.formInputBorder}`,
                    borderRadius: 6,
                    padding: '7px 9px',
                  }}
                />
              </label>
            </View>
            {visibleCandidates.length === 0 ? (
              <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
                <Trans>No candidate transactions found for this month.</Trans>
              </Text>
            ) : (
              <PaymentCandidateTable
                summary={summary}
                candidates={displayedCandidates}
                dateFormat={dateFormat}
                formatAmount={formatAmount}
                isLinkingPayment={isLinkingPayment}
                isMonthClosed={isMonthClosed}
                onLinkPayment={onLinkPayment}
              />
            )}
            <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
              {paymentCandidateMonth}{' '}
              <Trans>
                candidates include regular transactions and transfers. Linking
                does not edit the Actual transaction.
              </Trans>
              {visibleCandidates.length > displayedCandidates.length
                ? ` ${t('Showing the first {{count}} matches.', {
                    count: displayedCandidates.length,
                  })}`
                : ''}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

function PaymentTransactionSummary({
  transaction,
  dateFormat,
  formatAmount,
}: {
  transaction: FlowTransaction;
  dateFormat: string;
  formatAmount: (amount: number) => string;
}) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1fr) auto',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <View style={{ flexDirection: 'column', gap: 2 }}>
        <Text style={{ fontWeight: 600 }}>
          {transaction.payeeName ||
            transaction.notes ||
            t('Unnamed transaction')}
        </Text>
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          {formatDate(parseISO(transaction.date), dateFormat)}
          {' · '}
          {transaction.accountName ?? transaction.accountId}
          {transaction.notes ? ` · ${transaction.notes}` : ''}
        </Text>
      </View>
      <FinancialText
        style={{
          color:
            transaction.amount < 0
              ? theme.budgetNumberNegative
              : receiverMoneyColor,
          fontWeight: 600,
          ...styles.tnum,
        }}
      >
        {formatAmount(Math.abs(transaction.amount))}
      </FinancialText>
    </View>
  );
}

function PaymentCandidateTable({
  summary,
  candidates,
  dateFormat,
  formatAmount,
  isLinkingPayment,
  isMonthClosed,
  onLinkPayment,
}: {
  summary: FlowSettlementSummary;
  candidates: FlowTransaction[];
  dateFormat: string;
  formatAmount: (amount: number) => string;
  isLinkingPayment: boolean;
  isMonthClosed: boolean;
  onLinkPayment: (
    summary: FlowSettlementSummary,
    transaction: FlowTransaction,
  ) => void;
}) {
  const { t } = useTranslation();
  const headers = [
    t('Date'),
    t('Account'),
    t('Payee'),
    t('Notes'),
    t('Amount'),
    t('Match'),
    t('Action'),
  ];

  return (
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
          minWidth: 760,
          borderCollapse: 'collapse',
        }}
      >
        <thead>
          <tr>
            {headers.map((header, index) => (
              <th
                key={header}
                style={index === 4 ? rightTableHeaderStyle : tableHeaderStyle}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {candidates.map(candidate => {
            const candidateMatch = getPaymentMatch(
              summary,
              candidate,
              formatAmount,
            );

            return (
              <tr key={candidate.id}>
                <td style={tableCellStyle}>
                  {formatDate(parseISO(candidate.date), dateFormat)}
                </td>
                <td style={tableCellStyle}>
                  {candidate.accountName ?? candidate.accountId}
                </td>
                <td style={tableCellStyle}>
                  {candidate.payeeName || t('Unnamed transaction')}
                </td>
                <td
                  style={{
                    ...tableCellStyle,
                    maxWidth: 220,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                  title={candidate.notes ?? ''}
                >
                  {candidate.notes ?? ''}
                </td>
                <td style={rightTableCellStyle}>
                  <FinancialText>
                    {formatAmount(Math.abs(candidate.amount))}
                  </FinancialText>
                </td>
                <td style={tableCellStyle}>
                  <Text style={{ color: candidateMatch.color, fontSize: 12 }}>
                    {candidateMatch.label}
                  </Text>
                </td>
                <td style={tableCellStyle}>
                  <Button
                    variant="normal"
                    onPress={() => onLinkPayment(summary, candidate)}
                    isDisabled={isLinkingPayment || isMonthClosed}
                    style={actionButtonStyle('blue')}
                  >
                    <Trans>Link</Trans>
                  </Button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
  isMonthClosed: boolean;
  onMarkItemSettled: (item: FlowSettlementItem) => void;
};

function SettlementItemsTable({
  items,
  memberNamesById,
  dateFormat,
  formatAmount,
  isSettling,
  isMonthClosed,
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
                        isSettling ||
                        isMonthClosed ||
                        item.settlementStatus === 'settled'
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
  monthStatus,
  monthClosure,
  paymentLinks,
  isLoading,
  error,
}: {
  snapshot: FlowSettlementSnapshot | undefined;
  monthStatus: FlowSettlementMonthStatus;
  monthClosure: FlowSettlementMonthClosure | null;
  paymentLinks: FlowSettlementPaymentLink[];
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
      <View style={{ flexDirection: 'column', gap: 8 }}>
        <Text style={{ color: theme.pageTextSubdued }}>
          {snapshot && snapshot.settlements.length > 0 ? (
            <Trans>
              Saved settlement snapshot found for this month. Recalculate to
              compare it with current transaction metadata.
            </Trans>
          ) : (
            <Trans>No saved settlement snapshot exists for this month.</Trans>
          )}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>Status</Trans>: {formatMonthStatus(monthStatus)}
          </Text>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>Saved summaries</Trans>: {snapshot?.settlements.length ?? 0}
          </Text>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>Linked payments</Trans>: {paymentLinks.length}
          </Text>
          {monthClosure?.closedAt && (
            <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
              <Trans>Closed</Trans>: {monthClosure.closedAt}
            </Text>
          )}
          {monthClosure?.reopenedAt && (
            <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
              <Trans>Reopened</Trans>: {monthClosure.reopenedAt}
            </Text>
          )}
        </View>
        {paymentLinks.length > 0 && (
          <View style={{ flexDirection: 'column', gap: 4 }}>
            {paymentLinks.map(link => (
              <Text
                key={link.id}
                style={{ color: theme.pageTextSubdued, fontSize: 12 }}
              >
                {link.settlementId}: {link.paymentTransactionId}
              </Text>
            ))}
          </View>
        )}
      </View>
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
          : status.kind === 'closed-preview'
            ? 'Settlement calculated as preview. Reopen the month before saving changes.'
            : status.kind === 'payment-linked'
              ? 'Payment transaction linked and settlement marked paid.'
              : status.kind === 'payment-unlinked'
                ? 'Payment transaction unlinked.'
                : status.kind === 'month-reopened'
                  ? 'Settlement month reopened.'
                  : status.kind === 'settled'
                    ? `${status.updated} transaction status update${
                        status.updated === 1 ? '' : 's'
                      } saved as settled.`
                    : status.kind === 'item-settled'
                      ? `${status.updated} transaction status update${
                          status.updated === 1 ? '' : 's'
                        } saved as settled.`
                      : status.kind === 'month-closed'
                        ? `Settlement month closed. ${status.updated} source transaction metadata update${
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
  const isPlainText =
    typeof children === 'string' || typeof children === 'number';

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
      {isPlainText ? (
        <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  );
}

function getEffectiveMonthStatus({
  closure,
  snapshot,
  paymentLinks,
}: {
  closure: FlowSettlementMonthClosure | null;
  snapshot: FlowSettlementSnapshot | undefined;
  paymentLinks: FlowSettlementPaymentLink[];
}): FlowSettlementMonthStatus {
  if (closure?.status) {
    return closure.status;
  }

  if (paymentLinks.length > 0) {
    return 'payment-linked';
  }

  if (snapshot && snapshot.settlements.length > 0) {
    return 'calculated';
  }

  return 'open';
}

function mergeSummariesWithPaymentLinks(
  summaries: FlowSettlementSummary[],
  paymentLinksBySettlementId: Map<string, FlowSettlementPaymentLink>,
): FlowSettlementSummary[] {
  return summaries.map(summary => {
    const paymentLink = paymentLinksBySettlementId.get(
      getSettlementId(summary),
    );

    if (!paymentLink) {
      return summary;
    }

    return {
      ...summary,
      status: summary.status === 'closed' ? 'closed' : 'paid',
      paymentTransactionId: paymentLink.paymentTransactionId,
    };
  });
}

function formatMonthStatus(status: FlowSettlementMonthStatus) {
  switch (status) {
    case 'payment-linked':
      return 'Payment linked';
    case 'calculated':
      return 'Calculated';
    case 'closed':
      return 'Closed';
    case 'reopened':
      return 'Reopened';
    case 'open':
    default:
      return 'Open';
  }
}

function getMonthStatusColor(status: FlowSettlementMonthStatus) {
  switch (status) {
    case 'closed':
    case 'payment-linked':
      return receiverMoneyColor;
    case 'calculated':
    case 'reopened':
      return theme.noticeTextLight;
    case 'open':
    default:
      return theme.pageTextSubdued;
  }
}

function formatSettlementStatus(status: FlowSettlementSummary['status']) {
  switch (status) {
    case 'paid':
      return 'Paid';
    case 'closed':
      return 'Closed';
    case 'adjusted':
      return 'Adjusted';
    case 'ignored':
      return 'Ignored';
    case 'open':
    default:
      return 'Open';
  }
}

function getPaymentMatch(
  summary: FlowSettlementSummary,
  transaction: FlowTransaction | undefined,
  formatAmount: (amount: number) => string,
): { label: string; color: string; isMismatch: boolean } {
  if (!transaction) {
    return {
      label: 'Payment transaction not found.',
      color: theme.warningText,
      isMismatch: true,
    };
  }

  const difference = Math.abs(Math.abs(transaction.amount) - summary.amount);

  if (difference === 0) {
    return {
      label: 'Payment amount matches settlement.',
      color: receiverMoneyColor,
      isMismatch: false,
    };
  }

  if (difference <= 100) {
    return {
      label: `Payment differs by ${formatAmount(difference)}. Check before closing.`,
      color: theme.noticeTextLight,
      isMismatch: true,
    };
  }

  return {
    label: 'Selected payment does not match settlement amount.',
    color: theme.warningText,
    isMismatch: true,
  };
}

function getSortedPaymentCandidates({
  candidates,
  summary,
  memberNamesById,
  search,
}: {
  candidates: FlowTransaction[];
  summary: FlowSettlementSummary;
  memberNamesById: Map<string, string>;
  search: string;
}): FlowTransaction[] {
  const normalizedSearch = search.trim().toLowerCase();
  const payerName = getMemberName(summary.fromMemberId, memberNamesById);
  const receiverName = getMemberName(summary.toMemberId, memberNamesById);

  return candidates
    .filter(candidate =>
      normalizedSearch
        ? getTransactionSearchText(candidate).includes(normalizedSearch)
        : true,
    )
    .sort((left, right) => {
      const leftScore = getPaymentCandidateScore({
        transaction: left,
        amount: summary.amount,
        payerName,
        receiverName,
      });
      const rightScore = getPaymentCandidateScore({
        transaction: right,
        amount: summary.amount,
        payerName,
        receiverName,
      });

      return (
        leftScore - rightScore ||
        right.date.localeCompare(left.date) ||
        left.id.localeCompare(right.id)
      );
    });
}

function getTransactionSearchText(transaction: FlowTransaction) {
  return [
    transaction.date,
    transaction.accountName,
    transaction.payeeName,
    transaction.categoryName,
    transaction.notes,
    String(Math.abs(transaction.amount)),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function getPaymentCandidateScore({
  transaction,
  amount,
  payerName,
  receiverName,
}: {
  transaction: FlowTransaction;
  amount: number;
  payerName: string;
  receiverName: string;
}) {
  const difference = Math.abs(Math.abs(transaction.amount) - amount);
  const searchText = getTransactionSearchText(transaction);
  const hasSettlementText = searchText.includes('settlement') ? 0 : 10_000;
  const hasMemberText =
    searchText.includes(payerName.toLowerCase()) ||
    searchText.includes(receiverName.toLowerCase())
      ? 0
      : 5_000;

  return difference + hasSettlementText + hasMemberText;
}

function getMonthCloseWarnings({
  summaries,
  paymentLinksBySettlementId,
  linkedTransactionsById,
  formatAmount,
}: {
  summaries: FlowSettlementSummary[];
  paymentLinksBySettlementId: Map<string, FlowSettlementPaymentLink>;
  linkedTransactionsById: Map<string, FlowTransaction>;
  formatAmount: (amount: number) => string;
}) {
  const warnings: string[] = [];

  for (const summary of summaries) {
    const link = paymentLinksBySettlementId.get(getSettlementId(summary));

    if (!link) {
      warnings.push(
        `No linked payment for ${summary.fromMemberId} to ${summary.toMemberId}.`,
      );
      continue;
    }

    const transaction = linkedTransactionsById.get(link.paymentTransactionId);

    if (!transaction) {
      warnings.push(
        `Linked payment transaction ${link.paymentTransactionId} could not be found.`,
      );
      continue;
    }

    const match = getPaymentMatch(summary, transaction, formatAmount);

    if (match.isMismatch) {
      warnings.push(`${transaction.id}: ${match.label}`);
    }
  }

  return warnings;
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
