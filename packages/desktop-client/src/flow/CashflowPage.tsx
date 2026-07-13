import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgInformationCircle } from '@actual-app/components/icons/v2';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import type { SelectOption } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import { listen } from '@actual-app/core/platform/client/connection';
import * as monthUtils from '@actual-app/core/shared/months';
import type {
  AccountEntity,
  CategoryEntity,
} from '@actual-app/core/types/models';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format as formatDate, isValid, parseISO } from 'date-fns';

import { FinancialText } from '#components/FinancialText';
import { Page } from '#components/Page';
import { DateSelect } from '#components/select/DateSelect';
import { FinancialInput } from '#components/util/FinancialInput';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';

import { getFlowCashflowTransactions } from './actual-adapter';
import {
  calculateFlowCashflow,
  createCalculationFromSavedRun,
} from './cashflow/calculate';
import type { FlowCashflowOneOff } from './cashflow/calculate';
import { CashflowTable } from './cashflow/CashflowTable';
import {
  deleteFlowCashflowRun,
  getFlowCashflowRows,
  getFlowCashflowRuns,
  saveFlowCashflowRun,
} from './cashflow/storage';
import {
  controlsGridStyle,
  detailsStyle,
  fullWidthInputStyle,
  panelStyle,
  selectStyle,
  summaryCardStyle,
  summaryGridStyle,
} from './cashflow/styles';
import type {
  FlowCashflowCalculation,
  FlowCashflowRun,
  FlowCashflowStartingCashSource,
  FlowCashflowSummary,
} from './cashflow/types';
import { getFlowDebts } from './debts/storage';
import { createDefaultFlowSettings } from './planning/defaults';
import { loadFlowSettings } from './planning/storage';
import { getFlowSubscriptions } from './subscriptions/storage';
import { getFlowTransactionMetadataMany } from './transaction-metadata/storage';

type StatusState =
  | { kind: 'generated' }
  | { kind: 'saved' }
  | { kind: 'loaded' }
  | { kind: 'deleted' }
  | { kind: 'error'; message: string };

const emptyAccounts: AccountEntity[] = [];
const emptyCategories: CategoryEntity[] = [];
const emptyTransactions: Awaited<
  ReturnType<typeof getFlowCashflowTransactions>
> = [];
const emptyMetadata: Awaited<
  ReturnType<typeof getFlowTransactionMetadataMany>
> = [];
const emptySubscriptions: Awaited<ReturnType<typeof getFlowSubscriptions>> = [];
const emptyDebts: Awaited<ReturnType<typeof getFlowDebts>> = [];
const emptyRuns: FlowCashflowRun[] = [];
const defaultSettings = createDefaultFlowSettings();

export function CashflowPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const queryClient = useQueryClient();
  const didInitialize = useRef(false);
  const currentDate = formatDate(new Date(), 'yyyy-MM-dd');
  const currentMonth = currentDate.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [startingCashSource, setStartingCashSource] =
    useState<FlowCashflowStartingCashSource>('manual');
  const [manualStartingCash, setManualStartingCash] = useState(0);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [safeMinimumBalance, setSafeMinimumBalance] = useState(0);
  const [warningBalance, setWarningBalance] = useState(0);
  const [oneOff, setOneOff] = useState<FlowCashflowOneOff>({
    enabled: false,
    name: '',
    amount: 0,
    date: currentDate,
  });
  const [calculation, setCalculation] =
    useState<FlowCashflowCalculation | null>(null);
  const [loadedRunId, setLoadedRunId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);
  const selectedMonthDate = monthUtils.firstDayOfMonth(selectedMonth);
  const monthRange = useMemo(
    () => ({
      start: monthUtils.firstDayOfMonth(selectedMonth),
      end: monthUtils.lastDayOfMonth(selectedMonth),
    }),
    [selectedMonth],
  );

  const settingsQuery = useQuery({
    queryKey: ['flow', 'settings', 'cashflow'],
    queryFn: loadFlowSettings,
  });
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const subscriptionsQuery = useQuery({
    queryKey: ['flow', 'subscriptions'],
    queryFn: getFlowSubscriptions,
  });
  const debtsQuery = useQuery({
    queryKey: ['flow', 'debts'],
    queryFn: getFlowDebts,
  });
  const transactionsQuery = useQuery({
    queryKey: ['flow', 'cashflow', 'transactions', monthRange],
    queryFn: () => getFlowCashflowTransactions(monthRange),
  });
  const transactionIds = useMemo(
    () =>
      (transactionsQuery.data ?? emptyTransactions).map(
        transaction => transaction.id,
      ),
    [transactionsQuery.data],
  );
  const metadataQuery = useQuery({
    queryKey: ['flow', 'cashflow', 'transaction-metadata', transactionIds],
    queryFn: () => getFlowTransactionMetadataMany(transactionIds),
    enabled: transactionIds.length > 0,
    placeholderData: emptyMetadata,
  });
  const runsQuery = useQuery({
    queryKey: ['flow', 'cashflow-runs', selectedMonth],
    queryFn: () => getFlowCashflowRuns(selectedMonth),
  });

  const settingsResult = settingsQuery.data;
  const settings = settingsResult?.settings ?? defaultSettings;
  const accounts = accountsQuery.data ?? emptyAccounts;
  const categories = categoriesQuery.data?.list ?? emptyCategories;
  const subscriptions = subscriptionsQuery.data ?? emptySubscriptions;
  const debts = debtsQuery.data ?? emptyDebts;
  const transactions = transactionsQuery.data ?? emptyTransactions;
  const metadata = metadataQuery.data ?? emptyMetadata;
  const savedRuns = runsQuery.data ?? emptyRuns;
  const latestSavedRun = savedRuns[0];
  const activeAccounts = useMemo(
    () => accounts.filter(account => !account.tombstone && !account.closed),
    [accounts],
  );
  const accountNames = useMemo(
    () => new Map(accounts.map(account => [account.id, account.name])),
    [accounts],
  );
  const categoryNames = useMemo(
    () => new Map(categories.map(category => [category.id, category.name])),
    [categories],
  );
  const metadataByTransactionId = useMemo(
    () => new Map(metadata.map(record => [record.actualTransactionId, record])),
    [metadata],
  );
  const actualStartingCash = useMemo(() => {
    const selected = new Set(selectedAccountIds);
    const currentBalances = accounts.reduce(
      (sum, account) =>
        selected.has(account.id) ? sum + (account.balance_current ?? 0) : sum,
      0,
    );
    if (selectedMonth !== currentMonth) {
      return currentBalances;
    }
    const postedNet = transactions.reduce((sum, transaction) => {
      const metadataRecord = metadataByTransactionId.get(transaction.id);
      return selected.has(transaction.accountId) &&
        metadataRecord?.data.cashflowIncluded !== false
        ? sum + transaction.amount
        : sum;
    }, 0);
    return currentBalances - postedNet;
  }, [
    accounts,
    currentMonth,
    metadataByTransactionId,
    selectedAccountIds,
    selectedMonth,
    transactions,
  ]);
  const effectiveStartingCash =
    startingCashSource === 'actual-accounts'
      ? actualStartingCash
      : manualStartingCash;
  const isBusy =
    settingsQuery.isLoading ||
    accountsQuery.isLoading ||
    categoriesQuery.isLoading ||
    subscriptionsQuery.isLoading ||
    debtsQuery.isLoading ||
    transactionsQuery.isLoading ||
    metadataQuery.isLoading ||
    runsQuery.isLoading;

  useEffect(() => {
    if (
      didInitialize.current ||
      !settingsResult ||
      activeAccounts.length === 0
    ) {
      return;
    }

    const cashflowSettings = settingsResult.settings.cashflowSettings;
    setStartingCashSource(cashflowSettings.defaultStartingBalanceMode);
    setSafeMinimumBalance(cashflowSettings.minimumSafeBalance);
    setWarningBalance(cashflowSettings.warningBalance);
    setSelectedAccountIds(
      activeAccounts
        .filter(
          account =>
            cashflowSettings.includeOffBudgetAccounts || !account.offbudget,
        )
        .map(account => account.id),
    );
    didInitialize.current = true;
  }, [activeAccounts, settingsResult]);

  useEffect(() => {
    return listen('sync-event', event => {
      if (
        'tables' in event &&
        event.tables.some(table =>
          [
            'accounts',
            'categories',
            'transactions',
            'flow_settings',
            'flow_transaction_metadata',
            'flow_subscriptions',
            'flow_debts',
            'flow_cashflow_runs',
            'flow_cashflow_rows',
          ].includes(table),
        )
      ) {
        void queryClient.invalidateQueries({ queryKey: ['flow'] });
      }
    });
  }, [queryClient]);

  function handleGenerate() {
    const sourceWarnings = createSourceWarnings({
      settingsMode: settingsResult?.mode,
      startingCashSource,
      selectedMonth,
      currentMonth,
      hasSettingsError: Boolean(settingsQuery.error),
      hasSubscriptionsError: Boolean(subscriptionsQuery.error),
      hasDebtsError: Boolean(debtsQuery.error),
      hasTransactionsError: Boolean(transactionsQuery.error),
      hasMetadataError: Boolean(metadataQuery.error),
    });
    const nextCalculation = calculateFlowCashflow({
      month: selectedMonth,
      currentDate,
      startingCash: effectiveStartingCash,
      startingCashSource,
      selectedAccountIds,
      safeMinimumBalance,
      warningBalance,
      oneOff,
      transactions,
      transactionMetadata: metadata,
      settings,
      subscriptions,
      debts,
      sourceWarnings,
    });
    setCalculation(nextCalculation);
    setLoadedRunId(null);
    setStatus({ kind: 'generated' });
  }

  async function handleSave() {
    if (!calculation) {
      return;
    }

    try {
      const result = await saveFlowCashflowRun(
        calculation.run,
        calculation.rows,
      );
      setLoadedRunId(result.runId);
      setStatus({ kind: 'saved' });
      await runsQuery.refetch();
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Cashflow run save failed.'),
      });
    }
  }

  async function handleLoad() {
    if (!latestSavedRun) {
      return;
    }

    try {
      const rows = await getFlowCashflowRows(latestSavedRun.id);
      setCalculation(
        createCalculationFromSavedRun(latestSavedRun, rows, currentDate),
      );
      setStartingCashSource(latestSavedRun.startingCashSource);
      setManualStartingCash(latestSavedRun.startingCash);
      setSelectedAccountIds(latestSavedRun.selectedAccountIds);
      setSafeMinimumBalance(latestSavedRun.safeMinimumBalance);
      setWarningBalance(latestSavedRun.warningBalance);
      setOneOff({
        enabled: Boolean(
          latestSavedRun.oneOffAmount && latestSavedRun.oneOffDate,
        ),
        name: latestSavedRun.oneOffName ?? '',
        amount: latestSavedRun.oneOffAmount ?? 0,
        date: latestSavedRun.oneOffDate ?? selectedMonthDate,
      });
      setLoadedRunId(latestSavedRun.id);
      setStatus({ kind: 'loaded' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Cashflow run load failed.'),
      });
    }
  }

  async function handleDelete() {
    const run =
      savedRuns.find(item => item.id === loadedRunId) ?? latestSavedRun;
    if (!run) {
      return;
    }
    if (
      !window.confirm(
        t('Delete the saved cashflow snapshot for {{month}}?', {
          month: run.month,
        }),
      )
    ) {
      return;
    }

    try {
      await deleteFlowCashflowRun(run.id);
      if (loadedRunId === run.id) {
        setCalculation(null);
        setLoadedRunId(null);
      }
      setStatus({ kind: 'deleted' });
      await runsQuery.refetch();
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Cashflow run delete failed.'),
      });
    }
  }

  function handleMonthChange(date: string) {
    const month = monthUtils.monthFromDate(date);
    setSelectedMonth(month);
    setCalculation(null);
    setLoadedRunId(null);
    setStatus(null);
    setOneOff(current => ({
      ...current,
      date: month === currentMonth ? currentDate : `${month}-01`,
    }));
  }

  function toggleAccount(accountId: string) {
    setSelectedAccountIds(current =>
      current.includes(accountId)
        ? current.filter(id => id !== accountId)
        : [...current, accountId],
    );
    setCalculation(null);
  }

  const formatAmount = (amount: number) => format(amount, 'financial');
  const formatDisplayDate = (date: string) =>
    formatCashflowDate(date, dateFormat);

  return (
    <Page header={null}>
      <View
        style={{ maxWidth: 1180, minHeight: 'auto', gap: 16, paddingTop: 10 }}
      >
        <AnswerPanel
          calculation={calculation}
          savedRun={latestSavedRun}
          isBusy={isBusy}
          formatAmount={formatAmount}
          formatDate={formatDisplayDate}
          dateFormat={dateFormat}
          onGenerate={handleGenerate}
          onSave={handleSave}
          onLoad={handleLoad}
          onDelete={handleDelete}
        />

        {status && <StatusMessage status={status} />}

        <ControlsPanel
          selectedMonthDate={selectedMonthDate}
          dateFormat={dateFormat}
          startingCashSource={startingCashSource}
          manualStartingCash={manualStartingCash}
          actualStartingCash={actualStartingCash}
          safeMinimumBalance={safeMinimumBalance}
          warningBalance={warningBalance}
          accounts={activeAccounts}
          selectedAccountIds={selectedAccountIds}
          oneOff={oneOff}
          onMonthChange={handleMonthChange}
          onStartingCashSourceChange={value => {
            setStartingCashSource(value);
            setCalculation(null);
          }}
          onManualStartingCashChange={value => {
            setManualStartingCash(value);
            setCalculation(null);
          }}
          onSafeMinimumBalanceChange={value => {
            setSafeMinimumBalance(Math.max(0, value));
            setCalculation(null);
          }}
          onWarningBalanceChange={value => {
            setWarningBalance(Math.max(0, value));
            setCalculation(null);
          }}
          onToggleAccount={toggleAccount}
          onOneOffChange={value => {
            setOneOff(value);
            setCalculation(null);
          }}
          formatAmount={formatAmount}
        />

        {calculation ? (
          <>
            <SummaryCards
              summary={calculation.summary}
              formatAmount={formatAmount}
            />
            {calculation.warnings.length > 0 && (
              <WarningsPanel
                warnings={calculation.warnings}
                open={calculation.run.status !== 'generated'}
              />
            )}
            <CashflowTable
              rows={calculation.rows}
              accountNames={accountNames}
              categoryNames={categoryNames}
              formatAmount={formatAmount}
              formatDate={formatDisplayDate}
            />
          </>
        ) : (
          <InfoPanel>
            <Trans>
              Configure the month and starting cash, then generate the monthly
              projection. No Actual transaction will be created or changed.
            </Trans>
          </InfoPanel>
        )}
      </View>
    </Page>
  );
}

function AnswerPanel({
  calculation,
  savedRun,
  isBusy,
  formatAmount,
  formatDate,
  dateFormat,
  onGenerate,
  onSave,
  onLoad,
  onDelete,
}: {
  calculation: FlowCashflowCalculation | null;
  savedRun: FlowCashflowRun | undefined;
  isBusy: boolean;
  formatAmount: (amount: number) => string;
  formatDate: (date: string) => string;
  dateFormat: string;
  onGenerate: () => void;
  onSave: () => void;
  onLoad: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const result = getAnswer(calculation, t, formatDate);
  const answerColor =
    result.tone === 'danger'
      ? theme.errorText
      : result.tone === 'warning'
        ? theme.warningText
        : result.tone === 'safe'
          ? theme.budgetNumberPositive
          : theme.pageTextSubdued;

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
        <View style={{ gap: 5, maxWidth: 650 }}>
          <Text style={{ fontSize: 20, fontWeight: 650 }}>
            <Trans>Monthly Cashflow Planner</Trans>
          </Text>
          <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
            <Trans>
              Project this month's money movement and see whether you can reach
              the next income date safely.
            </Trans>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" isDisabled={isBusy} onPress={onGenerate}>
            <Trans>Generate</Trans>
          </Button>
          <Button variant="normal" isDisabled={!calculation} onPress={onSave}>
            <Trans>Save run</Trans>
          </Button>
          <Button variant="normal" isDisabled={!savedRun} onPress={onLoad}>
            <Trans>Load saved</Trans>
          </Button>
          <Button variant="normal" isDisabled={!savedRun} onPress={onDelete}>
            <Trans>Delete saved</Trans>
          </Button>
        </View>
      </View>

      <View style={{ gap: 5 }}>
        <Text style={{ color: answerColor, fontSize: 24, fontWeight: 700 }}>
          {result.label}
        </Text>
        <Text style={{ color: answerColor }}>{result.message}</Text>
        {calculation?.run.generatedAt && (
          <Text style={{ color: theme.noticeTextLight, fontSize: 12 }}>
            {t('Calculated {{timestamp}}', {
              timestamp: formatTimestamp(
                calculation.run.generatedAt,
                dateFormat,
              ),
            })}
          </Text>
        )}
      </View>

      <View style={summaryGridStyle}>
        <AnswerMetric
          label={t('Projected end balance')}
          value={
            calculation
              ? formatAmount(calculation.summary.projectedEndBalance)
              : '-'
          }
          financial={Boolean(calculation)}
        />
        <AnswerMetric
          label={t('Lowest projected balance')}
          value={
            calculation ? formatAmount(calculation.summary.lowestBalance) : '-'
          }
          financial={Boolean(calculation)}
        />
        <AnswerMetric
          label={t('First failure date')}
          value={
            calculation?.summary.firstFailureDate
              ? formatDate(calculation.summary.firstFailureDate)
              : t('None')
          }
        />
        <AnswerMetric
          label={t('Next income date')}
          value={
            calculation?.nextIncomeDate
              ? formatDate(calculation.nextIncomeDate)
              : t('Not found')
          }
        />
      </View>
    </View>
  );
}

function ControlsPanel({
  selectedMonthDate,
  dateFormat,
  startingCashSource,
  manualStartingCash,
  actualStartingCash,
  safeMinimumBalance,
  warningBalance,
  accounts,
  selectedAccountIds,
  oneOff,
  onMonthChange,
  onStartingCashSourceChange,
  onManualStartingCashChange,
  onSafeMinimumBalanceChange,
  onWarningBalanceChange,
  onToggleAccount,
  onOneOffChange,
  formatAmount,
}: {
  selectedMonthDate: string;
  dateFormat: string;
  startingCashSource: FlowCashflowStartingCashSource;
  manualStartingCash: number;
  actualStartingCash: number;
  safeMinimumBalance: number;
  warningBalance: number;
  accounts: AccountEntity[];
  selectedAccountIds: string[];
  oneOff: FlowCashflowOneOff;
  onMonthChange: (date: string) => void;
  onStartingCashSourceChange: (source: FlowCashflowStartingCashSource) => void;
  onManualStartingCashChange: (amount: number) => void;
  onSafeMinimumBalanceChange: (amount: number) => void;
  onWarningBalanceChange: (amount: number) => void;
  onToggleAccount: (accountId: string) => void;
  onOneOffChange: (oneOff: FlowCashflowOneOff) => void;
  formatAmount: (amount: number) => string;
}) {
  const { t } = useTranslation();
  const help = getControlHelp(t);
  const sourceOptions: Array<SelectOption<FlowCashflowStartingCashSource>> = [
    ['manual', t('Manual')],
    ['actual-accounts', t('Actual accounts')],
  ];

  return (
    <View style={panelStyle}>
      <Text style={{ fontSize: 17, fontWeight: 600 }}>
        <Trans>Projection settings</Trans>
      </Text>
      <View style={controlsGridStyle}>
        <Field label={t('Month')} help={help.month}>
          <DateSelect
            value={selectedMonthDate}
            dateFormat={dateFormat}
            onSelect={onMonthChange}
            inputProps={{ style: fullWidthInputStyle }}
          />
        </Field>
        <Field label={t('Starting cash source')} help={help.startingSource}>
          <Select
            options={sourceOptions}
            value={startingCashSource}
            onChange={onStartingCashSourceChange}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Starting cash')} help={help.startingCash}>
          {startingCashSource === 'manual' ? (
            <FinancialInput
              value={manualStartingCash}
              onUpdate={onManualStartingCashChange}
              style={fullWidthInputStyle}
            />
          ) : (
            <FinancialText
              style={{ ...styles.tnum, padding: '7px 0', fontWeight: 600 }}
            >
              {formatAmount(actualStartingCash)}
            </FinancialText>
          )}
        </Field>
        <Field label={t('Safe minimum balance')} help={help.safeMinimum}>
          <FinancialInput
            value={safeMinimumBalance}
            onUpdate={onSafeMinimumBalanceChange}
            style={fullWidthInputStyle}
          />
        </Field>
        <Field label={t('Warning balance')} help={help.warningBalance}>
          <FinancialInput
            value={warningBalance}
            onUpdate={onWarningBalanceChange}
            style={fullWidthInputStyle}
          />
        </Field>
      </View>

      <details style={detailsStyle}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          {t('Included accounts ({{selected}} of {{total}})', {
            selected: selectedAccountIds.length,
            total: accounts.length,
          })}
        </summary>
        <View
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))',
            gap: 8,
            paddingTop: 12,
          }}
        >
          {accounts.map(account => (
            <label
              key={account.id}
              style={{ display: 'flex', alignItems: 'center', gap: 8 }}
            >
              <input
                type="checkbox"
                checked={selectedAccountIds.includes(account.id)}
                onChange={() => onToggleAccount(account.id)}
              />
              <span>{account.name}</span>
            </label>
          ))}
        </View>
      </details>

      <View style={{ gap: 10 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={oneOff.enabled}
            onChange={event =>
              onOneOffChange({
                ...oneOff,
                enabled: event.currentTarget.checked,
              })
            }
          />
          <span style={{ fontWeight: 600 }}>
            <Trans>Test a one-off cost</Trans>
          </span>
          <HelpTooltip content={help.oneOff} />
        </label>
        {oneOff.enabled && (
          <View style={controlsGridStyle}>
            <Field label={t('Purchase name')}>
              <Input
                value={oneOff.name}
                onChangeValue={value =>
                  onOneOffChange({ ...oneOff, name: value })
                }
                style={fullWidthInputStyle}
              />
            </Field>
            <Field label={t('Amount')}>
              <FinancialInput
                value={oneOff.amount}
                onUpdate={value =>
                  onOneOffChange({ ...oneOff, amount: Math.max(0, value) })
                }
                style={fullWidthInputStyle}
              />
            </Field>
            <Field label={t('Purchase date')}>
              <DateSelect
                value={oneOff.date}
                dateFormat={dateFormat}
                onSelect={value => onOneOffChange({ ...oneOff, date: value })}
                inputProps={{ style: fullWidthInputStyle }}
              />
            </Field>
          </View>
        )}
      </View>
    </View>
  );
}

function SummaryCards({
  summary,
  formatAmount,
}: {
  summary: FlowCashflowSummary;
  formatAmount: (amount: number) => string;
}) {
  const { t } = useTranslation();
  const cards = [
    [t('Actual income'), summary.actualIncome, 'positive'],
    [t('Actual expenses'), summary.actualExpenses, 'negative'],
    [t('Planned income'), summary.plannedIncome, 'positive'],
    [t('Planned outflows'), summary.plannedOutflows, 'negative'],
    [t('Variable forecast'), summary.variableForecast, 'normal'],
    [t('Debt payments'), summary.debtPayments, 'normal'],
    [t('Subscriptions'), summary.subscriptions, 'normal'],
    [t('One-off test'), summary.oneOff, 'normal'],
    [t('Projected end balance'), summary.projectedEndBalance, 'normal'],
  ] as const;

  return (
    <View style={summaryGridStyle}>
      {cards.map(([label, value, tone]) => (
        <View key={label} style={summaryCardStyle}>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            {label}
          </Text>
          <FinancialText
            style={{
              ...styles.tnum,
              color:
                tone === 'positive'
                  ? theme.budgetNumberPositive
                  : tone === 'negative'
                    ? theme.budgetNumberNegative
                    : theme.pageText,
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            {formatAmount(value)}
          </FinancialText>
        </View>
      ))}
    </View>
  );
}

function WarningsPanel({
  warnings,
  open,
}: {
  warnings: string[];
  open: boolean;
}) {
  const { t } = useTranslation();
  return (
    <details open={open} style={detailsStyle}>
      <summary
        style={{ cursor: 'pointer', color: theme.warningText, fontWeight: 600 }}
      >
        {t('{{count}} cashflow warning(s)', { count: warnings.length })}
      </summary>
      <View style={{ gap: 7, paddingTop: 12 }}>
        {warnings.map((warning, index) => (
          <Text
            key={`${warning}-${index}`}
            style={{ color: theme.warningText }}
          >
            {warning}
          </Text>
        ))}
      </View>
    </details>
  );
}

function AnswerMetric({
  label,
  value,
  financial,
}: {
  label: string;
  value: string;
  financial?: boolean;
}) {
  return (
    <View style={summaryCardStyle}>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        {label}
      </Text>
      {financial ? (
        <FinancialText
          style={{ ...styles.tnum, fontSize: 18, fontWeight: 600 }}
        >
          {value}
        </FinancialText>
      ) : (
        <Text style={{ fontSize: 18, fontWeight: 600 }}>{value}</Text>
      )}
    </View>
  );
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 5, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          {label}
        </Text>
        {help && <HelpTooltip content={help} />}
      </View>
      {children}
    </View>
  );
}

function HelpTooltip({ content }: { content: string }) {
  const { t } = useTranslation();
  return (
    <Tooltip
      content={
        <Text
          style={{ color: theme.pageTextLight, lineHeight: 1.5, maxWidth: 340 }}
        >
          {content}
        </Text>
      }
      placement="top start"
    >
      <SvgInformationCircle
        width={12}
        height={12}
        aria-label={t('Field help')}
        style={{ color: theme.pageTextSubdued, cursor: 'help' }}
      />
    </Tooltip>
  );
}

function InfoPanel({ children }: { children: ReactNode }) {
  return (
    <View
      style={{
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 8,
        backgroundColor: theme.tableBackground,
        padding: 14,
      }}
    >
      <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
        {children}
      </Text>
    </View>
  );
}

function StatusMessage({ status }: { status: StatusState }) {
  const { t } = useTranslation();
  if (status.kind === 'error') {
    return <Text style={{ color: theme.errorText }}>{status.message}</Text>;
  }
  const message =
    status.kind === 'saved'
      ? t('Cashflow snapshot saved.')
      : status.kind === 'loaded'
        ? t('Saved cashflow snapshot loaded.')
        : status.kind === 'deleted'
          ? t('Saved cashflow snapshot deleted.')
          : t('Cashflow calculated.');
  return (
    <Text style={{ color: theme.noticeTextLight, fontWeight: 600 }}>
      {message}
    </Text>
  );
}

function getAnswer(
  calculation: FlowCashflowCalculation | null,
  t: (key: string, options?: Record<string, unknown>) => string,
  formatDisplayDate: (date: string) => string,
): {
  tone: 'draft' | 'safe' | 'warning' | 'danger';
  label: string;
  message: string;
} {
  if (!calculation) {
    return {
      tone: 'draft',
      label: t('Ready to calculate'),
      message: t('Generate a projection to see whether this month is safe.'),
    };
  }
  if (calculation.run.status === 'danger') {
    return {
      tone: 'danger',
      label: t('Danger'),
      message: calculation.run.firstFailureDate
        ? t('Balance falls below the safety threshold on {{date}}.', {
            date: formatDisplayDate(calculation.run.firstFailureDate),
          })
        : t('The projected balance falls below the safety threshold.'),
    };
  }
  if (calculation.run.status === 'warning') {
    return {
      tone: 'warning',
      label: t('Warning'),
      message: t('The lowest balance is below your warning level.'),
    };
  }
  return {
    tone: 'safe',
    label: t('Safe'),
    message: t('Projected balance stays above the configured safety levels.'),
  };
}

function createSourceWarnings({
  settingsMode,
  startingCashSource,
  selectedMonth,
  currentMonth,
  hasSettingsError,
  hasSubscriptionsError,
  hasDebtsError,
  hasTransactionsError,
  hasMetadataError,
}: {
  settingsMode: string | undefined;
  startingCashSource: FlowCashflowStartingCashSource;
  selectedMonth: string;
  currentMonth: string;
  hasSettingsError: boolean;
  hasSubscriptionsError: boolean;
  hasDebtsError: boolean;
  hasTransactionsError: boolean;
  hasMetadataError: boolean;
}): string[] {
  const warnings = [
    'Actual schedules are not projected in TASK012; Flow Settings plans and confirmed Flow records are used.',
  ];
  if (settingsMode === 'local-backup') {
    warnings.push(
      'Flow Settings loaded from browser backup instead of the budget database.',
    );
  }
  if (startingCashSource === 'actual-accounts') {
    warnings.push(
      selectedMonth === currentMonth
        ? 'Actual-account starting cash is derived from current balances minus included month transactions.'
        : 'Actual-account starting cash uses current balances and is not an exact historical opening balance.',
    );
  }
  if (hasSettingsError) {
    warnings.push('Flow Settings could not be loaded.');
  }
  if (hasSubscriptionsError) {
    warnings.push('Flow subscriptions could not be loaded.');
  }
  if (hasDebtsError) {
    warnings.push('Flow debts could not be loaded.');
  }
  if (hasTransactionsError) {
    warnings.push('Actual transactions could not be loaded.');
  }
  if (hasMetadataError) {
    warnings.push('Flow transaction metadata could not be loaded.');
  }
  return warnings;
}

function getControlHelp(t: (key: string) => string) {
  return {
    month: t('Month covered from its first day through its last day.'),
    startingSource: t(
      'Manual uses a confirmed opening cash amount. Actual accounts derives an approximate opening amount from selected account balances.',
    ),
    startingCash: t(
      'Cash available at the start of the selected month before listed rows are applied.',
    ),
    safeMinimum: t(
      'Falling below this level marks the run as Danger, even if the balance remains positive.',
    ),
    warningBalance: t(
      'Falling below this level marks the run as Warning when the safe minimum is not breached.',
    ),
    oneOff: t(
      'Adds a test-only planned expense to answer whether a purchase is safe. It never creates an Actual transaction.',
    ),
  };
}

function formatCashflowDate(date: string, dateFormat: string): string {
  const parsed = parseISO(date);
  return isValid(parsed) ? formatDate(parsed, dateFormat) : date;
}

function formatTimestamp(timestamp: string, dateFormat: string): string {
  const parsed = parseISO(timestamp);
  return isValid(parsed)
    ? formatDate(parsed, `${dateFormat} HH:mm:ss`)
    : timestamp;
}
