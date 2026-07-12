import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgInformationCircle } from '@actual-app/components/icons/v2';
import { baseInputStyle, Input } from '@actual-app/components/input';
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

import { FinancialText } from '#components/FinancialText';
import { Page } from '#components/Page';
import { DateSelect } from '#components/select/DateSelect';
import { FinancialInput } from '#components/util/FinancialInput';
import { PercentInput } from '#components/util/PercentInput';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';

import { getFlowCategoryOutflowsForMonth } from './actual-adapter';
import { calculateFlowDebts } from './debts/calculate';
import type {
  FlowDebtActualAccount,
  FlowDebtActualCategory,
} from './debts/calculate';
import { deleteFlowDebt, getFlowDebts, saveFlowDebt } from './debts/storage';
import type {
  FlowDebt,
  FlowDebtComputed,
  FlowDebtPriority,
  FlowDebtStatus,
  FlowDebtSummary,
} from './debts/types';

type DebtDraft = {
  id?: string;
  name: string;
  lender: string;
  actualAccountId: string;
  actualCategoryId: string;
  originalAmount: number;
  hasCurrentBalanceOverride: boolean;
  currentBalanceOverride: number;
  minimumPayment: number;
  plannedPayment: number;
  dueDay: string;
  interestRateBps: number;
  priority: FlowDebtPriority;
  status: FlowDebtStatus;
  active: boolean;
  notes: string;
};

type StatusState =
  | { kind: 'saved'; name: string }
  | { kind: 'archived'; name: string }
  | { kind: 'error'; message: string };

const emptyDebts: FlowDebt[] = [];
const emptyAccounts: AccountEntity[] = [];
const emptyCategories: CategoryEntity[] = [];
const priorityOptions: Array<SelectOption<FlowDebtPriority>> = [
  ['low', 'Low'],
  ['normal', 'Normal'],
  ['high', 'High'],
  ['urgent', 'Urgent'],
];
const statusOptions: Array<SelectOption<FlowDebtStatus>> = [
  ['active', 'Active'],
  ['paused', 'Paused'],
  ['paid-off', 'Paid off'],
  ['closed', 'Closed'],
  ['ignored', 'Ignored'],
];

export function DebtsPage() {
  const { t } = useTranslation();
  const format = useFormat();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const queryClient = useQueryClient();
  const [paymentMonth, setPaymentMonth] = useState(() =>
    monthUtils.monthFromDate(new Date()),
  );
  const [draft, setDraft] = useState<DebtDraft | null>(null);
  const [status, setStatus] = useState<StatusState | null>(null);
  const paymentMonthDate = monthUtils.firstDayOfMonth(paymentMonth);

  const debtsQuery = useQuery({
    queryKey: ['flow', 'debts'],
    queryFn: getFlowDebts,
  });
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const debts = debtsQuery.data ?? emptyDebts;
  const accounts = accountsQuery.data ?? emptyAccounts;
  const categories = categoriesQuery.data?.list ?? emptyCategories;
  const linkedCategoryIds = useMemo(
    () =>
      [
        ...new Set(
          debts
            .map(debt => debt.actualCategoryId)
            .filter((id): id is string => Boolean(id)),
        ),
      ].sort(),
    [debts],
  );
  const paidThisMonthQuery = useQuery({
    queryKey: [
      'flow',
      'debts',
      'paid-this-month',
      paymentMonth,
      linkedCategoryIds,
    ],
    queryFn: () =>
      getFlowCategoryOutflowsForMonth(paymentMonth, linkedCategoryIds),
    enabled: linkedCategoryIds.length > 0,
    placeholderData: {},
  });
  const debtAccounts = useMemo(
    () => accounts.map(toDebtAccount).filter(isDebtAccount),
    [accounts],
  );
  const debtCategories = useMemo(
    () => categories.map(toDebtCategory).filter(isDebtCategory),
    [categories],
  );
  const { rows, summary } = useMemo(
    () =>
      calculateFlowDebts({
        debts,
        accounts: debtAccounts,
        categories: debtCategories,
        paidThisMonthByCategoryId: paidThisMonthQuery.data ?? {},
        month: paymentMonth,
      }),
    [
      debtAccounts,
      debtCategories,
      debts,
      paidThisMonthQuery.data,
      paymentMonth,
    ],
  );
  const accountOptions = useMemo(
    () => createAccountOptions(accounts, t),
    [accounts, t],
  );
  const categoryOptions = useMemo(
    () => createCategoryOptions(categories, t),
    [categories, t],
  );
  const accountsById = useMemo(
    () => new Map(accounts.map(account => [account.id, account])),
    [accounts],
  );
  const categoriesById = useMemo(
    () => new Map(categories.map(category => [category.id, category])),
    [categories],
  );
  const isBusy =
    debtsQuery.isLoading ||
    accountsQuery.isLoading ||
    categoriesQuery.isLoading ||
    paidThisMonthQuery.isLoading;

  useEffect(() => {
    return listen('sync-event', event => {
      if (
        'tables' in event &&
        event.tables.some(table =>
          ['flow_debts', 'accounts', 'categories', 'transactions'].includes(
            table,
          ),
        )
      ) {
        void queryClient.invalidateQueries({ queryKey: ['flow', 'debts'] });
      }
    });
  }, [queryClient]);

  async function refetchDebts() {
    await Promise.all([
      debtsQuery.refetch(),
      paidThisMonthQuery.refetch(),
      queryClient.invalidateQueries({ queryKey: ['accounts'] }),
      queryClient.invalidateQueries({ queryKey: ['categories'] }),
    ]);
  }

  async function handleSave() {
    if (!draft) {
      return;
    }

    if (!draft.name.trim()) {
      setStatus({ kind: 'error', message: t('Debt name is required.') });
      return;
    }

    try {
      const savedDebt = await saveFlowDebt(draftToDebt(draft));
      setDraft(null);
      setStatus({ kind: 'saved', name: savedDebt.name });
      await refetchDebts();
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Debt could not be saved.'),
      });
    }
  }

  async function handleArchive(debt: FlowDebt) {
    if (
      !window.confirm(
        t('Archive {{name}}? It will be hidden from the Debts page.', {
          name: debt.name,
        }),
      )
    ) {
      return;
    }

    try {
      await deleteFlowDebt(debt.id);
      if (draft?.id === debt.id) {
        setDraft(null);
      }
      setStatus({ kind: 'archived', name: debt.name });
      await refetchDebts();
    } catch (error) {
      setStatus({
        kind: 'error',
        message:
          error instanceof Error
            ? error.message
            : t('Debt could not be archived.'),
      });
    }
  }

  return (
    <Page header={null}>
      <View
        style={{ maxWidth: 1180, minHeight: 'auto', gap: 16, paddingTop: 10 }}
      >
        <OverviewPanel
          summary={summary}
          paymentMonthDate={paymentMonthDate}
          dateFormat={dateFormat}
          formatAmount={amount => `€${format(amount, 'financial')}`}
          isBusy={isBusy}
          onMonthChange={date =>
            setPaymentMonth(monthUtils.monthFromDate(date))
          }
          onAddDebt={() => {
            setDraft(createBlankDraft());
            setStatus(null);
          }}
        />

        {status && <StatusPanel status={status} />}

        {draft && (
          <DebtForm
            draft={draft}
            accountOptions={accountOptions}
            categoryOptions={categoryOptions}
            paymentMonth={paymentMonth}
            dateFormat={dateFormat}
            onChange={setDraft}
            onSave={handleSave}
            onCancel={() => setDraft(null)}
          />
        )}

        {debtsQuery.error ? (
          <InfoPanel tone="error">
            <Text style={{ color: theme.errorText }}>
              <Trans>Debts could not be loaded.</Trans>
            </Text>
          </InfoPanel>
        ) : rows.length === 0 ? (
          <InfoPanel>
            <Trans>No debts have been added yet.</Trans>
          </InfoPanel>
        ) : (
          <DebtList
            rows={rows}
            accountsById={accountsById}
            categoriesById={categoriesById}
            formatAmount={amount => `€${format(amount, 'financial')}`}
            onEdit={debt => {
              setDraft(debtToDraft(debt));
              setStatus(null);
            }}
            onArchive={handleArchive}
          />
        )}
      </View>
    </Page>
  );
}

function OverviewPanel({
  summary,
  paymentMonthDate,
  dateFormat,
  formatAmount,
  isBusy,
  onMonthChange,
  onAddDebt,
}: {
  summary: FlowDebtSummary;
  paymentMonthDate: string;
  dateFormat: string;
  formatAmount: (amount: number) => string;
  isBusy: boolean;
  onMonthChange: (date: string) => void;
  onAddDebt: () => void;
}) {
  const { t } = useTranslation();
  const cards = [
    {
      label: t('Total debt remaining'),
      value: formatAmount(summary.totalDebtRemaining),
      financial: true,
      color: theme.budgetNumberNegative,
    },
    {
      label: t('Planned monthly payment'),
      value: formatAmount(summary.totalPlannedMonthlyPayment),
      financial: true,
    },
    {
      label: t('Minimum monthly payment'),
      value: formatAmount(summary.totalMinimumMonthlyPayment),
      financial: true,
    },
    {
      label: t('Paid this month'),
      value: formatAmount(summary.paidThisMonth),
      financial: true,
      color: theme.budgetNumberPositive,
    },
    {
      label: t('Active debts'),
      value: String(summary.activeDebtCount),
    },
    {
      label: t('Estimated debt-free month'),
      value: summary.estimatedDebtFreeMonth ?? t('Not enough data'),
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
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 18, fontWeight: 600 }}>
            <Trans>Debt overview</Trans>
          </Text>
          <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
            <Trans>
              Track debt balances and payoff plans using Flow-owned metadata
              linked to Actual accounts and categories.
            </Trans>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          <View style={{ gap: 5 }}>
            <LabelText>
              <Trans>Payment month</Trans>
            </LabelText>
            <DateSelect
              value={paymentMonthDate}
              dateFormat={dateFormat}
              onSelect={onMonthChange}
              inputProps={{
                style: { width: 135 },
              }}
            />
          </View>
          <Button variant="primary" onPress={onAddDebt}>
            <Trans>Add debt</Trans>
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
              <Text style={{ fontSize: 22, fontWeight: 600 }}>
                {card.value}
              </Text>
            )}
          </View>
        ))}
      </View>

      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        {isBusy
          ? t('Loading debt data...')
          : t('{{count}} warning(s)', {
              count: summary.warningCount,
            })}
      </Text>
    </View>
  );
}

function DebtForm({
  draft,
  accountOptions,
  categoryOptions,
  paymentMonth,
  dateFormat,
  onChange,
  onSave,
  onCancel,
}: {
  draft: DebtDraft;
  accountOptions: Array<SelectOption<string>>;
  categoryOptions: Array<SelectOption<string>>;
  paymentMonth: string;
  dateFormat: string;
  onChange: (draft: DebtDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const help = getDebtFieldHelp(t);
  const set = <Key extends keyof DebtDraft>(
    key: Key,
    value: DebtDraft[Key],
  ) => {
    onChange({ ...draft, [key]: value });
  };

  return (
    <View style={panelStyle}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: 600 }}>
            {draft.id ? t('Edit debt') : t('Add debt')}
          </Text>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              Actual links are references only. Saving here does not create,
              edit, import, or sync Actual transactions.
            </Trans>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="normal" onPress={onCancel}>
            <Trans>Cancel</Trans>
          </Button>
          <Button variant="primary" onPress={onSave}>
            <Trans>Save debt</Trans>
          </Button>
        </View>
      </View>

      <View style={formGridStyle}>
        <Field label={t('Name')} help={help.name}>
          <Input
            value={draft.name}
            onChangeValue={value => set('name', value)}
            style={fullWidthInputStyle}
          />
        </Field>
        <Field label={t('Lender')} help={help.lender}>
          <Input
            value={draft.lender}
            onChangeValue={value => set('lender', value)}
            style={fullWidthInputStyle}
          />
        </Field>
        <Field label={t('Linked Actual account')} help={help.actualAccountId}>
          <Select
            options={accountOptions}
            value={draft.actualAccountId}
            onChange={value => set('actualAccountId', value)}
            style={selectStyle}
          />
        </Field>
        <Field
          label={t('Linked payment category')}
          help={help.actualCategoryId}
        >
          <Select
            options={categoryOptions}
            value={draft.actualCategoryId}
            onChange={value => set('actualCategoryId', value)}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Original amount')} help={help.originalAmount}>
          <FinancialInput
            value={draft.originalAmount}
            onUpdate={value => set('originalAmount', Math.max(0, value))}
            style={fullWidthInputStyle}
          />
        </Field>
        <Field
          label={t('Manual current balance')}
          help={help.currentBalanceOverride}
        >
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              aria-label={t('Use manual current balance')}
              checked={draft.hasCurrentBalanceOverride}
              onChange={event =>
                set('hasCurrentBalanceOverride', event.currentTarget.checked)
              }
            />
            <FinancialInput
              value={draft.currentBalanceOverride}
              disabled={!draft.hasCurrentBalanceOverride}
              onUpdate={value =>
                set('currentBalanceOverride', Math.max(0, value))
              }
              style={{ ...fullWidthInputStyle, flex: 1 }}
            />
          </View>
        </Field>
        <Field label={t('Minimum payment')} help={help.minimumPayment}>
          <FinancialInput
            value={draft.minimumPayment}
            onUpdate={value => set('minimumPayment', Math.max(0, value))}
            style={fullWidthInputStyle}
          />
        </Field>
        <Field label={t('Planned payment')} help={help.plannedPayment}>
          <FinancialInput
            value={draft.plannedPayment}
            onUpdate={value => set('plannedPayment', Math.max(0, value))}
            style={fullWidthInputStyle}
          />
        </Field>
        <Field label={t('Due day')} help={help.dueDay}>
          <DateSelect
            value={dateFromDueDay(draft.dueDay, paymentMonth)}
            dateFormat={dateFormat}
            onSelect={date => set('dueDay', dueDayFromDate(date))}
            inputProps={{
              style: fullWidthInputStyle,
              placeholder: t('Choose due day'),
            }}
          />
        </Field>
        <Field label={t('Interest rate')} help={help.interestRateBps}>
          <PercentInput
            value={draft.interestRateBps / 100}
            max={100}
            onUpdatePercent={value =>
              set('interestRateBps', Math.max(0, Math.round(value * 100)))
            }
            style={fullWidthInputStyle}
          />
        </Field>
        <Field label={t('Priority')} help={help.priority}>
          <Select
            options={priorityOptions}
            value={draft.priority}
            onChange={value => set('priority', value)}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Status')} help={help.status}>
          <Select
            options={statusOptions}
            value={draft.status}
            onChange={value => {
              onChange({
                ...draft,
                status: value,
                active:
                  value === 'paid-off' ||
                  value === 'closed' ||
                  value === 'ignored'
                    ? false
                    : draft.active,
              });
            }}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Active')} help={help.active}>
          <label style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input
              type="checkbox"
              aria-label={t('Included in active debt totals')}
              checked={draft.active}
              onChange={event => set('active', event.currentTarget.checked)}
            />
            <span>
              <Trans>Included in active debt totals</Trans>
            </span>
          </label>
        </Field>
      </View>

      <Field label={t('Notes')} help={help.notes}>
        <textarea
          value={draft.notes}
          onChange={event => set('notes', event.currentTarget.value)}
          style={textareaStyle}
        />
      </Field>
    </View>
  );
}

function DebtList({
  rows,
  accountsById,
  categoriesById,
  formatAmount,
  onEdit,
  onArchive,
}: {
  rows: FlowDebtComputed[];
  accountsById: Map<string, AccountEntity>;
  categoriesById: Map<string, CategoryEntity>;
  formatAmount: (amount: number) => string;
  onEdit: (debt: FlowDebt) => void;
  onArchive: (debt: FlowDebt) => void;
}) {
  const sortedRows = [...rows].sort(compareDebtRows);

  return (
    <View style={{ gap: 12 }}>
      {sortedRows.map(row => (
        <DebtCard
          key={row.debt.id}
          row={row}
          account={
            row.debt.actualAccountId
              ? accountsById.get(row.debt.actualAccountId)
              : undefined
          }
          category={
            row.debt.actualCategoryId
              ? categoriesById.get(row.debt.actualCategoryId)
              : undefined
          }
          formatAmount={formatAmount}
          onEdit={() => onEdit(row.debt)}
          onArchive={() => onArchive(row.debt)}
        />
      ))}
    </View>
  );
}

function DebtCard({
  row,
  account,
  category,
  formatAmount,
  onEdit,
  onArchive,
}: {
  row: FlowDebtComputed;
  account: AccountEntity | undefined;
  category: CategoryEntity | undefined;
  formatAmount: (amount: number) => string;
  onEdit: () => void;
  onArchive: () => void;
}) {
  const { t } = useTranslation();
  const { debt } = row;

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
        <View style={{ gap: 5, minWidth: 220 }}>
          <Text style={{ fontSize: 18, fontWeight: 600 }}>{debt.name}</Text>
          <Text style={{ color: theme.pageTextSubdued }}>
            {debt.lender || t('No lender')}
          </Text>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Badge>{formatPriority(debt.priority)}</Badge>
            <Badge>{formatStatus(debt.status)}</Badge>
            {!debt.active && (
              <Badge>
                <Trans>Inactive</Trans>
              </Badge>
            )}
          </View>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 7 }}>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            <Trans>Current balance</Trans>
          </Text>
          <FinancialText
            style={{
              ...styles.tnum,
              color:
                row.currentBalance > 0
                  ? theme.budgetNumberNegative
                  : theme.budgetNumberZero,
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            {formatAmount(row.currentBalance)}
          </FinancialText>
          <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
            {formatBalanceSource(row.currentBalanceSource)}
          </Text>
        </View>
      </View>

      <View style={detailGridStyle}>
        <DebtMetric
          label={t('Linked account')}
          value={account?.name ?? t('No linked account')}
        />
        <DebtMetric
          label={t('Payment category')}
          value={category?.name ?? t('No linked category')}
        />
        <DebtMetric
          label={t('Original amount')}
          value={formatAmount(debt.originalAmount)}
          financial
        />
        <DebtMetric
          label={t('Minimum payment')}
          value={formatAmount(debt.minimumPayment)}
          financial
        />
        <DebtMetric
          label={t('Planned payment')}
          value={formatAmount(debt.plannedPayment)}
          financial
        />
        <DebtMetric
          label={t('Paid this month')}
          value={formatAmount(row.paidThisMonth)}
          financial
          tone="positive"
        />
        <DebtMetric
          label={t('After planned payment')}
          value={formatAmount(row.remainingAfterPlannedPayment)}
          financial
        />
        <DebtMetric
          label={t('Payoff estimate')}
          value={
            row.payoffMonths == null
              ? t('Not enough data')
              : t('{{months}} month(s), {{month}}', {
                  months: row.payoffMonths,
                  month: row.payoffMonth,
                })
          }
        />
        <DebtMetric
          label={t('Due day')}
          value={debt.dueDay ? String(debt.dueDay) : t('Not set')}
        />
        <DebtMetric
          label={t('Interest rate')}
          value={`${formatPercent(debt.interestRateBps)}%`}
        />
      </View>

      {debt.notes && (
        <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
          {debt.notes}
        </Text>
      )}

      {row.warnings.length > 0 && <Warnings warnings={row.warnings} />}

      <View
        style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}
      >
        <Button variant="normal" onPress={onEdit}>
          <Trans>Edit</Trans>
        </Button>
        <Button variant="normal" onPress={onArchive}>
          <Trans>Archive debt</Trans>
        </Button>
      </View>
    </View>
  );
}

function DebtMetric({
  label,
  value,
  financial,
  tone,
}: {
  label: string;
  value: string;
  financial?: boolean;
  tone?: 'positive' | 'negative';
}) {
  const color =
    tone === 'positive'
      ? theme.budgetNumberPositive
      : tone === 'negative'
        ? theme.budgetNumberNegative
        : theme.pageText;

  return (
    <View style={{ gap: 5, minWidth: 0 }}>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        {label}
      </Text>
      {financial ? (
        <FinancialText
          style={{ ...styles.tnum, color, fontSize: 15, fontWeight: 600 }}
        >
          {value}
        </FinancialText>
      ) : (
        <Text style={{ color, fontSize: 15, fontWeight: 600 }}>{value}</Text>
      )}
    </View>
  );
}

function Warnings({ warnings }: { warnings: string[] }) {
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
        <Text key={`${warning}-${index}`} style={{ color: theme.warningText }}>
          {warning}
        </Text>
      ))}
    </View>
  );
}

function StatusPanel({ status }: { status: StatusState }) {
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
      {status.kind === 'saved'
        ? t('Saved {{name}}.', { name: status.name })
        : t('Archived {{name}}.', { name: status.name })}
    </Text>
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
      <LabelText help={help}>{label}</LabelText>
      {children}
    </View>
  );
}

function LabelText({ help, children }: { help?: string; children: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        {children}
      </Text>
      {help && <HelpTooltip content={help} />}
    </View>
  );
}

function HelpTooltip({ content }: { content: string }) {
  const { t } = useTranslation();

  return (
    <Tooltip
      content={
        <Text
          style={{
            color: theme.pageTextLight,
            lineHeight: 1.5,
            maxWidth: 340,
          }}
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

function Badge({ children }: { children: ReactNode }) {
  return (
    <Text
      style={{
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 999,
        color: theme.pageTextSubdued,
        padding: '2px 8px',
        fontSize: 12,
      }}
    >
      {children}
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

function createBlankDraft(): DebtDraft {
  return {
    name: '',
    lender: '',
    actualAccountId: '',
    actualCategoryId: '',
    originalAmount: 0,
    hasCurrentBalanceOverride: false,
    currentBalanceOverride: 0,
    minimumPayment: 0,
    plannedPayment: 0,
    dueDay: '',
    interestRateBps: 0,
    priority: 'normal',
    status: 'active',
    active: true,
    notes: '',
  };
}

function debtToDraft(debt: FlowDebt): DebtDraft {
  return {
    id: debt.id,
    name: debt.name,
    lender: debt.lender ?? '',
    actualAccountId: debt.actualAccountId ?? '',
    actualCategoryId: debt.actualCategoryId ?? '',
    originalAmount: debt.originalAmount,
    hasCurrentBalanceOverride: debt.currentBalanceOverride != null,
    currentBalanceOverride: debt.currentBalanceOverride ?? 0,
    minimumPayment: debt.minimumPayment,
    plannedPayment: debt.plannedPayment,
    dueDay: debt.dueDay ? String(debt.dueDay) : '',
    interestRateBps: debt.interestRateBps,
    priority: debt.priority,
    status: debt.status,
    active: debt.active,
    notes: debt.notes ?? '',
  };
}

function draftToDebt(draft: DebtDraft): Partial<FlowDebt> {
  return {
    id: draft.id,
    name: draft.name.trim(),
    lender: optionalString(draft.lender),
    actualAccountId: optionalString(draft.actualAccountId),
    actualCategoryId: optionalString(draft.actualCategoryId),
    originalAmount: Math.max(0, draft.originalAmount),
    currentBalanceOverride: draft.hasCurrentBalanceOverride
      ? Math.max(0, draft.currentBalanceOverride)
      : undefined,
    minimumPayment: Math.max(0, draft.minimumPayment),
    plannedPayment: Math.max(0, draft.plannedPayment),
    dueDay: normalizeDueDay(draft.dueDay),
    interestRateBps: Math.max(0, draft.interestRateBps),
    priority: draft.priority,
    status: draft.status,
    active: draft.active,
    notes: optionalString(draft.notes),
  };
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

function toDebtAccount(
  account: AccountEntity,
): FlowDebtActualAccount | undefined {
  if (account.tombstone) {
    return undefined;
  }

  return {
    id: account.id,
    name: account.name,
    balanceCurrent: account.balance_current,
    closed: Boolean(account.closed),
  };
}

function toDebtCategory(
  category: CategoryEntity,
): FlowDebtActualCategory | undefined {
  if (category.tombstone) {
    return undefined;
  }

  return {
    id: category.id,
    name: category.name,
    hidden: Boolean(category.hidden),
  };
}

function isDebtAccount(
  account: FlowDebtActualAccount | undefined,
): account is FlowDebtActualAccount {
  return account !== undefined;
}

function isDebtCategory(
  category: FlowDebtActualCategory | undefined,
): category is FlowDebtActualCategory {
  return category !== undefined;
}

function compareDebtRows(left: FlowDebtComputed, right: FlowDebtComputed) {
  return (
    Number(right.debt.active) - Number(left.debt.active) ||
    priorityWeight(right.debt.priority) - priorityWeight(left.debt.priority) ||
    right.currentBalance - left.currentBalance ||
    left.debt.name.localeCompare(right.debt.name)
  );
}

function priorityWeight(priority: FlowDebtPriority) {
  switch (priority) {
    case 'urgent':
      return 4;
    case 'high':
      return 3;
    case 'normal':
      return 2;
    case 'low':
    default:
      return 1;
  }
}

function formatPriority(priority: FlowDebtPriority) {
  switch (priority) {
    case 'urgent':
      return 'Urgent priority';
    case 'high':
      return 'High priority';
    case 'low':
      return 'Low priority';
    case 'normal':
    default:
      return 'Normal priority';
  }
}

function formatStatus(status: FlowDebtStatus) {
  switch (status) {
    case 'paid-off':
      return 'Paid off';
    case 'closed':
      return 'Closed';
    case 'ignored':
      return 'Ignored';
    case 'paused':
      return 'Paused';
    case 'active':
    default:
      return 'Active';
  }
}

function formatBalanceSource(source: FlowDebtComputed['currentBalanceSource']) {
  switch (source) {
    case 'actual-account':
      return 'From linked Actual account';
    case 'manual-override':
      return 'From manual balance';
    case 'original-amount':
      return 'From original amount';
    case 'unknown':
    default:
      return 'Unknown balance';
  }
}

function formatPercent(bps: number) {
  return (bps / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeDueDay(value: string): number | undefined {
  const parsed = Number(value);

  if (!Number.isInteger(parsed)) {
    return undefined;
  }

  return Math.max(1, Math.min(31, parsed));
}

function dateFromDueDay(dueDay: string, month: string): string {
  const normalizedDueDay = normalizeDueDay(dueDay);

  if (!normalizedDueDay || !monthUtils.isValidYearMonth(month)) {
    return '';
  }

  const lastDayOfMonth = Number(monthUtils.lastDayOfMonth(month).slice(-2));
  const visibleDay = Math.min(normalizedDueDay, lastDayOfMonth);

  return `${month}-${String(visibleDay).padStart(2, '0')}`;
}

function dueDayFromDate(date: string): string {
  const match = /^\d{4}-\d{2}-(\d{2})$/.exec(date);

  if (!match) {
    return '';
  }

  return String(Number(match[1]));
}

function getDebtFieldHelp(t: (key: string) => string) {
  return {
    name: t(
      'Short name shown on the Debts page, such as Visa, Car loan, or Mortgage.',
    ),
    lender: t(
      'The bank, card issuer, person, or institution that owns the debt.',
    ),
    actualAccountId: t(
      'Optional Actual account used as the balance source. If linked, Flow reads that account balance and displays debt owed as a positive number.',
    ),
    actualCategoryId: t(
      'Optional Actual category used to count payments made this month. Flow sums outflows in this category and excludes identifiable transfers.',
    ),
    originalAmount: t(
      'Starting debt amount. Flow uses this only when there is no linked Actual account balance and no manual current balance.',
    ),
    currentBalanceOverride: t(
      'Manual current balance for debts that are not tracked as Actual accounts. Enable it when Actual cannot provide the balance.',
    ),
    minimumPayment: t(
      'Required minimum monthly payment. Flow warns when the planned payment is below this amount.',
    ),
    plannedPayment: t(
      'Amount you plan to pay each month. Flow uses it for monthly totals and the simple payoff estimate.',
    ),
    dueDay: t(
      "Choose the monthly due day with Actual's date picker. Only the day of month is saved; the shown month is the selected payment month.",
    ),
    interestRateBps: t(
      'Annual interest rate for reference, stored as basis points. V1 displays it but does not run compound amortization.',
    ),
    priority: t(
      'Planning priority used for sorting and future cashflow/system-check decisions.',
    ),
    status: t(
      'Lifecycle state for this debt. Paid off, closed, and ignored debts are removed from active totals when saved inactive.',
    ),
    active: t(
      'Controls whether this debt is included in active debt totals, warnings, and future cashflow planning.',
    ),
    notes: t('Free-form context, assumptions, payoff notes, or reminders.'),
  };
}

const panelStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.tableBackground,
  padding: 16,
  gap: 16,
};

const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 12,
};

const summaryCardStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.pageBackground,
  padding: 14,
  gap: 8,
};

const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
};

const detailGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 14,
};

const fullWidthInputStyle: CSSProperties = {
  width: '100%',
};

const selectStyle: CSSProperties = {
  ...baseInputStyle,
  width: '100%',
  justifyContent: 'space-between',
};

const textareaStyle: CSSProperties = {
  ...baseInputStyle,
  width: '100%',
  minHeight: 76,
  resize: 'vertical',
};
