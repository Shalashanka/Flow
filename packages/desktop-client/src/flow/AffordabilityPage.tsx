import { useEffect, useMemo, useState } from 'react';
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
import { useFormat } from '#hooks/useFormat';

import {
  getFlowAccountBalances,
  getFlowCashflowTransactions,
} from './actual-adapter';
import { calculateFlowAffordability } from './affordability/calculate';
import {
  deleteFlowAffordabilityCheck,
  getFlowAffordabilityChecks,
  saveFlowAffordabilityCheck,
} from './affordability/storage';
import {
  answerGridStyle,
  detailsStyle,
  formGridStyle,
  fullWidthStyle,
  metricStyle,
  panelStyle,
  selectStyle,
  tableCellStyle,
  tableHeaderStyle,
  tableStyle,
} from './affordability/styles';
import type {
  FlowAffordabilityCalculation,
  FlowAffordabilityCheck,
  FlowAffordabilityDecision,
  FlowAffordabilityPriority,
  FlowAffordabilitySharedStatus,
  FlowAffordabilitySplitMethod,
} from './affordability/types';
import {
  calculateFlowCashflow,
  createCalculationFromSavedRun,
} from './cashflow/calculate';
import { getFlowCashflowRows, getFlowCashflowRuns } from './cashflow/storage';
import type { FlowCashflowCalculation } from './cashflow/types';
import { getFlowDebts } from './debts/storage';
import { createDefaultFlowSettings } from './planning/defaults';
import { loadFlowSettings } from './planning/storage';
import type { FlowHouseholdMember } from './planning/types';
import { getFlowSubscriptions } from './subscriptions/storage';
import { getFlowTransactionMetadataMany } from './transaction-metadata/storage';

const DATE_FORMAT = 'dd/MM/yyyy';
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
const emptyChecks: FlowAffordabilityCheck[] = [];
const defaultSettings = createDefaultFlowSettings();

type ProjectionMode = 'saved' | 'fresh';

type StatusState =
  | { kind: 'calculated' | 'saved' | 'loaded' | 'deleted' }
  | { kind: 'error'; message: string };

export function AffordabilityPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const queryClient = useQueryClient();
  const currentDate = formatDate(new Date(), 'yyyy-MM-dd');
  const currentMonth = currentDate.slice(0, 7);
  const [draft, setDraft] = useState(() => createDraft(currentDate));
  const [projectionMode, setProjectionMode] = useState<ProjectionMode>('saved');
  const [calculation, setCalculation] =
    useState<FlowAffordabilityCalculation | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const selectedMonth = /^\d{4}-\d{2}-\d{2}$/.test(draft.plannedDate)
    ? draft.plannedDate.slice(0, 7)
    : currentMonth;
  const monthRange = useMemo(
    () => ({
      start: monthUtils.firstDayOfMonth(selectedMonth),
      end: monthUtils.lastDayOfMonth(selectedMonth),
    }),
    [selectedMonth],
  );

  const settingsQuery = useQuery({
    queryKey: ['flow', 'settings', 'affordability'],
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
    queryKey: ['flow', 'affordability', 'transactions', monthRange],
    queryFn: () => getFlowCashflowTransactions(monthRange),
  });
  const activeAccountIds = useMemo(
    () =>
      (accountsQuery.data ?? emptyAccounts)
        .filter(account => !account.tombstone && !account.closed)
        .map(account => account.id),
    [accountsQuery.data],
  );
  const accountBalancesQuery = useQuery({
    queryKey: ['flow', 'affordability', 'account-balances', activeAccountIds],
    queryFn: () => getFlowAccountBalances(activeAccountIds, currentDate),
    enabled: activeAccountIds.length > 0,
    placeholderData: {},
  });
  const transactionIds = useMemo(
    () =>
      (transactionsQuery.data ?? emptyTransactions).map(
        transaction => transaction.id,
      ),
    [transactionsQuery.data],
  );
  const metadataQuery = useQuery({
    queryKey: ['flow', 'affordability', 'transaction-metadata', transactionIds],
    queryFn: () => getFlowTransactionMetadataMany(transactionIds),
    enabled: transactionIds.length > 0,
    placeholderData: emptyMetadata,
  });
  const runsQuery = useQuery({
    queryKey: ['flow', 'cashflow-runs', selectedMonth],
    queryFn: () => getFlowCashflowRuns(selectedMonth),
  });
  const checksQuery = useQuery({
    queryKey: ['flow', 'affordability-checks', selectedMonth],
    queryFn: () => getFlowAffordabilityChecks(selectedMonth),
  });

  const settingsResult = settingsQuery.data;
  const settings = settingsResult?.settings ?? defaultSettings;
  const accounts = accountsQuery.data ?? emptyAccounts;
  const categories = categoriesQuery.data?.list ?? emptyCategories;
  const transactions = transactionsQuery.data ?? emptyTransactions;
  const metadata = metadataQuery.data ?? emptyMetadata;
  const subscriptions = subscriptionsQuery.data ?? emptySubscriptions;
  const debts = debtsQuery.data ?? emptyDebts;
  const accountBalances = accountBalancesQuery.data ?? {};
  const savedChecks = checksQuery.data ?? emptyChecks;
  const latestSavedRun = runsQuery.data?.[0];
  const activeAccounts = useMemo(
    () => accounts.filter(account => !account.tombstone && !account.closed),
    [accounts],
  );
  const expenseCategories = useMemo(
    () =>
      categories.filter(
        category =>
          !category.tombstone && !category.hidden && !category.is_income,
      ),
    [categories],
  );
  const activeMembers = useMemo(
    () => settings.householdMembers.filter(member => member.active),
    [settings.householdMembers],
  );
  const selectedAccountBalance = draft.accountId
    ? accountBalances[draft.accountId]
    : undefined;
  const isLoading =
    settingsQuery.isLoading ||
    accountsQuery.isLoading ||
    categoriesQuery.isLoading ||
    subscriptionsQuery.isLoading ||
    debtsQuery.isLoading ||
    transactionsQuery.isLoading ||
    accountBalancesQuery.isLoading ||
    metadataQuery.isLoading ||
    runsQuery.isLoading ||
    checksQuery.isLoading;

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
            'flow_affordability_checks',
          ].includes(table),
        )
      ) {
        void queryClient.invalidateQueries({ queryKey: ['flow'] });
      }
    });
  }, [queryClient]);

  function updateDraft(update: Partial<FlowAffordabilityCheck>) {
    setDraft(current => ({ ...current, ...update }));
    setCalculation(null);
    setStatus(null);
  }

  async function handleCalculate() {
    setIsCalculating(true);
    setStatus(null);

    try {
      const sourceWarnings: string[] = [];
      let baseCalculation: FlowCashflowCalculation | undefined;
      let cashflowSource: FlowAffordabilityCalculation['cashflowSource'] =
        'unavailable';

      if (projectionMode === 'saved' && latestSavedRun) {
        const rows = await getFlowCashflowRows(latestSavedRun.id);
        if (rows.length > 0) {
          baseCalculation = createCalculationFromSavedRun(
            latestSavedRun,
            rows,
            currentDate,
          );
          cashflowSource = 'saved';
          sourceWarnings.push(
            ...getSavedRunWarnings(latestSavedRun.generatedAt),
          );
        } else {
          sourceWarnings.push('The saved cashflow snapshot has no rows.');
        }
      } else if (projectionMode === 'saved') {
        sourceWarnings.push(
          'No saved cashflow snapshot exists, so Flow generated a fresh projection.',
        );
      }

      if (!baseCalculation) {
        const freshResult = buildFreshProjection();
        baseCalculation = freshResult.calculation;
        sourceWarnings.push(...freshResult.warnings);
        if (baseCalculation) {
          cashflowSource = 'fresh';
        }
      }

      const nextCalculation = calculateFlowAffordability({
        check: draft,
        baseCalculation,
        cashflowSource,
        currentDate,
        activeHouseholdMemberCount: activeMembers.length,
        accountBalance: selectedAccountBalance ?? undefined,
      });
      nextCalculation.warnings = [
        ...new Set([
          ...nextCalculation.warnings,
          ...(baseCalculation?.warnings ?? []),
          ...sourceWarnings,
        ]),
      ];
      setDraft(nextCalculation.check);
      setCalculation(nextCalculation);
      setStatus({ kind: 'calculated' });
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Affordability calculation failed.'),
      });
    } finally {
      setIsCalculating(false);
    }
  }

  function buildFreshProjection(): {
    calculation?: FlowCashflowCalculation;
    warnings: string[];
  } {
    const warnings: string[] = [];

    if (
      settingsQuery.error ||
      accountsQuery.error ||
      accountBalancesQuery.error ||
      categoriesQuery.error ||
      transactionsQuery.error
    ) {
      warnings.push(
        'Required Actual or Flow source data failed to load, so a reliable projection could not be generated.',
      );
      return { warnings };
    }

    const selectedAccountIds = latestSavedRun
      ? latestSavedRun.selectedAccountIds
      : activeAccounts
          .filter(
            account =>
              settings.cashflowSettings.includeOffBudgetAccounts ||
              !account.offbudget,
          )
          .map(account => account.id);
    const startingCashSource =
      latestSavedRun?.startingCashSource ??
      settings.cashflowSettings.defaultStartingBalanceMode;

    if (startingCashSource === 'manual' && !latestSavedRun) {
      warnings.push(
        'Starting cash is configured as manual, but no saved cashflow run provides a confirmed amount.',
      );
      return { warnings };
    }

    const startingCash =
      startingCashSource === 'manual'
        ? (latestSavedRun?.startingCash ?? 0)
        : deriveActualStartingCash({
            accountBalances,
            transactions,
            metadata,
            selectedAccountIds,
            selectedMonth,
            currentMonth,
          });

    if (startingCashSource === 'actual-accounts') {
      warnings.push(
        selectedMonth === currentMonth
          ? 'Starting cash is derived from current balances minus included transactions already posted this month.'
          : 'Starting cash uses current account balances and is only an estimate for this future month.',
      );
    }
    if (settingsResult?.mode === 'local-backup') {
      warnings.push(
        'Flow Settings came from the browser backup instead of the Flow database.',
      );
    }
    if (subscriptionsQuery.error) {
      warnings.push('Flow subscriptions could not be loaded.');
    }
    if (debtsQuery.error) {
      warnings.push('Flow debts could not be loaded.');
    }
    if (metadataQuery.error) {
      warnings.push('Flow transaction metadata could not be loaded.');
    }

    return {
      calculation: calculateFlowCashflow({
        month: selectedMonth,
        currentDate,
        startingCash,
        startingCashSource,
        selectedAccountIds,
        safeMinimumBalance:
          latestSavedRun?.safeMinimumBalance ??
          settings.cashflowSettings.minimumSafeBalance,
        warningBalance:
          latestSavedRun?.warningBalance ??
          settings.cashflowSettings.warningBalance,
        oneOff: {
          enabled: false,
          name: '',
          amount: 0,
          date: draft.plannedDate,
        },
        transactions,
        transactionMetadata: metadata,
        settings,
        subscriptions,
        debts,
        sourceWarnings: warnings,
      }),
      warnings,
    };
  }

  async function handleSave() {
    if (!calculation) {
      return;
    }

    try {
      const savedCheck = await saveFlowAffordabilityCheck(calculation.check);
      setDraft(savedCheck);
      setCalculation({ ...calculation, check: savedCheck });
      setStatus({ kind: 'saved' });
      await checksQuery.refetch();
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Affordability check save failed.'),
      });
    }
  }

  function handleLoad(check: FlowAffordabilityCheck) {
    const accountBalance = check.accountId
      ? accountBalances[check.accountId]
      : undefined;
    setDraft(check);
    setCalculation({
      check,
      warnings: [],
      simulatedRows: [],
      personalShare: estimatePersonalShare(check, activeMembers.length),
      accountBalanceBefore: accountBalance,
      accountBalanceAfter:
        accountBalance == null ? undefined : accountBalance - check.amount,
      cashflowSource: check.cashflowRunId ? 'saved' : 'unavailable',
    });
    setStatus({ kind: 'loaded' });
  }

  async function handleDelete(check: FlowAffordabilityCheck) {
    if (
      !window.confirm(
        t('Delete the saved affordability check for {{name}}?', {
          name: check.purchaseName,
        }),
      )
    ) {
      return;
    }

    try {
      await deleteFlowAffordabilityCheck(check.id);
      if (draft.id === check.id) {
        setDraft(createDraft(currentDate));
        setCalculation(null);
      }
      setStatus({ kind: 'deleted' });
      await checksQuery.refetch();
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Affordability check delete failed.'),
      });
    }
  }

  function handleNew() {
    setDraft(createDraft(currentDate));
    setCalculation(null);
    setStatus(null);
  }

  const formatAmount = (amount: number) => format(amount, 'financial');
  const formatDisplayDate = (date: string) => formatIsoDate(date);

  return (
    <Page header={null}>
      <View
        style={{ maxWidth: 1180, minHeight: 'auto', gap: 16, paddingTop: 10 }}
      >
        <AnswerPanel
          calculation={calculation}
          isBusy={isLoading || isCalculating}
          canSave={Boolean(calculation)}
          formatAmount={formatAmount}
          formatDisplayDate={formatDisplayDate}
          onCalculate={handleCalculate}
          onSave={handleSave}
        />

        {status && <StatusMessage status={status} />}
        {(checksQuery.error || runsQuery.error) && (
          <Text style={{ color: theme.errorText }}>
            <Trans>
              Saved Flow data could not be loaded. Calculation can continue, but
              saving and saved snapshots may be unavailable.
            </Trans>
          </Text>
        )}

        <PurchaseForm
          draft={draft}
          projectionMode={projectionMode}
          hasSavedRun={Boolean(latestSavedRun)}
          accounts={activeAccounts}
          categories={expenseCategories}
          members={activeMembers}
          onUpdate={updateDraft}
          onProjectionModeChange={value => {
            setProjectionMode(value);
            setCalculation(null);
            setStatus(null);
          }}
        />

        {calculation && (
          <>
            <ImpactCards
              calculation={calculation}
              isShared={draft.sharedStatus === 'shared'}
              formatAmount={formatAmount}
              formatDisplayDate={formatDisplayDate}
            />
            {calculation.warnings.length > 0 && (
              <Warnings warnings={calculation.warnings} />
            )}
            {calculation.simulatedRows.length > 0 && (
              <SimulationPreview
                calculation={calculation}
                formatAmount={formatAmount}
                formatDisplayDate={formatDisplayDate}
              />
            )}
          </>
        )}

        <SavedChecks
          checks={savedChecks}
          formatAmount={formatAmount}
          formatDisplayDate={formatDisplayDate}
          onNew={handleNew}
          onLoad={handleLoad}
          onDelete={handleDelete}
        />
      </View>
    </Page>
  );
}

function AnswerPanel({
  calculation,
  isBusy,
  canSave,
  formatAmount,
  formatDisplayDate,
  onCalculate,
  onSave,
}: {
  calculation: FlowAffordabilityCalculation | null;
  isBusy: boolean;
  canSave: boolean;
  formatAmount: (amount: number) => string;
  formatDisplayDate: (date: string) => string;
  onCalculate: () => void;
  onSave: () => void;
}) {
  const { t } = useTranslation();
  const decision = calculation?.check.decision ?? 'check';
  const answer = getDecisionAnswer(decision, Boolean(calculation), t);
  const color = decisionColor(decision);

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
        <View style={{ gap: 5, maxWidth: 690 }}>
          <Text style={{ fontSize: 20, fontWeight: 650 }}>
            <Trans>Affordability Calculator</Trans>
          </Text>
          <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
            <Trans>
              Test a planned purchase against your cashflow, safety balance, and
              household rules.
            </Trans>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="primary" isDisabled={isBusy} onPress={onCalculate}>
            <Trans>Calculate</Trans>
          </Button>
          <Button variant="normal" isDisabled={!canSave} onPress={onSave}>
            <Trans>Save check</Trans>
          </Button>
        </View>
      </View>

      <View style={{ gap: 6 }}>
        <Text style={{ color, fontSize: 24, fontWeight: 700 }}>{answer}</Text>
        <Text style={{ color, lineHeight: 1.45 }}>
          {calculation?.check.reason ??
            t('Enter the purchase details and calculate to get an answer.')}
        </Text>
        {calculation?.check.recommendedAction && (
          <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.45 }}>
            {calculation.check.recommendedAction}
          </Text>
        )}
      </View>

      <View style={answerGridStyle}>
        <Metric
          label={t('Purchase amount')}
          value={calculation ? formatAmount(calculation.check.amount) : '-'}
          financial={Boolean(calculation)}
        />
        <Metric
          label={t('Projected month end after')}
          value={
            calculation ? formatAmount(calculation.check.balanceAfter) : '-'
          }
          financial={Boolean(calculation)}
        />
        <Metric
          label={t('Lowest balance after')}
          value={
            calculation
              ? formatAmount(calculation.check.lowestBalanceAfter)
              : '-'
          }
          financial={Boolean(calculation)}
        />
        <Metric
          label={t('First failure date')}
          value={
            calculation?.check.firstFailureDate
              ? formatDisplayDate(calculation.check.firstFailureDate)
              : t('None')
          }
        />
      </View>
    </View>
  );
}

function PurchaseForm({
  draft,
  projectionMode,
  hasSavedRun,
  accounts,
  categories,
  members,
  onUpdate,
  onProjectionModeChange,
}: {
  draft: FlowAffordabilityCheck;
  projectionMode: ProjectionMode;
  hasSavedRun: boolean;
  accounts: AccountEntity[];
  categories: CategoryEntity[];
  members: FlowHouseholdMember[];
  onUpdate: (update: Partial<FlowAffordabilityCheck>) => void;
  onProjectionModeChange: (mode: ProjectionMode) => void;
}) {
  const { t } = useTranslation();
  const accountOptions: Array<SelectOption<string>> = [
    ['', t('Select account')],
    ...accounts.map(
      account => [account.id, account.name] satisfies SelectOption<string>,
    ),
  ];
  const categoryOptions: Array<SelectOption<string>> = [
    ['', t('Select category')],
    ...categories.map(
      category => [category.id, category.name] satisfies SelectOption<string>,
    ),
  ];
  const memberOptions: Array<SelectOption<string>> = [
    ['', t('No household member')],
    ...members.map(
      member => [member.id, member.name] satisfies SelectOption<string>,
    ),
  ];
  const sharedOptions: Array<SelectOption<FlowAffordabilitySharedStatus>> = [
    ['personal', t('Personal')],
    ['shared', t('Shared')],
    ['ignored', t('Ignored for household split')],
  ];
  const splitOptions: Array<SelectOption<FlowAffordabilitySplitMethod>> = [
    ['none', t('No split')],
    ['equal', t('Equal')],
    ['percentage', t('Percentage')],
    ['fixed-amount', t('Fixed amount')],
    ['custom', t('Custom')],
  ];
  const priorityOptions: Array<SelectOption<FlowAffordabilityPriority>> = [
    ['low', t('Low')],
    ['normal', t('Normal')],
    ['high', t('High')],
    ['urgent', t('Urgent')],
  ];
  const projectionOptions: Array<SelectOption<ProjectionMode>> = [
    [
      'saved',
      hasSavedRun
        ? t('Saved cashflow snapshot')
        : t('Saved snapshot (fresh fallback)'),
    ],
    ['fresh', t('Fresh projection')],
  ];
  const help = getFieldHelp(t);

  return (
    <View style={panelStyle}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 17, fontWeight: 600 }}>
          <Trans>Purchase details</Trans>
        </Text>
        <Text style={{ color: theme.pageTextSubdued }}>
          <Trans>
            This is a simulation only. Flow will not create or edit an Actual
            transaction.
          </Trans>
        </Text>
      </View>

      <View style={formGridStyle}>
        <Field label={t('Purchase name')} help={help.purchaseName}>
          <Input
            value={draft.purchaseName}
            onChangeValue={value => onUpdate({ purchaseName: value })}
            style={fullWidthStyle}
          />
        </Field>
        <Field label={t('Amount')} help={help.amount}>
          <FinancialInput
            value={draft.amount}
            onUpdate={value => onUpdate({ amount: Math.max(0, value) })}
            style={fullWidthStyle}
          />
        </Field>
        <Field label={t('Planned date')} help={help.plannedDate}>
          <DateSelect
            value={draft.plannedDate}
            dateFormat={DATE_FORMAT}
            onSelect={value =>
              onUpdate({
                plannedDate: value,
                monthChecked: value.slice(0, 7),
              })
            }
            inputProps={{ style: fullWidthStyle }}
          />
        </Field>
        <Field label={t('Cashflow source')} help={help.cashflowSource}>
          <Select
            options={projectionOptions}
            value={projectionMode}
            onChange={onProjectionModeChange}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Account')} help={help.account}>
          <Select
            options={accountOptions}
            value={draft.accountId ?? ''}
            onChange={value => onUpdate({ accountId: value || undefined })}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Category')} help={help.category}>
          <Select
            options={categoryOptions}
            value={draft.categoryId ?? ''}
            onChange={value => onUpdate({ categoryId: value || undefined })}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Paid by')} help={help.paidBy}>
          <Select
            options={memberOptions}
            value={draft.paidByMemberId ?? ''}
            onChange={value => onUpdate({ paidByMemberId: value || undefined })}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Household use')} help={help.sharedStatus}>
          <Select
            options={sharedOptions}
            value={draft.sharedStatus}
            onChange={value =>
              onUpdate({
                sharedStatus: value,
                splitMethod:
                  value === 'shared'
                    ? draft.splitMethod === 'none'
                      ? 'equal'
                      : draft.splitMethod
                    : 'none',
              })
            }
            style={selectStyle}
          />
        </Field>
        <Field label={t('Split method')} help={help.splitMethod}>
          <Select
            options={splitOptions}
            value={draft.splitMethod}
            onChange={value => onUpdate({ splitMethod: value })}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Priority')} help={help.priority}>
          <Select
            options={priorityOptions}
            value={draft.priority}
            onChange={value => onUpdate({ priority: value })}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Can wait')} help={help.canWait}>
          <label
            style={{
              minHeight: 30,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              checked={draft.canWait}
              onChange={event =>
                onUpdate({ canWait: event.currentTarget.checked })
              }
            />
            <span>{draft.canWait ? t('Yes') : t('No')}</span>
          </label>
        </Field>
        <View style={{ gridColumn: '1 / -1' }}>
          <Field label={t('Notes')} help={help.notes}>
            <Input
              value={draft.notes ?? ''}
              onChangeValue={value => onUpdate({ notes: value || undefined })}
              style={fullWidthStyle}
            />
          </Field>
        </View>
      </View>
    </View>
  );
}

function ImpactCards({
  calculation,
  isShared,
  formatAmount,
  formatDisplayDate,
}: {
  calculation: FlowAffordabilityCalculation;
  isShared: boolean;
  formatAmount: (amount: number) => string;
  formatDisplayDate: (date: string) => string;
}) {
  const { t } = useTranslation();
  const check = calculation.check;
  const metrics: Array<{
    label: string;
    value: string;
    financial?: boolean;
    tone?: FlowAffordabilityDecision;
  }> = [
    {
      label: t('Projected month end before'),
      value: formatAmount(check.balanceBefore),
      financial: true,
    },
    {
      label: t('Projected month end after'),
      value: formatAmount(check.balanceAfter),
      financial: true,
      tone: check.decision,
    },
    {
      label: t('Cash before purchase'),
      value:
        calculation.purchaseBalanceBefore == null
          ? '-'
          : formatAmount(calculation.purchaseBalanceBefore),
      financial: calculation.purchaseBalanceBefore != null,
    },
    {
      label: t('Lowest balance after'),
      value: formatAmount(check.lowestBalanceAfter),
      financial: true,
      tone: check.decision,
    },
    {
      label: t('Safe minimum'),
      value: formatAmount(check.safeMinimumBalance),
      financial: true,
    },
    {
      label: t('Warning balance'),
      value: formatAmount(check.warningBalance),
      financial: true,
    },
    {
      label: t('Current account balance'),
      value:
        calculation.accountBalanceBefore == null
          ? t('Unavailable')
          : formatAmount(calculation.accountBalanceBefore),
      financial: calculation.accountBalanceBefore != null,
    },
    {
      label: t('Account balance after purchase'),
      value:
        calculation.accountBalanceAfter == null
          ? t('Unavailable')
          : formatAmount(calculation.accountBalanceAfter),
      financial: calculation.accountBalanceAfter != null,
      tone:
        calculation.accountBalanceAfter != null &&
        calculation.accountBalanceAfter < 0
          ? 'danger'
          : undefined,
    },
    {
      label: t('Cashflow base'),
      value:
        calculation.cashflowSource === 'saved'
          ? t('Saved snapshot')
          : calculation.cashflowSource === 'fresh'
            ? t('Fresh projection')
            : t('Unavailable'),
    },
    {
      label: t('First failure date'),
      value: check.firstFailureDate
        ? formatDisplayDate(check.firstFailureDate)
        : t('None'),
    },
  ];

  if (isShared) {
    metrics.splice(
      1,
      0,
      {
        label: t('Gross purchase amount'),
        value: formatAmount(check.amount),
        financial: true,
      },
      {
        label: t('Estimated personal share'),
        value: formatAmount(calculation.personalShare),
        financial: true,
      },
    );
  }

  return (
    <View style={panelStyle}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 17, fontWeight: 600 }}>
          <Trans>Purchase impact</Trans>
        </Text>
        {isShared && (
          <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.45 }}>
            <Trans>
              The full purchase leaves the payer's account now. The personal
              share is a separate household estimate and does not create a
              settlement item.
            </Trans>
          </Text>
        )}
      </View>
      <View style={answerGridStyle}>
        {metrics.map(metric => (
          <Metric
            key={metric.label}
            label={metric.label}
            value={metric.value}
            financial={metric.financial}
            color={metric.tone ? decisionColor(metric.tone) : undefined}
          />
        ))}
      </View>
    </View>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
  const { t } = useTranslation();
  return (
    <details style={detailsStyle} open>
      <summary
        style={{ cursor: 'pointer', color: theme.warningText, fontWeight: 600 }}
      >
        {t('{{count}} warning(s)', { count: warnings.length })}
      </summary>
      <View style={{ gap: 7, paddingTop: 12 }}>
        {warnings.map((warning, index) => (
          <Text
            key={`${warning}-${index}`}
            style={{ color: theme.warningText, lineHeight: 1.45 }}
          >
            {warning}
          </Text>
        ))}
      </View>
    </details>
  );
}

function SimulationPreview({
  calculation,
  formatAmount,
  formatDisplayDate,
}: {
  calculation: FlowAffordabilityCalculation;
  formatAmount: (amount: number) => string;
  formatDisplayDate: (date: string) => string;
}) {
  const { t } = useTranslation();
  const purchaseIndex = calculation.simulatedRows.findIndex(
    row => row.source === 'affordability-simulation',
  );
  const start = Math.max(0, purchaseIndex - 3);
  const rows = calculation.simulatedRows.slice(start, purchaseIndex + 4);

  return (
    <details style={detailsStyle} open>
      <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
        <Trans>Cashflow rows around the purchase</Trans>
      </summary>
      <Text
        style={{
          color: theme.pageTextSubdued,
          paddingTop: 8,
          lineHeight: 1.45,
        }}
      >
        <Trans>
          The simulated purchase is applied after the other projected rows on
          the same date.
        </Trans>
      </Text>
      <View style={{ overflowX: 'auto', paddingTop: 12 }}>
        <table style={tableStyle}>
          <thead>
            <tr>
              <th style={tableHeaderStyle}>
                <Trans>Date</Trans>
              </th>
              <th style={tableHeaderStyle}>
                <Trans>Name</Trans>
              </th>
              <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>
                <Trans>Inflow</Trans>
              </th>
              <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>
                <Trans>Outflow</Trans>
              </th>
              <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>
                <Trans>Balance after</Trans>
              </th>
              <th style={tableHeaderStyle}>
                <Trans>Source</Trans>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const isPurchase = row.source === 'affordability-simulation';
              return (
                <tr key={`${row.date}-${row.name}-${index}`}>
                  <td
                    style={{
                      ...tableCellStyle,
                      fontWeight: isPurchase ? 700 : undefined,
                    }}
                  >
                    {formatDisplayDate(row.date)}
                  </td>
                  <td
                    style={{
                      ...tableCellStyle,
                      fontWeight: isPurchase ? 700 : undefined,
                    }}
                  >
                    {row.name}
                  </td>
                  <MoneyCell amount={row.inflow} formatAmount={formatAmount} />
                  <MoneyCell amount={row.outflow} formatAmount={formatAmount} />
                  <MoneyCell
                    amount={row.balanceAfter}
                    formatAmount={formatAmount}
                    color={row.balanceAfter < 0 ? theme.errorText : undefined}
                  />
                  <td style={tableCellStyle}>
                    {isPurchase ? t('Test purchase') : row.source}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </View>
    </details>
  );
}

function SavedChecks({
  checks,
  formatAmount,
  formatDisplayDate,
  onNew,
  onLoad,
  onDelete,
}: {
  checks: FlowAffordabilityCheck[];
  formatAmount: (amount: number) => string;
  formatDisplayDate: (date: string) => string;
  onNew: () => void;
  onLoad: (check: FlowAffordabilityCheck) => void;
  onDelete: (check: FlowAffordabilityCheck) => void;
}) {
  return (
    <View style={panelStyle}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: 600 }}>
            <Trans>Saved checks</Trans>
          </Text>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              Recent affordability decisions for the purchase month.
            </Trans>
          </Text>
        </View>
        <Button variant="normal" onPress={onNew}>
          <Trans>New check</Trans>
        </Button>
      </View>

      {checks.length === 0 ? (
        <Text style={{ color: theme.pageTextSubdued }}>
          <Trans>No saved affordability checks exist for this month.</Trans>
        </Text>
      ) : (
        <View style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr>
                <th style={tableHeaderStyle}>
                  <Trans>Purchase</Trans>
                </th>
                <th style={{ ...tableHeaderStyle, textAlign: 'right' }}>
                  <Trans>Amount</Trans>
                </th>
                <th style={tableHeaderStyle}>
                  <Trans>Planned date</Trans>
                </th>
                <th style={tableHeaderStyle}>
                  <Trans>Decision</Trans>
                </th>
                <th style={tableHeaderStyle}>
                  <Trans>Reason</Trans>
                </th>
                <th style={tableHeaderStyle}>
                  <Trans>Created</Trans>
                </th>
                <th style={tableHeaderStyle}>
                  <Trans>Actions</Trans>
                </th>
              </tr>
            </thead>
            <tbody>
              {checks.map(check => (
                <tr key={check.id}>
                  <td style={{ ...tableCellStyle, fontWeight: 600 }}>
                    {check.purchaseName}
                  </td>
                  <MoneyCell
                    amount={check.amount}
                    formatAmount={formatAmount}
                  />
                  <td style={tableCellStyle}>
                    {formatDisplayDate(check.plannedDate)}
                  </td>
                  <td
                    style={{
                      ...tableCellStyle,
                      color: decisionColor(check.decision),
                      fontWeight: 700,
                      textTransform: 'uppercase',
                    }}
                  >
                    {check.decision}
                  </td>
                  <td style={{ ...tableCellStyle, minWidth: 240 }}>
                    {check.reason ?? '-'}
                  </td>
                  <td style={tableCellStyle}>
                    {check.createdAt ? formatTimestamp(check.createdAt) : '-'}
                  </td>
                  <td style={tableCellStyle}>
                    <View
                      style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}
                    >
                      <Button variant="normal" onPress={() => onLoad(check)}>
                        <Trans>Load / edit</Trans>
                      </Button>
                      <Button variant="normal" onPress={() => onDelete(check)}>
                        <Trans>Delete</Trans>
                      </Button>
                    </View>
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

function Metric({
  label,
  value,
  financial,
  color,
}: {
  label: string;
  value: string;
  financial?: boolean;
  color?: string;
}) {
  return (
    <View style={metricStyle}>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        {label}
      </Text>
      {financial ? (
        <FinancialText
          style={{
            ...styles.tnum,
            color,
            fontSize: 18,
            fontWeight: 650,
          }}
        >
          {value}
        </FinancialText>
      ) : (
        <Text style={{ color, fontSize: 18, fontWeight: 650 }}>{value}</Text>
      )}
    </View>
  );
}

function MoneyCell({
  amount,
  formatAmount,
  color,
}: {
  amount: number;
  formatAmount: (amount: number) => string;
  color?: string;
}) {
  return (
    <td style={{ ...tableCellStyle, textAlign: 'right' }}>
      <FinancialText style={{ ...styles.tnum, color }}>
        {formatAmount(amount)}
      </FinancialText>
    </td>
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
          style={{ color: theme.pageTextLight, lineHeight: 1.5, maxWidth: 360 }}
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

function StatusMessage({ status }: { status: StatusState }) {
  const { t } = useTranslation();
  if (status.kind === 'error') {
    return <Text style={{ color: theme.errorText }}>{status.message}</Text>;
  }

  const message =
    status.kind === 'saved'
      ? t('Affordability check saved.')
      : status.kind === 'loaded'
        ? t('Saved affordability check loaded for editing.')
        : status.kind === 'deleted'
          ? t('Saved affordability check deleted.')
          : t('Affordability calculated.');

  return (
    <Text style={{ color: theme.noticeTextLight, fontWeight: 600 }}>
      {message}
    </Text>
  );
}

function createDraft(currentDate: string): FlowAffordabilityCheck {
  return {
    id: createAffordabilityId(),
    purchaseName: '',
    amount: 0,
    plannedDate: currentDate,
    sharedStatus: 'personal',
    splitMethod: 'none',
    priority: 'normal',
    canWait: true,
    decision: 'check',
    monthChecked: currentDate.slice(0, 7),
    balanceBefore: 0,
    balanceAfter: 0,
    lowestBalanceAfter: 0,
    safeMinimumBalance: 0,
    warningBalance: 0,
  };
}

function createAffordabilityId(): string {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  return `flow-affordability:${id}`;
}

function deriveActualStartingCash({
  accountBalances,
  transactions,
  metadata,
  selectedAccountIds,
  selectedMonth,
  currentMonth,
}: {
  accountBalances: Record<string, number>;
  transactions: typeof emptyTransactions;
  metadata: typeof emptyMetadata;
  selectedAccountIds: string[];
  selectedMonth: string;
  currentMonth: string;
}): number {
  const selected = new Set(selectedAccountIds);
  const metadataByTransactionId = new Map(
    metadata.map(record => [record.actualTransactionId, record]),
  );
  const currentBalances = Object.entries(accountBalances).reduce(
    (sum, [accountId, balance]) =>
      selected.has(accountId) ? sum + balance : sum,
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
}

function estimatePersonalShare(
  check: FlowAffordabilityCheck,
  memberCount: number,
): number {
  return check.sharedStatus === 'shared' &&
    check.splitMethod === 'equal' &&
    memberCount > 0
    ? Math.round(check.amount / memberCount)
    : check.amount;
}

function getSavedRunWarnings(generatedAt: string | undefined): string[] {
  if (!generatedAt) {
    return ['The saved cashflow snapshot has no generated timestamp.'];
  }
  const generated = parseISO(generatedAt);
  if (!isValid(generated)) {
    return ['The saved cashflow snapshot timestamp is invalid.'];
  }
  const age = Date.now() - generated.getTime();
  return age > 7 * 24 * 60 * 60 * 1000
    ? [
        'The saved cashflow snapshot is more than seven days old. Use a fresh projection if the source data changed.',
      ]
    : [];
}

function getDecisionAnswer(
  decision: FlowAffordabilityDecision,
  hasCalculation: boolean,
  t: (key: string) => string,
): string {
  if (!hasCalculation) {
    return t('CHECK: Enter a purchase to test.');
  }
  switch (decision) {
    case 'ok':
      return t('OK: You can afford this.');
    case 'wait':
      return t('WAIT: Safer after more income.');
    case 'danger':
      return t('DANGER: This breaks the plan.');
    case 'check':
    default:
      return t('CHECK: Cashflow needs attention.');
  }
}

function decisionColor(decision: FlowAffordabilityDecision): string {
  switch (decision) {
    case 'ok':
      return theme.budgetNumberPositive;
    case 'wait':
      return theme.warningText;
    case 'danger':
      return theme.errorText;
    case 'check':
    default:
      return theme.pageTextSubdued;
  }
}

function formatIsoDate(date: string): string {
  const parsed = parseISO(date);
  return isValid(parsed) ? formatDate(parsed, DATE_FORMAT) : date;
}

function formatTimestamp(timestamp: string): string {
  const parsed = parseISO(timestamp);
  return isValid(parsed)
    ? formatDate(parsed, `${DATE_FORMAT} HH:mm:ss`)
    : timestamp;
}

function getFieldHelp(t: (key: string) => string) {
  return {
    purchaseName: t(
      'A clear label for the planned purchase. It is saved only in Flow and never becomes an Actual payee or transaction.',
    ),
    amount: t(
      "The full amount that will leave the payer's account. Flow uses integer money values and does not use floating point arithmetic.",
    ),
    plannedDate: t(
      'The date the money is expected to leave the account. This selects the cashflow month and places the simulated outflow in the daily projection.',
    ),
    cashflowSource: t(
      'Saved snapshot uses the latest saved Monthly Cashflow run for this month. Fresh projection recalculates from current Actual and Flow sources. If no snapshot exists, Saved automatically falls back to Fresh.',
    ),
    account: t(
      'The Actual account expected to pay. Flow shows its current balance and warns if subtracting the full purchase would make it negative. No account transaction is created.',
    ),
    category: t(
      'The Actual expense category used to identify the purpose of the purchase. This check does not change the category budget or create category activity.',
    ),
    paidBy: t(
      'The household member expected to make the payment. This is planning context only and does not create Settlement items.',
    ),
    sharedStatus: t(
      'Personal means one member bears the cost. Shared shows household impact separately. Ignored keeps the purchase outside household split estimates, but the cashflow still uses the full amount.',
    ),
    splitMethod: t(
      'Equal divides the personal share estimate across active household members. Other methods are saved but cannot be estimated without allocation details, so Flow shows a warning.',
    ),
    priority: t(
      'Priority records how important the purchase is. It explains whether waiting is practical; it does not override a Danger result.',
    ),
    canWait: t(
      'If yes, Flow can recommend waiting until after projected income when the purchase reduces the safety buffer.',
    ),
    notes: t(
      'Optional planning context for why the purchase is needed, alternatives considered, or conditions that must be true before buying.',
    ),
  };
}
