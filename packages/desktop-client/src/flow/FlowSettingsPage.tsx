import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { baseInputStyle, Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import type { SelectOption } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { Page } from '#components/Page';
import { FinancialInput } from '#components/util/FinancialInput';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';

import {
  createDefaultFlowSettings,
  createFixedBill,
  createHouseholdMember,
  createIncomePlan,
  createScenario,
  createVariableSpendingRule,
} from './planning/defaults';
import {
  exportFlowSettings,
  getFlowSettings,
  parseFlowSettingsJson,
  resetFlowSettings,
  saveFlowSettings,
} from './planning/storage';
import type {
  FlowCashflowSettings,
  FlowFixedBill,
  FlowHouseholdMember,
  FlowIncomePlan,
  FlowScenario,
  FlowSettings,
  FlowTransactionRules,
  FlowVariableSpendingRule,
} from './planning/types';

type StatusState =
  | { kind: 'saved' | 'reset' | 'exported' | 'imported' }
  | { kind: 'error'; message: string };

export function FlowSettingsPage() {
  const { t } = useTranslation();
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const [settings, setSettings] = useState<FlowSettings>(() =>
    createDefaultFlowSettings(),
  );
  const [jsonBuffer, setJsonBuffer] = useState('');
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isDirty, setDirty] = useState(false);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const loadedSettings = await getFlowSettings();
        if (isMounted) {
          setSettings(loadedSettings);
          setJsonBuffer(exportFlowSettings(loadedSettings));
        }
      } catch (error) {
        if (isMounted) {
          setStatus({ kind: 'error', message: getErrorMessage(error) });
        }
      }
    }

    void loadSettings();

    return () => {
      isMounted = false;
    };
  }, []);

  const accountOptions = useMemo<SelectOption<string>[]>(
    () => [
      ['', t('No linked account')],
      ...(accountsQuery.data ?? [])
        .filter(account => !account.tombstone)
        .map(account => createSelectOption(account.id, account.name)),
    ],
    [accountsQuery.data, t],
  );

  const categoryOptions = useMemo<SelectOption<string>[]>(
    () => [
      ['', t('No linked category')],
      ...(categoriesQuery.data?.list ?? [])
        .filter(category => !category.tombstone)
        .map(category => createSelectOption(category.id, category.name)),
    ],
    [categoriesQuery.data?.list, t],
  );

  const memberOptions = useMemo<SelectOption<string>[]>(
    () => [
      ['', t('No default member')],
      ...settings.householdMembers.map(member =>
        createSelectOption(member.id, member.name),
      ),
    ],
    [settings.householdMembers, t],
  );

  const scenarioOptions = useMemo<SelectOption<string>[]>(
    () =>
      settings.scenarios.map(scenario =>
        createSelectOption(scenario.id, scenario.name),
      ),
    [settings.scenarios],
  );

  const statusText = status ? getStatusText(status, t) : null;
  const hasDropdownWarning = accountsQuery.isError || categoriesQuery.isError;

  function updateSettings(updater: (current: FlowSettings) => FlowSettings) {
    setSettings(current => updater(current));
    setDirty(true);
    setStatus(null);
  }

  async function handleSave() {
    try {
      const savedSettings = await saveFlowSettings(settings);
      setSettings(savedSettings);
      setJsonBuffer(exportFlowSettings(savedSettings));
      setDirty(false);
      setStatus({ kind: 'saved' });
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    }
  }

  async function handleReset() {
    try {
      const defaultSettings = await resetFlowSettings();
      setSettings(defaultSettings);
      setJsonBuffer(exportFlowSettings(defaultSettings));
      setDirty(false);
      setStatus({ kind: 'reset' });
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    }
  }

  async function handleImport() {
    const parsed = parseFlowSettingsJson(jsonBuffer);

    if (parsed.ok === false) {
      setStatus({ kind: 'error', message: parsed.error });
      return;
    }

    try {
      const savedSettings = await saveFlowSettings(parsed.settings);
      setSettings(savedSettings);
      setJsonBuffer(exportFlowSettings(savedSettings));
      setDirty(false);
      setStatus({ kind: 'imported' });
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    }
  }

  function handleExport() {
    setJsonBuffer(exportFlowSettings(settings));
    setStatus({ kind: 'exported' });
  }

  return (
    <Page header={t('Flow Settings')}>
      <View style={{ maxWidth: 1240, gap: 18, paddingTop: 10 }}>
        <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
          <Trans>
            Configure global Flow settings and planning assumptions without
            changing Actual account, transaction, budget, or sync data.
          </Trans>
        </Text>

        <NoticePanel>
          <Trans>
            Flow Settings is currently stored locally on this browser. Shared
            sync storage will be added in a later task.
          </Trans>
        </NoticePanel>

        {hasDropdownWarning && (
          <NoticePanel tone="warning">
            <Trans>
              Some Actual account or category dropdown data could not be loaded.
              You can still edit and save Flow settings.
            </Trans>
          </NoticePanel>
        )}

        <ActionBar
          isDirty={isDirty}
          statusText={statusText}
          statusKind={status?.kind}
          updatedAt={settings.updatedAt}
          onSave={handleSave}
          onReset={handleReset}
          onExport={handleExport}
          onImport={handleImport}
        />

        <HouseholdSection
          members={settings.householdMembers}
          accountOptions={accountOptions}
          onAdd={() =>
            updateSettings(current => ({
              ...current,
              householdMembers: [
                ...current.householdMembers,
                createHouseholdMember({ name: t('New member') }),
              ],
            }))
          }
          onUpdate={(id, fields) =>
            updateSettings(current => ({
              ...current,
              householdMembers: updateItem(
                current.householdMembers,
                id,
                fields,
              ),
            }))
          }
          onRemove={id =>
            updateSettings(current => ({
              ...current,
              householdMembers: removeItem(current.householdMembers, id),
            }))
          }
        />

        <TransactionRulesSection
          rules={settings.transactionRules}
          memberOptions={memberOptions}
          onUpdate={fields =>
            updateSettings(current => ({
              ...current,
              transactionRules: { ...current.transactionRules, ...fields },
            }))
          }
        />

        <CashflowParametersSection
          settings={settings.cashflowSettings}
          scenarioOptions={scenarioOptions}
          onUpdate={fields =>
            updateSettings(current => ({
              ...current,
              cashflowSettings: { ...current.cashflowSettings, ...fields },
            }))
          }
        />

        <IncomePlanSection
          plans={settings.incomePlans}
          memberOptions={memberOptions}
          accountOptions={accountOptions}
          categoryOptions={categoryOptions}
          onAdd={() =>
            updateSettings(current => ({
              ...current,
              incomePlans: [
                ...current.incomePlans,
                createIncomePlan({ name: t('New income') }),
              ],
            }))
          }
          onUpdate={(id, fields) =>
            updateSettings(current => ({
              ...current,
              incomePlans: updateItem(current.incomePlans, id, fields),
            }))
          }
          onRemove={id =>
            updateSettings(current => ({
              ...current,
              incomePlans: removeItem(current.incomePlans, id),
            }))
          }
        />

        <FixedBillsSection
          bills={settings.fixedBills}
          memberOptions={memberOptions}
          accountOptions={accountOptions}
          categoryOptions={categoryOptions}
          onAdd={() =>
            updateSettings(current => ({
              ...current,
              fixedBills: [
                ...current.fixedBills,
                createFixedBill({ name: t('New fixed bill') }),
              ],
            }))
          }
          onUpdate={(id, fields) =>
            updateSettings(current => ({
              ...current,
              fixedBills: updateItem(current.fixedBills, id, fields),
            }))
          }
          onRemove={id =>
            updateSettings(current => ({
              ...current,
              fixedBills: removeItem(current.fixedBills, id),
            }))
          }
        />

        <VariableSpendingSection
          rules={settings.variableSpendingRules}
          categoryOptions={categoryOptions}
          onAdd={() =>
            updateSettings(current => ({
              ...current,
              variableSpendingRules: [
                ...current.variableSpendingRules,
                createVariableSpendingRule({ name: t('New variable rule') }),
              ],
            }))
          }
          onUpdate={(id, fields) =>
            updateSettings(current => ({
              ...current,
              variableSpendingRules: updateItem(
                current.variableSpendingRules,
                id,
                fields,
              ),
            }))
          }
          onRemove={id =>
            updateSettings(current => ({
              ...current,
              variableSpendingRules: removeItem(
                current.variableSpendingRules,
                id,
              ),
            }))
          }
        />

        <ScenariosSection
          scenarios={settings.scenarios}
          onAdd={() =>
            updateSettings(current => ({
              ...current,
              scenarios: [
                ...current.scenarios,
                createScenario({ name: t('New scenario') }),
              ],
            }))
          }
          onUpdate={(id, fields) =>
            updateSettings(current => ({
              ...current,
              scenarios: updateItem(current.scenarios, id, fields),
            }))
          }
          onRemove={id =>
            updateSettings(current => ({
              ...current,
              scenarios: removeItem(current.scenarios, id),
            }))
          }
        />

        <JsonPanel
          value={jsonBuffer}
          onChange={setJsonBuffer}
          onExport={handleExport}
          onImport={handleImport}
        />
      </View>
    </Page>
  );
}

type ActionBarProps = {
  isDirty: boolean;
  statusText: string | null;
  statusKind?: StatusState['kind'];
  updatedAt: string;
  onSave: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
};

function ActionBar({
  isDirty,
  statusText,
  statusKind,
  updatedAt,
  onSave,
  onReset,
  onExport,
  onImport,
}: ActionBarProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        ...sectionStyle,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontWeight: 600 }}>
          {isDirty ? t('Unsaved changes') : t('Saved settings')}
        </Text>
        <Text style={{ color: theme.pageTextSubdued }}>
          {t('Last updated: {{updatedAt}}', { updatedAt })}
        </Text>
        {statusText && (
          <Text
            style={{
              color:
                statusKind === 'error'
                  ? theme.errorText
                  : theme.noticeTextLight,
            }}
          >
            {statusText}
          </Text>
        )}
      </View>

      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button variant="primary" onPress={onSave}>
          <Trans>Save</Trans>
        </Button>
        <Button onPress={onReset}>
          <Trans>Reset to defaults</Trans>
        </Button>
        <Button onPress={onExport}>
          <Trans>Export JSON</Trans>
        </Button>
        <Button onPress={onImport}>
          <Trans>Import JSON</Trans>
        </Button>
      </View>
    </View>
  );
}

type HouseholdSectionProps = {
  members: FlowHouseholdMember[];
  accountOptions: SelectOption<string>[];
  onAdd: () => void;
  onUpdate: (id: string, fields: Partial<FlowHouseholdMember>) => void;
  onRemove: (id: string) => void;
};

function HouseholdSection({
  members,
  accountOptions,
  onAdd,
  onUpdate,
  onRemove,
}: HouseholdSectionProps) {
  const { t } = useTranslation();

  return (
    <Section
      title={t('Household')}
      description={t(
        'Global Flow members used later by Quick Entry, Flow Transactions, Settlement, Cashflow, and reports.',
      )}
      actionLabel={t('Add household member')}
      onAction={onAdd}
    >
      {members.map(member => (
        <Row key={member.id}>
          <TextField
            label={t('Name')}
            value={member.name}
            onChange={name => onUpdate(member.id, { name })}
          />
          <SelectField
            label={t('Role')}
            value={member.role}
            options={[
              ['owner', t('Owner')],
              ['partner', t('Partner')],
              ['child', t('Child')],
              ['other', t('Other')],
            ]}
            onChange={role => onUpdate(member.id, { role })}
          />
          <SelectField
            label={t('Default account')}
            value={member.defaultAccountId ?? ''}
            options={accountOptions}
            onChange={defaultAccountId =>
              onUpdate(member.id, {
                defaultAccountId: normalizeOptionalId(defaultAccountId),
              })
            }
          />
          <CheckboxField
            label={t('Active')}
            checked={member.active}
            onChange={active => onUpdate(member.id, { active })}
          />
          <RemoveButton onPress={() => onRemove(member.id)} />
        </Row>
      ))}
    </Section>
  );
}

type TransactionRulesSectionProps = {
  rules: FlowTransactionRules;
  memberOptions: SelectOption<string>[];
  onUpdate: (fields: Partial<FlowTransactionRules>) => void;
};

function TransactionRulesSection({
  rules,
  memberOptions,
  onUpdate,
}: TransactionRulesSectionProps) {
  const { t } = useTranslation();

  return (
    <Section
      title={t('Transaction Rules')}
      description={t(
        'Global defaults for future Flow transaction metadata, Quick Entry, Settlement, and Cashflow inclusion.',
      )}
    >
      <Row>
        <SelectField
          label={t('Default paid by')}
          value={rules.defaultPaidByMemberId ?? ''}
          options={memberOptions}
          onChange={defaultPaidByMemberId =>
            onUpdate({
              defaultPaidByMemberId: normalizeOptionalId(defaultPaidByMemberId),
            })
          }
        />
        <SelectField
          label={t('Default entered by')}
          value={rules.defaultEnteredByMemberId ?? ''}
          options={memberOptions}
          onChange={defaultEnteredByMemberId =>
            onUpdate({
              defaultEnteredByMemberId: normalizeOptionalId(
                defaultEnteredByMemberId,
              ),
            })
          }
        />
        <SelectField
          label={t('Default split method')}
          value={rules.defaultSplitMethod}
          options={[
            ['shared-50-50', t('Shared 50/50')],
            ['only-member', t('Only selected member')],
            ['custom', t('Custom')],
          ]}
          onChange={defaultSplitMethod => onUpdate({ defaultSplitMethod })}
        />
        <CheckboxField
          label={t('Include in cashflow by default')}
          checked={rules.defaultCashflowIncluded}
          onChange={defaultCashflowIncluded =>
            onUpdate({ defaultCashflowIncluded })
          }
        />
      </Row>
    </Section>
  );
}

type CashflowParametersSectionProps = {
  settings: FlowCashflowSettings;
  scenarioOptions: SelectOption<string>[];
  onUpdate: (fields: Partial<FlowCashflowSettings>) => void;
};

function CashflowParametersSection({
  settings,
  scenarioOptions,
  onUpdate,
}: CashflowParametersSectionProps) {
  const { t } = useTranslation();

  return (
    <Section
      title={t('Cashflow Parameters')}
      description={t(
        'Planning assumptions that the future projected Cashflow engine will consume.',
      )}
    >
      <Row>
        <MoneyField
          label={t('Minimum safe balance')}
          value={settings.minimumSafeBalance}
          onChange={minimumSafeBalance => onUpdate({ minimumSafeBalance })}
        />
        <MoneyField
          label={t('Warning balance')}
          value={settings.warningBalance}
          onChange={warningBalance => onUpdate({ warningBalance })}
        />
        <SelectField
          label={t('Projection mode')}
          value={settings.defaultProjectionMode}
          options={[
            ['current-month', t('Current month')],
            ['next-month', t('Next month')],
          ]}
          onChange={defaultProjectionMode =>
            onUpdate({ defaultProjectionMode })
          }
        />
        <SelectField
          label={t('Default scenario')}
          value={settings.defaultScenarioId}
          options={scenarioOptions}
          defaultLabel={t('Select scenario')}
          onChange={defaultScenarioId => onUpdate({ defaultScenarioId })}
        />
        <SelectField
          label={t('Starting balance mode')}
          value={settings.defaultStartingBalanceMode}
          options={[
            ['actual-accounts', t('Actual accounts')],
            ['manual', t('Manual')],
          ]}
          onChange={defaultStartingBalanceMode =>
            onUpdate({ defaultStartingBalanceMode })
          }
        />
        <CheckboxField
          label={t('Include off-budget accounts')}
          checked={settings.includeOffBudgetAccounts}
          onChange={includeOffBudgetAccounts =>
            onUpdate({ includeOffBudgetAccounts })
          }
        />
        <CheckboxField
          label={t('Include transfers')}
          checked={settings.includeTransfers}
          onChange={includeTransfers => onUpdate({ includeTransfers })}
        />
      </Row>
    </Section>
  );
}

type IncomePlanSectionProps = {
  plans: FlowIncomePlan[];
  memberOptions: SelectOption<string>[];
  accountOptions: SelectOption<string>[];
  categoryOptions: SelectOption<string>[];
  onAdd: () => void;
  onUpdate: (id: string, fields: Partial<FlowIncomePlan>) => void;
  onRemove: (id: string) => void;
};

function IncomePlanSection({
  plans,
  memberOptions,
  accountOptions,
  categoryOptions,
  onAdd,
  onUpdate,
  onRemove,
}: IncomePlanSectionProps) {
  const { t } = useTranslation();

  return (
    <Section
      title={t('Income Plan')}
      description={t(
        'Expected income rows for future projected Cashflow calculations.',
      )}
      actionLabel={t('Add income plan')}
      onAction={onAdd}
    >
      {plans.length === 0 && <EmptySection label={t('No income plans yet.')} />}
      {plans.map(plan => (
        <Row key={plan.id}>
          <TextField
            label={t('Name')}
            value={plan.name}
            onChange={name => onUpdate(plan.id, { name })}
          />
          <SelectField
            label={t('Member')}
            value={plan.memberId ?? ''}
            options={memberOptions}
            onChange={memberId =>
              onUpdate(plan.id, { memberId: normalizeOptionalId(memberId) })
            }
          />
          <MoneyField
            label={t('Amount')}
            value={plan.amount}
            onChange={amount => onUpdate(plan.id, { amount })}
          />
          <NumberField
            label={t('Day')}
            value={plan.dayOfMonth}
            min={1}
            max={31}
            onChange={dayOfMonth =>
              onUpdate(plan.id, { dayOfMonth: clampDay(dayOfMonth) })
            }
          />
          <SelectField
            label={t('Account')}
            value={plan.accountId ?? ''}
            options={accountOptions}
            onChange={accountId =>
              onUpdate(plan.id, { accountId: normalizeOptionalId(accountId) })
            }
          />
          <SelectField
            label={t('Category')}
            value={plan.categoryId ?? ''}
            options={categoryOptions}
            onChange={categoryId =>
              onUpdate(plan.id, { categoryId: normalizeOptionalId(categoryId) })
            }
          />
          <TextField
            label={t('Notes')}
            value={plan.notes ?? ''}
            onChange={notes => onUpdate(plan.id, { notes })}
          />
          <CheckboxField
            label={t('Active')}
            checked={plan.active}
            onChange={active => onUpdate(plan.id, { active })}
          />
          <CheckboxField
            label={t('Uncertain')}
            checked={Boolean(plan.uncertain)}
            onChange={uncertain => onUpdate(plan.id, { uncertain })}
          />
          <RemoveButton onPress={() => onRemove(plan.id)} />
        </Row>
      ))}
    </Section>
  );
}

type FixedBillsSectionProps = {
  bills: FlowFixedBill[];
  memberOptions: SelectOption<string>[];
  accountOptions: SelectOption<string>[];
  categoryOptions: SelectOption<string>[];
  onAdd: () => void;
  onUpdate: (id: string, fields: Partial<FlowFixedBill>) => void;
  onRemove: (id: string) => void;
};

function FixedBillsSection({
  bills,
  memberOptions,
  accountOptions,
  categoryOptions,
  onAdd,
  onUpdate,
  onRemove,
}: FixedBillsSectionProps) {
  const { t } = useTranslation();

  return (
    <Section
      title={t('Fixed Bills')}
      description={t(
        'Recurring fixed obligations that Cashflow can later project before they happen.',
      )}
      actionLabel={t('Add fixed bill')}
      onAction={onAdd}
    >
      {bills.length === 0 && <EmptySection label={t('No fixed bills yet.')} />}
      {bills.map(bill => (
        <Row key={bill.id}>
          <TextField
            label={t('Name')}
            value={bill.name}
            onChange={name => onUpdate(bill.id, { name })}
          />
          <MoneyField
            label={t('Amount')}
            value={bill.amount}
            onChange={amount => onUpdate(bill.id, { amount })}
          />
          <NumberField
            label={t('Day')}
            value={bill.dayOfMonth}
            min={1}
            max={31}
            onChange={dayOfMonth =>
              onUpdate(bill.id, { dayOfMonth: clampDay(dayOfMonth) })
            }
          />
          <SelectField
            label={t('Account')}
            value={bill.accountId ?? ''}
            options={accountOptions}
            onChange={accountId =>
              onUpdate(bill.id, { accountId: normalizeOptionalId(accountId) })
            }
          />
          <SelectField
            label={t('Category')}
            value={bill.categoryId ?? ''}
            options={categoryOptions}
            onChange={categoryId =>
              onUpdate(bill.id, { categoryId: normalizeOptionalId(categoryId) })
            }
          />
          <SelectField
            label={t('Split method')}
            value={bill.splitMethod}
            options={[
              ['shared-50-50', t('Shared 50/50')],
              ['only-member', t('Only selected member')],
              ['custom', t('Custom')],
            ]}
            onChange={splitMethod => onUpdate(bill.id, { splitMethod })}
          />
          <SelectField
            label={t('Member')}
            value={bill.memberId ?? ''}
            options={memberOptions}
            onChange={memberId =>
              onUpdate(bill.id, { memberId: normalizeOptionalId(memberId) })
            }
          />
          <TextField
            label={t('Notes')}
            value={bill.notes ?? ''}
            onChange={notes => onUpdate(bill.id, { notes })}
          />
          <CheckboxField
            label={t('Active')}
            checked={bill.active}
            onChange={active => onUpdate(bill.id, { active })}
          />
          <RemoveButton onPress={() => onRemove(bill.id)} />
        </Row>
      ))}
    </Section>
  );
}

type VariableSpendingSectionProps = {
  rules: FlowVariableSpendingRule[];
  categoryOptions: SelectOption<string>[];
  onAdd: () => void;
  onUpdate: (id: string, fields: Partial<FlowVariableSpendingRule>) => void;
  onRemove: (id: string) => void;
};

function VariableSpendingSection({
  rules,
  categoryOptions,
  onAdd,
  onUpdate,
  onRemove,
}: VariableSpendingSectionProps) {
  const { t } = useTranslation();

  return (
    <Section
      title={t('Variable Spending')}
      description={t(
        'Variable spending assumptions for categories that are not fixed bills.',
      )}
      actionLabel={t('Add variable spending rule')}
      onAction={onAdd}
    >
      {rules.length === 0 && (
        <EmptySection label={t('No variable spending rules yet.')} />
      )}
      {rules.map(rule => (
        <Row key={rule.id}>
          <TextField
            label={t('Name')}
            value={rule.name}
            onChange={name => onUpdate(rule.id, { name })}
          />
          <SelectField
            label={t('Category')}
            value={rule.categoryId ?? ''}
            options={categoryOptions}
            onChange={categoryId =>
              onUpdate(rule.id, { categoryId: normalizeOptionalId(categoryId) })
            }
          />
          <MoneyField
            label={t('Monthly budget')}
            value={rule.monthlyBudget}
            onChange={monthlyBudget => onUpdate(rule.id, { monthlyBudget })}
          />
          <SelectField
            label={t('Forecast method')}
            value={rule.forecastMethod}
            options={[
              ['daily-spread', t('Daily spread')],
              ['weekly-spread', t('Weekly spread')],
              ['one-reserve', t('One reserve')],
              ['manual', t('Manual')],
            ]}
            onChange={forecastMethod => onUpdate(rule.id, { forecastMethod })}
          />
          <NumberField
            label={t('Budget weight')}
            value={rule.budgetWeight}
            min={0}
            step={0.1}
            onChange={budgetWeight => onUpdate(rule.id, { budgetWeight })}
          />
          <TextField
            label={t('Notes')}
            value={rule.notes ?? ''}
            onChange={notes => onUpdate(rule.id, { notes })}
          />
          <CheckboxField
            label={t('Active')}
            checked={rule.active}
            onChange={active => onUpdate(rule.id, { active })}
          />
          <RemoveButton onPress={() => onRemove(rule.id)} />
        </Row>
      ))}
    </Section>
  );
}

type ScenariosSectionProps = {
  scenarios: FlowScenario[];
  onAdd: () => void;
  onUpdate: (id: string, fields: Partial<FlowScenario>) => void;
  onRemove: (id: string) => void;
};

function ScenariosSection({
  scenarios,
  onAdd,
  onUpdate,
  onRemove,
}: ScenariosSectionProps) {
  const { t } = useTranslation();

  return (
    <Section
      title={t('Scenarios')}
      description={t(
        'Reusable planning scenarios for future Cashflow, Affordability, Monthly Overview, and Monthly Close views.',
      )}
      actionLabel={t('Add scenario')}
      onAction={onAdd}
    >
      {scenarios.map(scenario => (
        <Row key={scenario.id}>
          <TextField
            label={t('Name')}
            value={scenario.name}
            onChange={name => onUpdate(scenario.id, { name })}
          />
          <SelectField
            label={t('Type')}
            value={scenario.type}
            options={[
              ['base', t('Base')],
              ['stress', t('Stress')],
              ['custom', t('Custom')],
            ]}
            onChange={type => onUpdate(scenario.id, { type })}
          />
          <NumberField
            label={t('Income multiplier')}
            value={scenario.incomeMultiplier}
            min={0}
            step={0.05}
            onChange={incomeMultiplier =>
              onUpdate(scenario.id, { incomeMultiplier })
            }
          />
          <NumberField
            label={t('Expense multiplier')}
            value={scenario.expenseMultiplier}
            min={0}
            step={0.05}
            onChange={expenseMultiplier =>
              onUpdate(scenario.id, { expenseMultiplier })
            }
          />
          <NumberField
            label={t('Savings multiplier')}
            value={scenario.savingsMultiplier}
            min={0}
            step={0.05}
            onChange={savingsMultiplier =>
              onUpdate(scenario.id, { savingsMultiplier })
            }
          />
          <TextField
            label={t('Notes')}
            value={scenario.notes ?? ''}
            onChange={notes => onUpdate(scenario.id, { notes })}
          />
          <CheckboxField
            label={t('Active')}
            checked={scenario.active}
            onChange={active => onUpdate(scenario.id, { active })}
          />
          <RemoveButton onPress={() => onRemove(scenario.id)} />
        </Row>
      ))}
    </Section>
  );
}

type JsonPanelProps = {
  value: string;
  onChange: (value: string) => void;
  onExport: () => void;
  onImport: () => void;
};

function JsonPanel({ value, onChange, onExport, onImport }: JsonPanelProps) {
  const { t } = useTranslation();

  return (
    <Section
      title={t('JSON Import / Export')}
      description={t(
        'Temporary local storage can be backed up or moved between browsers with this JSON.',
      )}
    >
      <textarea
        aria-label={t('Flow settings JSON')}
        value={value}
        onChange={event => onChange(event.currentTarget.value)}
        style={{
          ...baseInputStyle,
          minHeight: 220,
          resize: 'vertical',
          width: '100%',
          whiteSpace: 'pre',
          overflow: 'auto',
          ...styles.tnum,
        }}
      />
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Button onPress={onExport}>
          <Trans>Export JSON</Trans>
        </Button>
        <Button onPress={onImport}>
          <Trans>Import JSON</Trans>
        </Button>
      </View>
    </Section>
  );
}

type SectionProps = {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  children: ReactNode;
};

function Section({
  title,
  description,
  actionLabel,
  onAction,
  children,
}: SectionProps) {
  return (
    <View style={sectionStyle}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: 600 }}>{title}</Text>
          <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.4 }}>
            {description}
          </Text>
        </View>
        {actionLabel && onAction && (
          <Button onPress={onAction}>{actionLabel}</Button>
        )}
      </View>
      <View style={{ gap: 10 }}>{children}</View>
    </View>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <View style={rowStyle}>{children}</View>;
}

function NoticePanel({
  children,
  tone = 'info',
}: {
  children: ReactNode;
  tone?: 'info' | 'warning';
}) {
  return (
    <View
      style={{
        border: `1px solid ${
          tone === 'warning' ? theme.warningText : theme.tableBorder
        }`,
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

function EmptySection({ label }: { label: string }) {
  return (
    <Text style={{ color: theme.pageTextSubdued, fontStyle: 'italic' }}>
      {label}
    </Text>
  );
}

type TextFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
};

function TextField({ label, value, onChange }: TextFieldProps) {
  return (
    <Field label={label}>
      <Input
        aria-label={label}
        value={value}
        onChangeValue={onChange}
        style={{ width: '100%' }}
      />
    </Field>
  );
}

type MoneyFieldProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
};

function MoneyField({ label, value, onChange }: MoneyFieldProps) {
  return (
    <Field label={label}>
      <FinancialInput
        aria-label={label}
        value={value}
        onChangeValue={onChange}
        onUpdate={onChange}
        style={{ width: '100%' }}
      />
    </Field>
  );
}

type NumberFieldProps = {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
};

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: NumberFieldProps) {
  return (
    <Field label={label}>
      <Input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={String(value)}
        onChangeValue={newValue => onChange(parseNumber(newValue, value))}
        style={{ width: '100%', ...styles.tnum }}
      />
    </Field>
  );
}

type SelectFieldProps<Value extends string> = {
  label: string;
  value: Value;
  options: SelectOption<Value>[];
  defaultLabel?: string;
  onChange: (value: Value) => void;
};

function SelectField<Value extends string>({
  label,
  value,
  options,
  defaultLabel,
  onChange,
}: SelectFieldProps<Value>) {
  return (
    <Field label={label}>
      <Select
        value={value}
        options={options}
        defaultLabel={defaultLabel}
        onChange={onChange}
        style={{ width: '100%' }}
      />
    </Field>
  );
}

type CheckboxFieldProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function CheckboxField({ label, checked, onChange }: CheckboxFieldProps) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        color: theme.pageText,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.currentTarget.checked)}
      />
      <Text>{label}</Text>
    </label>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={{ gap: 4, minWidth: 0 }}>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function RemoveButton({ onPress }: { onPress: () => void }) {
  return (
    <View style={{ justifyContent: 'end' }}>
      <Button variant="bare" onPress={onPress}>
        <Trans>Remove</Trans>
      </Button>
    </View>
  );
}

function updateItem<T extends { id: string }>(
  items: T[],
  id: string,
  fields: Partial<T>,
): T[] {
  return items.map(item => (item.id === id ? { ...item, ...fields } : item));
}

function removeItem<T extends { id: string }>(items: T[], id: string): T[] {
  return items.filter(item => item.id !== id);
}

function createSelectOption(
  value: string,
  label: string,
): SelectOption<string> {
  return [value, label];
}

function normalizeOptionalId(value: string): string | undefined {
  return value === '' ? undefined : value;
}

function parseNumber(value: string, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampDay(value: number): number {
  return Math.max(1, Math.min(31, Math.round(value)));
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  return 'Unknown error';
}

function getStatusText(
  status: StatusState,
  t: ReturnType<typeof useTranslation>['t'],
): string {
  switch (status.kind) {
    case 'saved':
      return t('Flow settings saved.');
    case 'reset':
      return t('Flow settings reset to defaults.');
    case 'exported':
      return t('Flow settings JSON is ready to copy or import.');
    case 'imported':
      return t('Flow settings imported and saved.');
    case 'error':
      return t('Flow settings error: {{message}}', {
        message: status.message,
      });
    default:
      return t('Flow settings status is unavailable.');
  }
}

const sectionStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.tableBackground,
  padding: 16,
  gap: 14,
};

const rowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 12,
  alignItems: 'end',
  borderTop: `1px solid ${theme.tableBorder}`,
  paddingTop: 12,
};
