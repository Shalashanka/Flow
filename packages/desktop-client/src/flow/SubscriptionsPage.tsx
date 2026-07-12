import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import type { SelectOption } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import { listen } from '@actual-app/core/platform/client/connection';
import type {
  AccountEntity,
  CategoryEntity,
  PayeeEntity,
} from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format as formatDate, isValid, parseISO, subMonths } from 'date-fns';

import { FinancialText } from '#components/FinancialText';
import { Page } from '#components/Page';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';
import { usePayees } from '#hooks/usePayees';

import { getFlowSubscriptionTransactions } from './actual-adapter';
import { calculateFlowSubscriptions } from './subscriptions/calculate';
import { detectSubscriptionCandidates } from './subscriptions/detect';
import {
  deleteFlowSubscription,
  getFlowSubscriptionMatches,
  getFlowSubscriptions,
  saveFlowSubscription,
  saveFlowSubscriptionMatches,
} from './subscriptions/storage';
import {
  panelStyle,
  selectStyle,
  summaryCardStyle,
  summaryGridStyle,
} from './subscriptions/styles';
import { SubscriptionCard } from './subscriptions/SubscriptionCard';
import {
  createBlankSubscriptionDraft,
  draftToSubscription,
  SubscriptionForm,
  subscriptionToDraft,
} from './subscriptions/SubscriptionForm';
import type { SubscriptionDraft } from './subscriptions/SubscriptionForm';
import type {
  FlowSubscription,
  FlowSubscriptionCandidate,
  FlowSubscriptionComputed,
  FlowSubscriptionMatch,
  FlowSubscriptionRecurrence,
  FlowSubscriptionStatus,
  FlowSubscriptionSummary,
} from './subscriptions/types';

type StatusFilter = 'all' | FlowSubscriptionStatus;
type RecurrenceFilter = 'all' | FlowSubscriptionRecurrence;
type StatusState =
  | { kind: 'scan'; count: number }
  | { kind: 'saved'; name: string }
  | { kind: 'archived'; name: string }
  | { kind: 'error'; message: string };

const emptySubscriptions: FlowSubscription[] = [];
const emptyMatches: FlowSubscriptionMatch[] = [];
const emptyTransactions: Awaited<
  ReturnType<typeof getFlowSubscriptionTransactions>
> = [];
const emptyAccounts: AccountEntity[] = [];
const emptyCategories: CategoryEntity[] = [];
const emptyPayees: PayeeEntity[] = [];

export function SubscriptionsPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const queryClient = useQueryClient();
  const [scanMonths, setScanMonths] = useState('12');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [recurrenceFilter, setRecurrenceFilter] =
    useState<RecurrenceFilter>('all');
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState<SubscriptionDraft | null>(null);
  const [expandedSubscriptionId, setExpandedSubscriptionId] = useState<
    string | null
  >(null);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const currentDate = formatDate(new Date(), 'yyyy-MM-dd');
  const scanRange = useMemo(
    () => createScanRange(currentDate, Number(scanMonths)),
    [currentDate, scanMonths],
  );

  const subscriptionsQuery = useQuery({
    queryKey: ['flow', 'subscriptions'],
    queryFn: getFlowSubscriptions,
  });
  const matchesQuery = useQuery({
    queryKey: ['flow', 'subscription-matches'],
    queryFn: () => getFlowSubscriptionMatches(),
  });
  const transactionsQuery = useQuery({
    queryKey: ['flow', 'subscription-scan-transactions', scanRange],
    queryFn: () => getFlowSubscriptionTransactions(scanRange),
  });
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const payeesQuery = usePayees();
  const subscriptions = subscriptionsQuery.data ?? emptySubscriptions;
  const matches = matchesQuery.data ?? emptyMatches;
  const transactions = transactionsQuery.data ?? emptyTransactions;
  const accounts = accountsQuery.data ?? emptyAccounts;
  const categories = categoriesQuery.data?.list ?? emptyCategories;
  const payees = payeesQuery.data ?? emptyPayees;
  const { rows, summary } = useMemo(
    () =>
      calculateFlowSubscriptions({
        subscriptions,
        matches,
        transactions,
        currentDate,
      }),
    [currentDate, matches, subscriptions, transactions],
  );
  const filteredRows = useMemo(
    () =>
      filterAndSortRows({
        rows,
        statusFilter,
        recurrenceFilter,
        search,
      }),
    [recurrenceFilter, rows, search, statusFilter],
  );
  const accountsById = useMemo(
    () => new Map(accounts.map(account => [account.id, account])),
    [accounts],
  );
  const categoriesById = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories],
  );
  const payeesById = useMemo(
    () => new Map(payees.map(payee => [payee.id, payee])),
    [payees],
  );
  const accountOptions = useMemo(
    () => createAccountOptions(accounts, t),
    [accounts, t],
  );
  const categoryOptions = useMemo(
    () => createCategoryOptions(categories, t),
    [categories, t],
  );
  const payeeOptions = useMemo(
    () => createPayeeOptions(payees, t),
    [payees, t],
  );
  const recurrenceOptions = useMemo(() => createRecurrenceOptions(t), [t]);
  const statusOptions = useMemo(() => createStatusOptions(t), [t]);
  const isBusy =
    subscriptionsQuery.isLoading ||
    matchesQuery.isLoading ||
    transactionsQuery.isLoading ||
    accountsQuery.isLoading ||
    categoriesQuery.isLoading ||
    payeesQuery.isLoading ||
    isScanning;

  useEffect(() => {
    return listen('sync-event', event => {
      if (
        'tables' in event &&
        event.tables.some(table =>
          [
            'flow_subscriptions',
            'flow_subscription_matches',
            'transactions',
            'accounts',
            'categories',
            'payees',
            'schedules',
          ].includes(table),
        )
      ) {
        void queryClient.invalidateQueries({ queryKey: ['flow'] });
      }
    });
  }, [queryClient]);

  async function refetchSubscriptions() {
    await Promise.all([subscriptionsQuery.refetch(), matchesQuery.refetch()]);
  }

  async function handleScan() {
    setIsScanning(true);
    setStatus(null);

    try {
      const transactionResult = await transactionsQuery.refetch();

      if (transactionResult.error) {
        throw transactionResult.error;
      }

      const candidates = detectSubscriptionCandidates(
        transactionResult.data ?? [],
      );
      let savedCount = 0;

      for (const candidate of candidates) {
        const existing = findExistingSubscription(subscriptions, candidate);
        const saved = await saveFlowSubscription(
          mergeCandidate(existing, candidate),
        );
        const candidateMatches = createCandidateMatches(saved, candidate);
        await saveFlowSubscriptionMatches(saved.id, candidateMatches);
        savedCount += 1;
      }

      await refetchSubscriptions();
      setStatus({ kind: 'scan', count: savedCount });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Subscription scan failed.'),
      });
    } finally {
      setIsScanning(false);
    }
  }

  async function handleSave() {
    if (!draft) {
      return;
    }

    if (!draft.name.trim()) {
      setStatus({
        kind: 'error',
        message: t('Subscription name is required.'),
      });
      return;
    }

    try {
      const saved = await saveFlowSubscription(draftToSubscription(draft));
      setDraft(null);
      setStatus({ kind: 'saved', name: saved.name });
      await refetchSubscriptions();
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Subscription could not be saved.'),
      });
    }
  }

  async function handleSetStatus(
    subscription: FlowSubscription,
    nextStatus: FlowSubscriptionStatus,
  ) {
    try {
      const saved = await saveFlowSubscription({
        ...subscription,
        status: nextStatus,
      });
      setStatus({ kind: 'saved', name: saved.name });
      await refetchSubscriptions();
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Subscription status could not be changed.'),
      });
    }
  }

  async function handleArchive(subscription: FlowSubscription) {
    if (
      !window.confirm(
        t('Archive {{name}}? Its Flow record and matches will be hidden.', {
          name: subscription.name,
        }),
      )
    ) {
      return;
    }

    try {
      await deleteFlowSubscription(subscription.id);
      if (draft?.id === subscription.id) {
        setDraft(null);
      }
      if (expandedSubscriptionId === subscription.id) {
        setExpandedSubscriptionId(null);
      }
      setStatus({ kind: 'archived', name: subscription.name });
      await refetchSubscriptions();
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Subscription could not be archived.'),
      });
    }
  }

  const formatAmount = (amount: number) => format(amount, 'financial');
  const formatDateValue = (date: string | undefined) =>
    formatSubscriptionDate(date, dateFormat, t);

  return (
    <Page header={null}>
      <View
        style={{ maxWidth: 1180, minHeight: 'auto', gap: 16, paddingTop: 10 }}
      >
        <OverviewPanel
          summary={summary}
          scanMonths={scanMonths}
          isBusy={isBusy}
          formatAmount={formatAmount}
          onScanMonthsChange={setScanMonths}
          onScan={handleScan}
          onAdd={() => {
            setDraft(createBlankSubscriptionDraft());
            setStatus(null);
          }}
        />

        {status && <StatusMessage status={status} />}

        {draft && (
          <SubscriptionForm
            draft={draft}
            accountOptions={accountOptions}
            categoryOptions={categoryOptions}
            payeeOptions={payeeOptions}
            recurrenceOptions={recurrenceOptions}
            statusOptions={statusOptions}
            dateFormat={dateFormat}
            onChange={setDraft}
            onSave={handleSave}
            onCancel={() => setDraft(null)}
          />
        )}

        <FiltersPanel
          statusFilter={statusFilter}
          recurrenceFilter={recurrenceFilter}
          search={search}
          onStatusFilterChange={setStatusFilter}
          onRecurrenceFilterChange={setRecurrenceFilter}
          onSearchChange={setSearch}
        />

        {subscriptionsQuery.error || matchesQuery.error ? (
          <InfoPanel tone="error">
            <Text style={{ color: theme.errorText }}>
              <Trans>Subscriptions could not be loaded.</Trans>
            </Text>
          </InfoPanel>
        ) : rows.length === 0 ? (
          <InfoPanel>
            <View style={{ gap: 5 }}>
              <Text style={{ fontWeight: 600 }}>
                <Trans>No subscriptions have been detected yet.</Trans>
              </Text>
              <Text style={{ color: theme.pageTextSubdued }}>
                <Trans>
                  Scan Actual transaction history to find conservative recurring
                  payment candidates. Nothing is confirmed automatically.
                </Trans>
              </Text>
            </View>
          </InfoPanel>
        ) : filteredRows.length === 0 ? (
          <InfoPanel>
            <Trans>No subscriptions match the current filters.</Trans>
          </InfoPanel>
        ) : (
          <View style={{ gap: 12 }}>
            {filteredRows.map(row => {
              const { subscription } = row;
              return (
                <SubscriptionCard
                  key={subscription.id}
                  row={row}
                  accountName={
                    subscription.accountId
                      ? accountsById.get(subscription.accountId)?.name
                      : undefined
                  }
                  categoryName={
                    subscription.categoryId
                      ? categoriesById.get(subscription.categoryId)?.name
                      : undefined
                  }
                  payeeName={
                    subscription.payeeId
                      ? payeesById.get(subscription.payeeId)?.name
                      : undefined
                  }
                  isExpanded={expandedSubscriptionId === subscription.id}
                  formatAmount={formatAmount}
                  formatDate={formatDateValue}
                  onSetStatus={nextStatus =>
                    handleSetStatus(subscription, nextStatus)
                  }
                  onEdit={() => {
                    setDraft(subscriptionToDraft(subscription));
                    setStatus(null);
                  }}
                  onArchive={() => handleArchive(subscription)}
                  onToggleMatches={() =>
                    setExpandedSubscriptionId(current =>
                      current === subscription.id ? null : subscription.id,
                    )
                  }
                />
              );
            })}
          </View>
        )}
      </View>
    </Page>
  );
}

function OverviewPanel({
  summary,
  scanMonths,
  isBusy,
  formatAmount,
  onScanMonthsChange,
  onScan,
  onAdd,
}: {
  summary: FlowSubscriptionSummary;
  scanMonths: string;
  isBusy: boolean;
  formatAmount: (amount: number) => string;
  onScanMonthsChange: (months: string) => void;
  onScan: () => void;
  onAdd: () => void;
}) {
  const { t } = useTranslation();
  const cards = [
    {
      label: t('Confirmed'),
      value: String(summary.confirmedCount),
    },
    {
      label: t('Candidates'),
      value: String(summary.candidateCount),
    },
    {
      label: t('Ignored or cancelled'),
      value: String(summary.ignoredOrCancelledCount),
    },
    {
      label: t('Estimated monthly total'),
      value: formatAmount(summary.estimatedMonthlyTotal),
      financial: true,
    },
    {
      label: t('Estimated yearly total'),
      value: formatAmount(summary.estimatedYearlyTotal),
      financial: true,
    },
    {
      label: t('Price-change warnings'),
      value: String(summary.priceChangeWarningCount),
      color:
        summary.priceChangeWarningCount > 0
          ? theme.warningText
          : theme.pageText,
    },
  ];

  return (
    <View style={panelStyle}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ gap: 4, maxWidth: 650 }}>
          <Text style={{ fontSize: 18, fontWeight: 600 }}>
            <Trans>Subscriptions</Trans>
          </Text>
          <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
            <Trans>
              Detect and manage recurring payments from Actual transactions.
            </Trans>
          </Text>
        </View>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: 8,
            flexWrap: 'wrap',
          }}
        >
          <View style={{ gap: 5 }}>
            <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
              <Trans>Scan period</Trans>
            </Text>
            <Select
              options={[
                ['6', t('Last 6 months')],
                ['12', t('Last 12 months')],
                ['24', t('Last 24 months')],
              ]}
              value={scanMonths}
              onChange={onScanMonthsChange}
              style={{ ...selectStyle, width: 155 }}
            />
          </View>
          <Button variant="normal" onPress={onAdd}>
            <Trans>Add manually</Trans>
          </Button>
          <Button variant="primary" isDisabled={isBusy} onPress={onScan}>
            {isBusy ? t('Scanning...') : t('Scan transactions')}
          </Button>
        </View>
      </View>

      <View style={summaryGridStyle}>
        {cards.map(card => (
          <View key={card.label} style={summaryCardStyle}>
            <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
              {card.label}
            </Text>
            {card.financial ? (
              <FinancialText
                style={{
                  ...styles.tnum,
                  color: card.color ?? theme.pageText,
                  fontSize: 22,
                  fontWeight: 600,
                }}
              >
                {card.value}
              </FinancialText>
            ) : (
              <Text
                style={{
                  color: card.color ?? theme.pageText,
                  fontSize: 22,
                  fontWeight: 600,
                }}
              >
                {card.value}
              </Text>
            )}
          </View>
        ))}
      </View>
    </View>
  );
}

function FiltersPanel({
  statusFilter,
  recurrenceFilter,
  search,
  onStatusFilterChange,
  onRecurrenceFilterChange,
  onSearchChange,
}: {
  statusFilter: StatusFilter;
  recurrenceFilter: RecurrenceFilter;
  search: string;
  onStatusFilterChange: (filter: StatusFilter) => void;
  onRecurrenceFilterChange: (filter: RecurrenceFilter) => void;
  onSearchChange: (search: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        ...panelStyle,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        alignItems: 'end',
        gap: 12,
      }}
    >
      <FilterField label={t('Search')}>
        <Input
          value={search}
          onChangeValue={onSearchChange}
          placeholder={t('Search subscriptions')}
          style={{ width: '100%' }}
        />
      </FilterField>
      <FilterField label={t('Status')}>
        <Select
          options={[['all', t('All statuses')], ...createStatusOptions(t)]}
          value={statusFilter}
          onChange={onStatusFilterChange}
          style={selectStyle}
        />
      </FilterField>
      <FilterField label={t('Recurrence')}>
        <Select
          options={[
            ['all', t('All recurrences')],
            ...createRecurrenceOptions(t),
          ]}
          value={recurrenceFilter}
          onChange={onRecurrenceFilterChange}
          style={selectStyle}
        />
      </FilterField>
    </View>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 5, minWidth: 0 }}>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function StatusMessage({ status }: { status: StatusState }) {
  const { t } = useTranslation();

  if (status.kind === 'error') {
    return (
      <InfoPanel tone="error">
        <Text style={{ color: theme.errorText }}>{status.message}</Text>
      </InfoPanel>
    );
  }

  return (
    <Text style={{ color: theme.noticeTextLight, fontWeight: 600 }}>
      {status.kind === 'scan'
        ? t('Scan complete. {{count}} recurring candidate(s) updated.', {
            count: status.count,
          })
        : status.kind === 'saved'
          ? t('Saved {{name}}.', { name: status.name })
          : t('Archived {{name}}.', { name: status.name })}
    </Text>
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
        padding: 14,
      }}
    >
      {children}
    </View>
  );
}

function createScanRange(currentDate: string, months: number) {
  const end = parseISO(currentDate);
  return {
    start: formatDate(subMonths(end, months), 'yyyy-MM-dd'),
    end: currentDate,
  };
}

function findExistingSubscription(
  subscriptions: FlowSubscription[],
  candidate: FlowSubscriptionCandidate,
): FlowSubscription | undefined {
  return subscriptions.find(
    subscription =>
      subscription.id === candidate.candidateId ||
      Boolean(candidate.payeeId && subscription.payeeId === candidate.payeeId),
  );
}

function mergeCandidate(
  existing: FlowSubscription | undefined,
  candidate: FlowSubscriptionCandidate,
): Partial<FlowSubscription> {
  const canRefreshDetectedValues = !existing || existing.status === 'candidate';

  return {
    id: existing?.id ?? candidate.candidateId,
    name: existing?.name ?? candidate.name,
    payeeId: existing?.payeeId ?? candidate.payeeId,
    merchantMatchId: existing?.merchantMatchId,
    actualScheduleId: existing?.actualScheduleId,
    categoryId:
      canRefreshDetectedValues || !existing?.categoryId
        ? candidate.categoryId
        : existing.categoryId,
    accountId:
      canRefreshDetectedValues || !existing?.accountId
        ? candidate.accountId
        : existing.accountId,
    amount: canRefreshDetectedValues
      ? candidate.amount
      : (existing?.amount ?? candidate.amount),
    recurrence: canRefreshDetectedValues
      ? candidate.recurrence
      : (existing?.recurrence ?? candidate.recurrence),
    firstSeen: earlierDate(existing?.firstSeen, candidate.firstSeen),
    lastSeen: candidate.lastSeen,
    nextExpectedDate: candidate.nextExpectedDate,
    status: existing?.status ?? 'candidate',
    confidence: candidate.confidence,
    notes: existing?.notes,
  };
}

function createCandidateMatches(
  subscription: FlowSubscription,
  candidate: FlowSubscriptionCandidate,
): FlowSubscriptionMatch[] {
  return candidate.transactionIds.map(actualTransactionId => ({
    id: `flow-subscription-match:${subscription.id}:${actualTransactionId}`,
    subscriptionId: subscription.id,
    actualTransactionId,
    matchType: 'recurrence',
    confidence: candidate.confidence,
  }));
}

function earlierDate(left: string | undefined, right: string): string {
  return left && left < right ? left : right;
}

function filterAndSortRows({
  rows,
  statusFilter,
  recurrenceFilter,
  search,
}: {
  rows: FlowSubscriptionComputed[];
  statusFilter: StatusFilter;
  recurrenceFilter: RecurrenceFilter;
  search: string;
}) {
  const normalizedSearch = search.trim().toLocaleLowerCase();

  return rows
    .filter(
      row => statusFilter === 'all' || row.subscription.status === statusFilter,
    )
    .filter(
      row =>
        recurrenceFilter === 'all' ||
        row.subscription.recurrence === recurrenceFilter,
    )
    .filter(
      row =>
        !normalizedSearch ||
        row.subscription.name.toLocaleLowerCase().includes(normalizedSearch) ||
        row.subscription.notes?.toLocaleLowerCase().includes(normalizedSearch),
    )
    .sort(
      (left, right) =>
        statusWeight(left.subscription.status) -
          statusWeight(right.subscription.status) ||
        right.warnings.length - left.warnings.length ||
        left.subscription.name.localeCompare(right.subscription.name),
    );
}

function statusWeight(status: FlowSubscriptionStatus) {
  switch (status) {
    case 'candidate':
      return 1;
    case 'confirmed':
      return 2;
    case 'paused':
      return 3;
    case 'cancelled':
      return 4;
    case 'ignored':
    default:
      return 5;
  }
}

function createAccountOptions(
  accounts: AccountEntity[],
  t: (key: string) => string,
): Array<SelectOption<string>> {
  return [
    ['', t('No linked account')],
    ...accounts
      .filter(account => !account.tombstone)
      .map(
        account =>
          [
            account.id,
            account.closed ? `${account.name} (${t('closed')})` : account.name,
          ] satisfies SelectOption<string>,
      ),
  ];
}

function createCategoryOptions(
  categories: CategoryEntity[],
  t: (key: string) => string,
): Array<SelectOption<string>> {
  return [
    ['', t('No linked category')],
    ...categories
      .filter(category => !category.tombstone)
      .map(
        category =>
          [
            category.id,
            category.hidden
              ? `${category.name} (${t('hidden')})`
              : category.name,
          ] satisfies SelectOption<string>,
      ),
  ];
}

function createPayeeOptions(
  payees: PayeeEntity[],
  t: (key: string) => string,
): Array<SelectOption<string>> {
  return [
    ['', t('No linked payee')],
    ...payees
      .filter(payee => !payee.tombstone && !payee.transfer_acct)
      .map(payee => [payee.id, payee.name] satisfies SelectOption<string>),
  ];
}

function createStatusOptions(
  t: (key: string) => string,
): Array<SelectOption<FlowSubscriptionStatus>> {
  return [
    ['candidate', t('Candidate')],
    ['confirmed', t('Confirmed')],
    ['paused', t('Paused')],
    ['ignored', t('Ignored')],
    ['cancelled', t('Cancelled')],
  ];
}

function createRecurrenceOptions(
  t: (key: string) => string,
): Array<SelectOption<FlowSubscriptionRecurrence>> {
  return [
    ['weekly', t('Weekly')],
    ['biweekly', t('Every two weeks')],
    ['monthly', t('Monthly')],
    ['quarterly', t('Quarterly')],
    ['yearly', t('Yearly')],
    ['irregular', t('Irregular')],
    ['unknown', t('Unknown')],
  ];
}

function formatSubscriptionDate(
  date: string | undefined,
  dateFormat: string,
  t: (key: string) => string,
): string {
  if (!date) {
    return t('Not set');
  }

  const parsed = parseISO(date);
  return isValid(parsed) ? formatDate(parsed, dateFormat) : t('Invalid date');
}
