import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import {
  SvgCheckCircle1,
  SvgInformationCircle,
} from '@actual-app/components/icons/v2';
import { baseInputStyle, Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import type { SelectOption } from '@actual-app/components/select';
import { styles } from '@actual-app/components/styles';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';
import { keyframes } from '@emotion/css';
import { format as formatDate, parseISO } from 'date-fns';

import { Page } from '#components/Page';
import { FinancialInput } from '#components/util/FinancialInput';
import { useAccounts } from '#hooks/useAccounts';
import { useCategories } from '#hooks/useCategories';
import { useDateFormat } from '#hooks/useDateFormat';
import { useFormat } from '#hooks/useFormat';

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
  | { kind: 'saved' | 'autosaved' | 'reset' | 'exported' | 'imported' }
  | { kind: 'error'; message: string };

type TranslationFn = ReturnType<typeof useTranslation>['t'];

export function FlowSettingsPage() {
  const { t } = useTranslation();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const format = useFormat();
  const accountsQuery = useAccounts();
  const categoriesQuery = useCategories();
  const [settings, setSettings] = useState<FlowSettings>(() =>
    createDefaultFlowSettings(),
  );
  const [jsonBuffer, setJsonBuffer] = useState('');
  const [status, setStatus] = useState<StatusState | null>(null);
  const [isDirty, setDirty] = useState(false);
  const [isLoaded, setLoaded] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function loadSettings() {
      try {
        const loadedSettings = await getFlowSettings();
        if (isMounted) {
          setSettings(loadedSettings);
          setJsonBuffer(exportFlowSettings(loadedSettings));
          setLastSavedAt(loadedSettings.updatedAt);
          setLoaded(true);
        }
      } catch (error) {
        if (isMounted) {
          setStatus({ kind: 'error', message: getErrorMessage(error) });
          setLoaded(true);
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
  const formatAmount = (amount: number) => format(amount, 'financial');

  function updateSettings(updater: (current: FlowSettings) => FlowSettings) {
    setSettings(current => updater(current));
    setDirty(true);
    setStatus(null);
  }

  useEffect(() => {
    if (!isLoaded || !isDirty) {
      return;
    }

    let isCancelled = false;
    const timeout = setTimeout(() => {
      setSaving(true);

      void saveFlowSettings(settings)
        .then(savedSettings => {
          if (isCancelled) {
            return;
          }

          setSettings(savedSettings);
          setJsonBuffer(exportFlowSettings(savedSettings));
          setDirty(false);
          setStatus({ kind: 'autosaved' });
          setLastSavedAt(savedSettings.updatedAt);
        })
        .catch(error => {
          if (!isCancelled) {
            setStatus({ kind: 'error', message: getErrorMessage(error) });
          }
        })
        .finally(() => {
          if (!isCancelled) {
            setSaving(false);
          }
        });
    }, 2500);

    return () => {
      isCancelled = true;
      clearTimeout(timeout);
    };
  }, [isDirty, isLoaded, settings]);

  async function handleSave() {
    try {
      setSaving(true);
      const savedSettings = await saveFlowSettings(settings);
      setSettings(savedSettings);
      setJsonBuffer(exportFlowSettings(savedSettings));
      setDirty(false);
      setStatus({ kind: 'saved' });
      setLastSavedAt(savedSettings.updatedAt);
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    try {
      setSaving(true);
      const defaultSettings = await resetFlowSettings();
      setSettings(defaultSettings);
      setJsonBuffer(exportFlowSettings(defaultSettings));
      setDirty(false);
      setStatus({ kind: 'reset' });
      setLastSavedAt(defaultSettings.updatedAt);
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  async function handleImport() {
    const parsed = parseFlowSettingsJson(jsonBuffer);

    if (parsed.ok === false) {
      setStatus({ kind: 'error', message: parsed.error });
      return;
    }

    try {
      setSaving(true);
      const savedSettings = await saveFlowSettings(parsed.settings);
      setSettings(savedSettings);
      setJsonBuffer(exportFlowSettings(savedSettings));
      setDirty(false);
      setStatus({ kind: 'imported' });
      setLastSavedAt(savedSettings.updatedAt);
    } catch (error) {
      setStatus({ kind: 'error', message: getErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  }

  function handleExport() {
    setJsonBuffer(exportFlowSettings(settings));
    setStatus({ kind: 'exported' });
  }

  return (
    <Page header={t('Flow Settings')}>
      <View
        style={{
          width: '100%',
          maxWidth: 1180,
          alignSelf: 'center',
          gap: 20,
          minHeight: 'auto',
          paddingTop: 16,
          paddingBottom: 80,
        }}
      >
        <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.5 }}>
          <Trans>
            Configure global Flow settings and planning assumptions without
            changing Actual account, transaction, budget, or sync data.
          </Trans>
        </Text>

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
          isSaving={isSaving}
          statusText={statusText}
          statusKind={status?.kind}
          savedAt={lastSavedAt ?? settings.updatedAt}
          dateFormat={dateFormat}
          onSave={handleSave}
          onReset={handleReset}
          onExport={handleExport}
          onImport={handleImport}
        />

        <HouseholdSection
          members={settings.householdMembers}
          accountOptions={accountOptions}
          onAdd={() => {
            const member = createHouseholdMember({ name: t('New member') });

            updateSettings(current => ({
              ...current,
              householdMembers: [...current.householdMembers, member],
            }));

            return member.id;
          }}
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
          formatAmount={formatAmount}
          onAdd={() => {
            const plan = createIncomePlan({ name: t('New income') });

            updateSettings(current => ({
              ...current,
              incomePlans: [...current.incomePlans, plan],
            }));

            return plan.id;
          }}
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
          formatAmount={formatAmount}
          onAdd={() => {
            const bill = createFixedBill({ name: t('New fixed bill') });

            updateSettings(current => ({
              ...current,
              fixedBills: [...current.fixedBills, bill],
            }));

            return bill.id;
          }}
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
          formatAmount={formatAmount}
          onAdd={() => {
            const rule = createVariableSpendingRule({
              name: t('New variable rule'),
            });

            updateSettings(current => ({
              ...current,
              variableSpendingRules: [...current.variableSpendingRules, rule],
            }));

            return rule.id;
          }}
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
          onAdd={() => {
            const scenario = createScenario({ name: t('New scenario') });

            updateSettings(current => ({
              ...current,
              scenarios: [...current.scenarios, scenario],
            }));

            return scenario.id;
          }}
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
          statusKind={status?.kind}
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
  isSaving: boolean;
  statusText: string | null;
  statusKind?: StatusState['kind'];
  savedAt: string | null;
  dateFormat: string;
  onSave: () => void;
  onReset: () => void;
  onExport: () => void;
  onImport: () => void;
};

function ActionBar({
  isDirty,
  isSaving,
  statusText,
  statusKind,
  savedAt,
  dateFormat,
  onSave,
  onReset,
  onExport,
  onImport,
}: ActionBarProps) {
  const { t } = useTranslation();

  return (
    <View
      style={{
        ...actionBarStyle,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 18,
        flexWrap: 'wrap',
      }}
    >
      <View style={{ gap: 8, flexGrow: 1, flexShrink: 1, flexBasis: 420 }}>
        <Text style={{ fontWeight: 600 }}>
          {isDirty ? t('Unsaved changes') : t('Saved settings')}
        </Text>
        <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.45 }}>
          <Trans>
            Flow Settings is currently stored locally on this browser. Shared
            sync storage will be added in a later task.
          </Trans>
        </Text>
        <SaveIndicator
          isDirty={isDirty}
          isSaving={isSaving}
          savedAt={savedAt}
          dateFormat={dateFormat}
          statusKind={statusKind}
          statusText={statusText}
        />
      </View>

      <View
        style={{
          flexDirection: 'row',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          flexGrow: 1,
          flexShrink: 1,
          flexBasis: 320,
        }}
      >
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

type SaveIndicatorProps = {
  isDirty: boolean;
  isSaving: boolean;
  savedAt: string | null;
  dateFormat: string;
  statusKind?: StatusState['kind'];
  statusText: string | null;
};

function SaveIndicator({
  isDirty,
  isSaving,
  savedAt,
  dateFormat,
  statusKind,
  statusText,
}: SaveIndicatorProps) {
  const { t } = useTranslation();
  const savedAtText = formatTimestamp(savedAt, dateFormat);

  if (statusKind === 'error') {
    return (
      <Text style={{ color: theme.errorText, lineHeight: 1.4 }}>
        {statusText}
      </Text>
    );
  }

  if (isSaving) {
    return (
      <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.4 }}>
        <Trans>Saving changes...</Trans>
      </Text>
    );
  }

  if (isDirty) {
    return (
      <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.4 }}>
        <Trans>Unsaved changes. Autosaves after a short pause.</Trans>
      </Text>
    );
  }

  return (
    <View
      style={{
        ...savedIndicatorStyle,
        animationName: savedPulseAnimation,
        animationDuration: '650ms',
        animationTimingFunction: 'ease-out',
      }}
    >
      <SvgCheckCircle1 width={14} height={14} />
      <Text style={{ color: theme.noticeTextLight }}>
        {statusKind === 'autosaved'
          ? t('Autosaved at {{savedAt}}', { savedAt: savedAtText })
          : t('Saved at {{savedAt}}', { savedAt: savedAtText })}
      </Text>
      {statusText &&
        !['saved', 'autosaved'].includes(statusKind ?? 'saved') && (
          <Text style={{ color: theme.pageTextSubdued }}>{statusText}</Text>
        )}
    </View>
  );
}

type HouseholdSectionProps = {
  members: FlowHouseholdMember[];
  accountOptions: SelectOption<string>[];
  onAdd: () => string;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingMember = members.find(member => member.id === editingId);

  function handleAdd() {
    setEditingId(onAdd());
  }

  function handleRemove(id: string) {
    onRemove(id);
    if (editingId === id) {
      setEditingId(null);
    }
  }

  return (
    <Section
      title={t('Household')}
      description={t(
        'Household members can later be used for who paid, who entered a transaction, and split/settlement rules.',
      )}
      actionLabel={t('Add household member')}
      onAction={handleAdd}
    >
      <EditableListTable
        items={members.filter(member => member.id !== editingId)}
        emptyLabel={editingMember ? null : t('No household members yet.')}
        columns={[
          {
            key: 'name',
            label: t('Name'),
            help: t(
              'The display name used throughout Flow when assigning who paid, who entered a transaction, or who a rule belongs to.',
            ),
            render: member => member.name || t('Unnamed member'),
          },
          {
            key: 'role',
            label: t('Role'),
            help: t(
              'A planning label for the person. Owner and partner are useful for household-level planning; child and other can be used for dependents or special cases.',
            ),
            render: member => getRoleLabel(member.role, t),
          },
          {
            key: 'account',
            label: t('Default account'),
            help: t(
              'Optional account Flow can preselect for this member in future quick-entry and planning forms.',
            ),
            render: member =>
              getOptionLabel(
                accountOptions,
                member.defaultAccountId,
                t('No linked account'),
              ),
          },
          {
            key: 'active',
            label: t('Active'),
            help: t(
              'Inactive members stay in saved settings but should be hidden from future day-to-day entry defaults.',
            ),
            render: member => formatBoolean(member.active, t),
          },
        ]}
        onEdit={member => setEditingId(member.id)}
        onRemove={member => handleRemove(member.id)}
      />

      {editingMember && (
        <ItemCard
          title={editingMember.name || t('Household member')}
          saveLabel={t('Save household member')}
          onSave={() => setEditingId(null)}
          onRemove={() => handleRemove(editingMember.id)}
        >
          <FieldGrid>
            <TextField
              label={t('Name')}
              help={t(
                'Use the short name the household recognizes. This becomes the label in Flow assignment fields.',
              )}
              value={editingMember.name}
              onChange={name => onUpdate(editingMember.id, { name })}
            />
            <SelectField
              label={t('Role')}
              help={t(
                'Choose the member type. This does not affect Actual data; it only helps Flow defaults and future settlement logic.',
              )}
              value={editingMember.role}
              options={[
                ['owner', t('Owner')],
                ['partner', t('Partner')],
                ['child', t('Child')],
                ['other', t('Other')],
              ]}
              onChange={role => onUpdate(editingMember.id, { role })}
            />
            <SelectField
              label={t('Default account')}
              help={t(
                'Pick the Actual account normally used by this person. Leave blank when no person-specific account should be assumed.',
              )}
              value={editingMember.defaultAccountId ?? ''}
              options={accountOptions}
              onChange={defaultAccountId =>
                onUpdate(editingMember.id, {
                  defaultAccountId: normalizeOptionalId(defaultAccountId),
                })
              }
            />
            <CheckboxField
              label={t('Active')}
              help={t(
                'Keep this enabled for people who should appear in future Flow entry and planning choices.',
              )}
              checked={editingMember.active}
              onChange={active => onUpdate(editingMember.id, { active })}
            />
          </FieldGrid>
        </ItemCard>
      )}
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
        'These defaults will later be used by Quick Entry, Flow Transactions, Settlement, and Cashflow.',
      )}
    >
      <FieldGrid>
        <SelectField
          label={t('Default paid by')}
          help={t(
            'The member Flow should assume paid a transaction when a future Flow entry form does not specify a payer.',
          )}
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
          help={t(
            'The member Flow should assume entered the transaction. This can be different from who paid.',
          )}
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
          help={t(
            'The default household split for future Flow transactions. Shared 50/50 divides the cost evenly; only selected member assigns it to one person; custom is a placeholder for later detailed split rules.',
          )}
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
          help={t(
            'When enabled, future Flow-created transactions should count toward projected cashflow unless a specific transaction opts out.',
          )}
          checked={rules.defaultCashflowIncluded}
          onChange={defaultCashflowIncluded =>
            onUpdate({ defaultCashflowIncluded })
          }
        />
      </FieldGrid>
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
        'These settings define how Flow will later build projected monthly cashflow.',
      )}
    >
      <FieldGrid>
        <MoneyField
          label={t('Minimum safe balance')}
          help={t(
            'The lowest account balance you consider safe. Future cashflow views can use this as the red-line threshold for runway and shortfall warnings.',
          )}
          value={settings.minimumSafeBalance}
          onChange={minimumSafeBalance => onUpdate({ minimumSafeBalance })}
        />
        <MoneyField
          label={t('Warning balance')}
          help={t(
            'The caution threshold above the minimum safe balance. Future projections can warn before balances become critical.',
          )}
          value={settings.warningBalance}
          onChange={warningBalance => onUpdate({ warningBalance })}
        />
        <SelectField
          label={t('Projection mode')}
          help={t(
            'Controls the default month future cashflow tools should open with. Current month focuses on now; next month starts planning one month ahead.',
          )}
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
          help={t(
            'The scenario Flow should use first when future forecast screens open. Scenarios are still simple multipliers until the Scenario Builder task.',
          )}
          value={settings.defaultScenarioId}
          options={scenarioOptions}
          defaultLabel={t('Select scenario')}
          onChange={defaultScenarioId => onUpdate({ defaultScenarioId })}
        />
        <SelectField
          label={t('Starting balance mode')}
          help={t(
            'Actual accounts starts forecasts from current Actual balances. Manual is reserved for later forecast tools where a custom starting balance can be entered.',
          )}
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
          help={t(
            'When enabled later, Flow can include off-budget accounts such as savings, loans, or investment accounts in planning calculations.',
          )}
          checked={settings.includeOffBudgetAccounts}
          onChange={includeOffBudgetAccounts =>
            onUpdate({ includeOffBudgetAccounts })
          }
        />
        <CheckboxField
          label={t('Include transfers')}
          help={t(
            'When enabled later, account transfers can appear in cashflow projections instead of being ignored as internal movement.',
          )}
          checked={settings.includeTransfers}
          onChange={includeTransfers => onUpdate({ includeTransfers })}
        />
      </FieldGrid>
    </Section>
  );
}

type IncomePlanSectionProps = {
  plans: FlowIncomePlan[];
  memberOptions: SelectOption<string>[];
  accountOptions: SelectOption<string>[];
  categoryOptions: SelectOption<string>[];
  formatAmount: (amount: number) => string;
  onAdd: () => string;
  onUpdate: (id: string, fields: Partial<FlowIncomePlan>) => void;
  onRemove: (id: string) => void;
};

function IncomePlanSection({
  plans,
  memberOptions,
  accountOptions,
  categoryOptions,
  formatAmount,
  onAdd,
  onUpdate,
  onRemove,
}: IncomePlanSectionProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingPlan = plans.find(plan => plan.id === editingId);

  function handleAdd() {
    setEditingId(onAdd());
  }

  function handleRemove(id: string) {
    onRemove(id);
    if (editingId === id) {
      setEditingId(null);
    }
  }

  return (
    <Section
      title={t('Income Plan')}
      description={t(
        'Expected income rows for future projected Cashflow calculations.',
      )}
      actionLabel={t('Add income plan')}
      onAction={handleAdd}
    >
      <EditableListTable
        items={plans.filter(plan => plan.id !== editingId)}
        emptyLabel={editingPlan ? null : t('No income plans yet.')}
        columns={[
          {
            key: 'name',
            label: t('Name'),
            help: t(
              'A recognizable label for the income source, such as salary, freelance payment, or reimbursement.',
            ),
            render: plan => plan.name || t('Unnamed income'),
          },
          {
            key: 'amount',
            label: t('Amount'),
            align: 'right',
            help: t(
              'The expected amount in Actual currency units. Flow stores this like other Actual financial values and will later use it in cashflow forecasts.',
            ),
            render: plan => formatAmount(plan.amount),
          },
          {
            key: 'day',
            label: t('Day'),
            align: 'right',
            help: t(
              'The day of the month this income is expected. Values are clamped from 1 to 31.',
            ),
            render: plan => String(plan.dayOfMonth),
          },
          {
            key: 'member',
            label: t('Member'),
            help: t(
              'Optional household member associated with this income source.',
            ),
            render: plan =>
              getOptionLabel(
                memberOptions,
                plan.memberId,
                t('No default member'),
              ),
          },
          {
            key: 'account',
            label: t('Account'),
            help: t('Optional Actual account where this income usually lands.'),
            render: plan =>
              getOptionLabel(
                accountOptions,
                plan.accountId,
                t('No linked account'),
              ),
          },
          {
            key: 'category',
            label: t('Category'),
            help: t(
              'Optional Actual category to associate with this planned income.',
            ),
            render: plan =>
              getOptionLabel(
                categoryOptions,
                plan.categoryId,
                t('No linked category'),
              ),
          },
          {
            key: 'flags',
            label: t('Status'),
            help: t(
              'Shows whether the income is active and whether the amount or timing is uncertain.',
            ),
            render: plan =>
              [
                formatActive(plan.active, t),
                plan.uncertain ? t('Uncertain') : null,
              ]
                .filter(Boolean)
                .join(' · '),
          },
        ]}
        onEdit={plan => setEditingId(plan.id)}
        onRemove={plan => handleRemove(plan.id)}
      />

      {editingPlan && (
        <ItemCard
          title={editingPlan.name || t('Income plan')}
          saveLabel={t('Save income plan')}
          onSave={() => setEditingId(null)}
          onRemove={() => handleRemove(editingPlan.id)}
        >
          <FieldGrid>
            <TextField
              label={t('Name')}
              help={t(
                'Name the income in plain language so the compact row is easy to scan later.',
              )}
              value={editingPlan.name}
              onChange={name => onUpdate(editingPlan.id, { name })}
            />
            <MoneyField
              label={t('Amount')}
              help={t(
                'Enter the expected incoming amount. This is saved as a planning assumption only and does not create an Actual transaction.',
              )}
              value={editingPlan.amount}
              onChange={amount => onUpdate(editingPlan.id, { amount })}
            />
            <NumberField
              label={t('Day of month')}
              help={t(
                'Use the expected calendar day for this income. If the real date varies, mark the row as uncertain.',
              )}
              value={editingPlan.dayOfMonth}
              min={1}
              max={31}
              onChange={dayOfMonth =>
                onUpdate(editingPlan.id, {
                  dayOfMonth: clampDay(dayOfMonth),
                })
              }
            />
            <SelectField
              label={t('Member')}
              help={t(
                'Choose who this income belongs to. Leave blank when it applies to the household rather than a specific person.',
              )}
              value={editingPlan.memberId ?? ''}
              options={memberOptions}
              onChange={memberId =>
                onUpdate(editingPlan.id, {
                  memberId: normalizeOptionalId(memberId),
                })
              }
            />
            <SelectField
              label={t('Account')}
              help={t(
                'Choose the account where the income usually arrives. This is used only as a Flow default for future projections.',
              )}
              value={editingPlan.accountId ?? ''}
              options={accountOptions}
              onChange={accountId =>
                onUpdate(editingPlan.id, {
                  accountId: normalizeOptionalId(accountId),
                })
              }
            />
            <SelectField
              label={t('Category')}
              help={t(
                'Choose the category that best represents this income source for future reports and forecasts.',
              )}
              value={editingPlan.categoryId ?? ''}
              options={categoryOptions}
              onChange={categoryId =>
                onUpdate(editingPlan.id, {
                  categoryId: normalizeOptionalId(categoryId),
                })
              }
            />
            <TextField
              label={t('Notes')}
              help={t(
                'Optional context such as employer, payment rules, or why the amount is uncertain.',
              )}
              value={editingPlan.notes ?? ''}
              onChange={notes => onUpdate(editingPlan.id, { notes })}
              wide
            />
            <CheckboxField
              label={t('Active')}
              help={t(
                'Disable this when the income should remain saved but no longer be included by default in future planning.',
              )}
              checked={editingPlan.active}
              onChange={active => onUpdate(editingPlan.id, { active })}
            />
            <CheckboxField
              label={t('Uncertain')}
              help={t(
                'Mark income as uncertain when the amount or timing is not guaranteed. Future forecasts can treat it differently.',
              )}
              checked={Boolean(editingPlan.uncertain)}
              onChange={uncertain => onUpdate(editingPlan.id, { uncertain })}
            />
          </FieldGrid>
        </ItemCard>
      )}
    </Section>
  );
}

type FixedBillsSectionProps = {
  bills: FlowFixedBill[];
  memberOptions: SelectOption<string>[];
  accountOptions: SelectOption<string>[];
  categoryOptions: SelectOption<string>[];
  formatAmount: (amount: number) => string;
  onAdd: () => string;
  onUpdate: (id: string, fields: Partial<FlowFixedBill>) => void;
  onRemove: (id: string) => void;
};

function FixedBillsSection({
  bills,
  memberOptions,
  accountOptions,
  categoryOptions,
  formatAmount,
  onAdd,
  onUpdate,
  onRemove,
}: FixedBillsSectionProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingBill = bills.find(bill => bill.id === editingId);

  function handleAdd() {
    setEditingId(onAdd());
  }

  function handleRemove(id: string) {
    onRemove(id);
    if (editingId === id) {
      setEditingId(null);
    }
  }

  return (
    <Section
      title={t('Fixed Bills')}
      description={t(
        'Recurring fixed obligations that Cashflow can later project before they happen.',
      )}
      actionLabel={t('Add fixed bill')}
      onAction={handleAdd}
    >
      <EditableListTable
        items={bills.filter(bill => bill.id !== editingId)}
        emptyLabel={editingBill ? null : t('No fixed bills yet.')}
        columns={[
          {
            key: 'name',
            label: t('Name'),
            help: t(
              'A recurring obligation such as rent, mortgage, insurance, utilities, or loan payment.',
            ),
            render: bill => bill.name || t('Unnamed fixed bill'),
          },
          {
            key: 'amount',
            label: t('Amount'),
            align: 'right',
            help: t(
              'The expected recurring amount. Flow stores it as a planning assumption and does not create a transaction.',
            ),
            render: bill => formatAmount(bill.amount),
          },
          {
            key: 'day',
            label: t('Day'),
            align: 'right',
            help: t('The day of the month this bill is expected to hit.'),
            render: bill => String(bill.dayOfMonth),
          },
          {
            key: 'account',
            label: t('Account'),
            help: t('Optional Actual account normally used for this bill.'),
            render: bill =>
              getOptionLabel(
                accountOptions,
                bill.accountId,
                t('No linked account'),
              ),
          },
          {
            key: 'category',
            label: t('Category'),
            help: t('Optional Actual category normally used for this bill.'),
            render: bill =>
              getOptionLabel(
                categoryOptions,
                bill.categoryId,
                t('No linked category'),
              ),
          },
          {
            key: 'split',
            label: t('Split'),
            help: t(
              'How the bill should be allocated between household members in later settlement and reporting tools.',
            ),
            render: bill => getSplitMethodLabel(bill.splitMethod, t),
          },
          {
            key: 'active',
            label: t('Active'),
            help: t(
              'Inactive bills stay saved but should not be included by default in future projections.',
            ),
            render: bill => formatBoolean(bill.active, t),
          },
        ]}
        onEdit={bill => setEditingId(bill.id)}
        onRemove={bill => handleRemove(bill.id)}
      />

      {editingBill && (
        <ItemCard
          title={editingBill.name || t('Fixed bill')}
          saveLabel={t('Save fixed bill')}
          onSave={() => setEditingId(null)}
          onRemove={() => handleRemove(editingBill.id)}
        >
          <FieldGrid>
            <TextField
              label={t('Name')}
              help={t(
                'Name the recurring bill so the compact table stays clear.',
              )}
              value={editingBill.name}
              onChange={name => onUpdate(editingBill.id, { name })}
            />
            <MoneyField
              label={t('Amount')}
              help={t(
                'Enter the recurring amount expected for this bill. Use the normal Actual currency format.',
              )}
              value={editingBill.amount}
              onChange={amount => onUpdate(editingBill.id, { amount })}
            />
            <NumberField
              label={t('Day of month')}
              help={t(
                'Use the expected due or withdrawal day. Values are clamped from 1 to 31.',
              )}
              value={editingBill.dayOfMonth}
              min={1}
              max={31}
              onChange={dayOfMonth =>
                onUpdate(editingBill.id, {
                  dayOfMonth: clampDay(dayOfMonth),
                })
              }
            />
            <SelectField
              label={t('Account')}
              help={t(
                'Choose the account this bill is usually paid from. Leave blank when it varies.',
              )}
              value={editingBill.accountId ?? ''}
              options={accountOptions}
              onChange={accountId =>
                onUpdate(editingBill.id, {
                  accountId: normalizeOptionalId(accountId),
                })
              }
            />
            <SelectField
              label={t('Category')}
              help={t(
                'Choose the category this bill should map to in future projections and reports.',
              )}
              value={editingBill.categoryId ?? ''}
              options={categoryOptions}
              onChange={categoryId =>
                onUpdate(editingBill.id, {
                  categoryId: normalizeOptionalId(categoryId),
                })
              }
            />
            <SelectField
              label={t('Split method')}
              help={t(
                'Choose how this bill should be allocated. Custom is reserved for more detailed split rules later.',
              )}
              value={editingBill.splitMethod}
              options={[
                ['shared-50-50', t('Shared 50/50')],
                ['only-member', t('Only selected member')],
                ['custom', t('Custom')],
              ]}
              onChange={splitMethod =>
                onUpdate(editingBill.id, { splitMethod })
              }
            />
            <SelectField
              label={t('Member')}
              help={t(
                'Choose the member responsible when the split method needs a selected person.',
              )}
              value={editingBill.memberId ?? ''}
              options={memberOptions}
              onChange={memberId =>
                onUpdate(editingBill.id, {
                  memberId: normalizeOptionalId(memberId),
                })
              }
            />
            <TextField
              label={t('Notes')}
              help={t(
                'Optional reminders such as vendor, contract terms, or why the amount may change.',
              )}
              value={editingBill.notes ?? ''}
              onChange={notes => onUpdate(editingBill.id, { notes })}
              wide
            />
            <CheckboxField
              label={t('Active')}
              help={t(
                'Keep enabled for bills that should be included in future Flow planning.',
              )}
              checked={editingBill.active}
              onChange={active => onUpdate(editingBill.id, { active })}
            />
          </FieldGrid>
        </ItemCard>
      )}
    </Section>
  );
}

type VariableSpendingSectionProps = {
  rules: FlowVariableSpendingRule[];
  categoryOptions: SelectOption<string>[];
  formatAmount: (amount: number) => string;
  onAdd: () => string;
  onUpdate: (id: string, fields: Partial<FlowVariableSpendingRule>) => void;
  onRemove: (id: string) => void;
};

function VariableSpendingSection({
  rules,
  categoryOptions,
  formatAmount,
  onAdd,
  onUpdate,
  onRemove,
}: VariableSpendingSectionProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingRule = rules.find(rule => rule.id === editingId);

  function handleAdd() {
    setEditingId(onAdd());
  }

  function handleRemove(id: string) {
    onRemove(id);
    if (editingId === id) {
      setEditingId(null);
    }
  }

  return (
    <Section
      title={t('Variable Spending')}
      description={t(
        'Variable spending rules estimate flexible monthly costs that are not fixed bills.',
      )}
      actionLabel={t('Add variable spending rule')}
      onAction={handleAdd}
    >
      <EditableListTable
        items={rules.filter(rule => rule.id !== editingId)}
        emptyLabel={editingRule ? null : t('No variable spending rules yet.')}
        columns={[
          {
            key: 'name',
            label: t('Name'),
            help: t(
              'A label for a flexible spending assumption, such as groceries, fuel, or dining out.',
            ),
            render: rule => rule.name || t('Unnamed variable rule'),
          },
          {
            key: 'category',
            label: t('Category'),
            help: t(
              'The Actual category this variable spending rule estimates.',
            ),
            render: rule =>
              getOptionLabel(
                categoryOptions,
                rule.categoryId,
                t('No linked category'),
              ),
          },
          {
            key: 'budget',
            label: t('Monthly budget'),
            align: 'right',
            help: t('The expected flexible monthly amount for the category.'),
            render: rule => formatAmount(rule.monthlyBudget),
          },
          {
            key: 'method',
            label: t('Forecast method'),
            help: t(
              'How future cashflow should distribute this monthly amount across time.',
            ),
            render: rule => getForecastMethodLabel(rule.forecastMethod, t),
          },
          {
            key: 'weight',
            label: t('Weight'),
            align: 'right',
            help: t(
              'Relative weight for later prioritization. Higher values can make this category more important in future planning logic.',
            ),
            render: rule => String(rule.budgetWeight),
          },
          {
            key: 'active',
            label: t('Active'),
            help: t(
              'Inactive rules stay saved but should not be included by default in future projections.',
            ),
            render: rule => formatBoolean(rule.active, t),
          },
        ]}
        onEdit={rule => setEditingId(rule.id)}
        onRemove={rule => handleRemove(rule.id)}
      />

      {editingRule && (
        <ItemCard
          title={editingRule.name || t('Variable spending rule')}
          saveLabel={t('Save variable rule')}
          onSave={() => setEditingId(null)}
          onRemove={() => handleRemove(editingRule.id)}
        >
          <FieldGrid>
            <TextField
              label={t('Name')}
              help={t(
                'Name the flexible spending assumption so it is easy to scan in the compact table.',
              )}
              value={editingRule.name}
              onChange={name => onUpdate(editingRule.id, { name })}
            />
            <SelectField
              label={t('Category')}
              help={t(
                'Choose the Actual category this rule estimates. Leave blank while drafting.',
              )}
              value={editingRule.categoryId ?? ''}
              options={categoryOptions}
              onChange={categoryId =>
                onUpdate(editingRule.id, {
                  categoryId: normalizeOptionalId(categoryId),
                })
              }
            />
            <MoneyField
              label={t('Monthly budget')}
              help={t(
                'Enter the expected monthly spend for this flexible category.',
              )}
              value={editingRule.monthlyBudget}
              onChange={monthlyBudget =>
                onUpdate(editingRule.id, { monthlyBudget })
              }
            />
            <SelectField
              label={t('Forecast method')}
              help={t(
                'Daily spread distributes spending evenly by day, weekly spread by week, one reserve holds it as a single planned reserve, and manual is reserved for future custom timing.',
              )}
              value={editingRule.forecastMethod}
              options={[
                ['daily-spread', t('Daily spread')],
                ['weekly-spread', t('Weekly spread')],
                ['one-reserve', t('One reserve')],
                ['manual', t('Manual')],
              ]}
              onChange={forecastMethod =>
                onUpdate(editingRule.id, { forecastMethod })
              }
            />
            <NumberField
              label={t('Budget weight')}
              help={t(
                'Use this to rank flexible spending importance for future affordability and reduction suggestions.',
              )}
              value={editingRule.budgetWeight}
              min={0}
              step={0.1}
              onChange={budgetWeight =>
                onUpdate(editingRule.id, { budgetWeight })
              }
            />
            <TextField
              label={t('Notes')}
              help={t(
                'Optional detail about assumptions, limits, or how this estimate should be reviewed.',
              )}
              value={editingRule.notes ?? ''}
              onChange={notes => onUpdate(editingRule.id, { notes })}
              wide
            />
            <CheckboxField
              label={t('Active')}
              help={t(
                'Keep enabled when this rule should participate in future Flow planning.',
              )}
              checked={editingRule.active}
              onChange={active => onUpdate(editingRule.id, { active })}
            />
          </FieldGrid>
        </ItemCard>
      )}
    </Section>
  );
}

type ScenariosSectionProps = {
  scenarios: FlowScenario[];
  onAdd: () => string;
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
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingScenario = scenarios.find(scenario => scenario.id === editingId);

  function handleAdd() {
    setEditingId(onAdd());
  }

  function handleRemove(id: string) {
    onRemove(id);
    if (editingId === id) {
      setEditingId(null);
    }
  }

  return (
    <Section
      title={t('Scenarios')}
      description={t(
        'Simple scenario multipliers are temporary. A rule-based scenario builder will be added later.',
      )}
      actionLabel={t('Add scenario')}
      onAction={handleAdd}
    >
      <EditableListTable
        items={scenarios.filter(scenario => scenario.id !== editingId)}
        emptyLabel={editingScenario ? null : t('No scenarios yet.')}
        columns={[
          {
            key: 'name',
            label: t('Name'),
            help: t(
              'A scenario name that will appear in future forecast and comparison tools.',
            ),
            render: scenario => scenario.name || t('Unnamed scenario'),
          },
          {
            key: 'type',
            label: t('Type'),
            help: t(
              'Base is the normal assumption, stress is a conservative or adverse case, and custom is a user-defined planning case.',
            ),
            render: scenario => getScenarioTypeLabel(scenario.type, t),
          },
          {
            key: 'income',
            label: t('Income x'),
            align: 'right',
            help: t(
              'Multiplier applied to income in later projections. 1 keeps income unchanged, 0.8 models 20% lower income, and 1.1 models 10% higher income.',
            ),
            render: scenario => String(scenario.incomeMultiplier),
          },
          {
            key: 'expense',
            label: t('Expense x'),
            align: 'right',
            help: t(
              'Multiplier applied to expenses in later projections. 1 keeps expenses unchanged, 1.1 models 10% higher expenses, and 0.9 models 10% lower expenses.',
            ),
            render: scenario => String(scenario.expenseMultiplier),
          },
          {
            key: 'savings',
            label: t('Savings x'),
            align: 'right',
            help: t(
              'Multiplier reserved for future savings-specific planning. 1 keeps savings assumptions unchanged.',
            ),
            render: scenario => String(scenario.savingsMultiplier),
          },
          {
            key: 'active',
            label: t('Active'),
            help: t(
              'Inactive scenarios stay saved but should not be shown by default in future scenario pickers.',
            ),
            render: scenario => formatBoolean(scenario.active, t),
          },
        ]}
        onEdit={scenario => setEditingId(scenario.id)}
        onRemove={scenario => handleRemove(scenario.id)}
      />

      {editingScenario && (
        <ItemCard
          title={editingScenario.name || t('Scenario')}
          saveLabel={t('Save scenario')}
          onSave={() => setEditingId(null)}
          onRemove={() => handleRemove(editingScenario.id)}
        >
          <FieldGrid>
            <TextField
              label={t('Name')}
              help={t(
                'Name the planning case clearly, such as Base, Safe Mode, One Income Missing, or Salary Delayed.',
              )}
              value={editingScenario.name}
              onChange={name => onUpdate(editingScenario.id, { name })}
            />
            <SelectField
              label={t('Type')}
              help={t(
                'Classify the scenario. This is only metadata for now; detailed scenario rules come in TASK005.',
              )}
              value={editingScenario.type}
              options={[
                ['base', t('Base')],
                ['stress', t('Stress')],
                ['custom', t('Custom')],
              ]}
              onChange={type => onUpdate(editingScenario.id, { type })}
            />
            <NumberField
              label={t('Income multiplier')}
              help={t(
                'Use 1 for normal income. Values below 1 reduce projected income; values above 1 increase it.',
              )}
              value={editingScenario.incomeMultiplier}
              min={0}
              step={0.05}
              onChange={incomeMultiplier =>
                onUpdate(editingScenario.id, { incomeMultiplier })
              }
            />
            <NumberField
              label={t('Expense multiplier')}
              help={t(
                'Use 1 for normal expenses. Values above 1 model higher costs; values below 1 model reduced costs.',
              )}
              value={editingScenario.expenseMultiplier}
              min={0}
              step={0.05}
              onChange={expenseMultiplier =>
                onUpdate(editingScenario.id, { expenseMultiplier })
              }
            />
            <NumberField
              label={t('Savings multiplier')}
              help={t(
                'Use 1 for normal savings assumptions. This is reserved for future savings/runway logic.',
              )}
              value={editingScenario.savingsMultiplier}
              min={0}
              step={0.05}
              onChange={savingsMultiplier =>
                onUpdate(editingScenario.id, { savingsMultiplier })
              }
            />
            <TextField
              label={t('Notes')}
              help={t(
                'Optional explanation of what this scenario is meant to represent.',
              )}
              value={editingScenario.notes ?? ''}
              onChange={notes => onUpdate(editingScenario.id, { notes })}
              wide
            />
            <CheckboxField
              label={t('Active')}
              help={t(
                'Keep enabled for scenarios that should appear in future forecast screens.',
              )}
              checked={editingScenario.active}
              onChange={active => onUpdate(editingScenario.id, { active })}
            />
          </FieldGrid>
        </ItemCard>
      )}
    </Section>
  );
}

type JsonPanelProps = {
  value: string;
  statusKind?: StatusState['kind'];
  onChange: (value: string) => void;
  onExport: () => void;
  onImport: () => void;
};

function JsonPanel({
  value,
  statusKind,
  onChange,
  onExport,
  onImport,
}: JsonPanelProps) {
  const { t } = useTranslation();
  const [isOpen, setOpen] = useState(false);

  useEffect(() => {
    if (
      statusKind === 'exported' ||
      statusKind === 'imported' ||
      statusKind === 'error'
    ) {
      setOpen(true);
    }
  }, [statusKind]);

  return (
    <Section
      title={t('JSON Import / Export')}
      description={t(
        'Temporary local storage can be backed up or moved between browsers with this JSON.',
      )}
    >
      <details
        open={isOpen}
        onToggle={event => setOpen(event.currentTarget.open)}
        style={detailsStyle}
      >
        <summary style={summaryStyle}>{t('Show JSON tools')}</summary>
        <View style={{ gap: 12, paddingTop: 14 }}>
          <textarea
            aria-label={t('Flow settings JSON')}
            value={value}
            onChange={event => onChange(event.currentTarget.value)}
            style={{
              ...baseInputStyle,
              minHeight: 180,
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
        </View>
      </details>
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
          gap: 16,
          flexWrap: 'wrap',
          minHeight: 52,
        }}
      >
        <View
          style={{
            gap: 6,
            flexGrow: 1,
            flexShrink: 1,
            flexBasis: 420,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: 600 }}>{title}</Text>
          <Text style={{ color: theme.pageTextSubdued, lineHeight: 1.4 }}>
            {description}
          </Text>
        </View>
        {actionLabel && onAction && (
          <Button style={{ scrollMarginTop: 72 }} onPress={onAction}>
            {actionLabel}
          </Button>
        )}
      </View>
      <View style={{ gap: 14 }}>{children}</View>
    </View>
  );
}

type EditableListColumn<T> = {
  key: string;
  label: string;
  help: string;
  align?: 'left' | 'right';
  render: (item: T) => ReactNode;
};

type EditableListTableProps<T extends { id: string }> = {
  items: T[];
  columns: EditableListColumn<T>[];
  emptyLabel: string | null;
  onEdit: (item: T) => void;
  onRemove: (item: T) => void;
};

function EditableListTable<T extends { id: string }>({
  items,
  columns,
  emptyLabel,
  onEdit,
  onRemove,
}: EditableListTableProps<T>) {
  if (items.length === 0) {
    return emptyLabel ? <EmptySection label={emptyLabel} /> : null;
  }

  return (
    <View style={tableWrapStyle}>
      <table style={compactTableStyle}>
        <thead>
          <tr>
            {columns.map(column => (
              <th
                key={column.key}
                style={{
                  ...tableHeaderCellStyle,
                  textAlign: column.align ?? 'left',
                }}
              >
                <HeaderLabel label={column.label} help={column.help} />
              </th>
            ))}
            <th style={{ ...tableHeaderCellStyle, textAlign: 'right' }}>
              <Trans>Actions</Trans>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id}>
              {columns.map(column => (
                <td
                  key={column.key}
                  style={{
                    ...tableCellStyle,
                    textAlign: column.align ?? 'left',
                  }}
                >
                  {column.render(item)}
                </td>
              ))}
              <td
                style={{
                  ...tableCellStyle,
                  textAlign: 'right',
                  whiteSpace: 'nowrap',
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'flex-end',
                    gap: 8,
                  }}
                >
                  <Button variant="bare" onPress={() => onEdit(item)}>
                    <Trans>Edit</Trans>
                  </Button>
                  <Button variant="bare" onPress={() => onRemove(item)}>
                    <Trans>Remove</Trans>
                  </Button>
                </View>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </View>
  );
}

function HeaderLabel({ label, help }: { label: string; help: string }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        color: theme.pageTextSubdued,
      }}
    >
      <Text style={{ color: 'inherit', fontWeight: 600 }}>{label}</Text>
      <HelpIcon label={label} help={help} />
    </View>
  );
}

function HelpIcon({ label, help }: { label: string; help: string }) {
  const { t } = useTranslation();

  return (
    <Tooltip
      content={
        <View style={{ maxWidth: 320, gap: 6, padding: 8 }}>
          <Text style={{ color: 'inherit', fontWeight: 600 }}>{label}</Text>
          <Text style={{ color: 'inherit', lineHeight: 1.45 }}>{help}</Text>
        </View>
      }
      placement="top"
      triggerProps={{ delay: 350 }}
    >
      <span
        aria-label={t('Parameter help')}
        role="img"
        style={helpIconStyle}
        title={help}
      >
        <SvgInformationCircle width={12} height={12} />
      </span>
    </Tooltip>
  );
}

function ItemCard({
  title,
  saveLabel,
  onSave,
  onRemove,
  children,
}: {
  title: string;
  saveLabel: string;
  onSave: () => void;
  onRemove: () => void;
  children: ReactNode;
}) {
  return (
    <View style={itemCardStyle}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <Text style={{ fontWeight: 600 }}>{title}</Text>
        <Button variant="bare" onPress={onRemove}>
          <Trans>Remove</Trans>
        </Button>
      </View>
      {children}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'flex-end',
          gap: 8,
          paddingTop: 2,
        }}
      >
        <Button variant="primary" onPress={onSave}>
          {saveLabel}
        </Button>
      </View>
    </View>
  );
}

function FieldGrid({ children }: { children: ReactNode }) {
  return <View style={fieldGridStyle}>{children}</View>;
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
  help: string;
  value: string;
  wide?: boolean;
  onChange: (value: string) => void;
};

function TextField({
  label,
  help,
  value,
  wide = false,
  onChange,
}: TextFieldProps) {
  return (
    <Field label={label} help={help} wide={wide}>
      <Input
        aria-label={label}
        value={value}
        onChangeValue={onChange}
        style={controlStyle}
      />
    </Field>
  );
}

type MoneyFieldProps = {
  label: string;
  help: string;
  value: number;
  onChange: (value: number) => void;
};

function MoneyField({ label, help, value, onChange }: MoneyFieldProps) {
  return (
    <Field label={label} help={help}>
      <FinancialInput
        aria-label={label}
        value={value}
        onChangeValue={onChange}
        onUpdate={onChange}
        style={controlStyle}
      />
    </Field>
  );
}

type NumberFieldProps = {
  label: string;
  help: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
};

function NumberField({
  label,
  help,
  value,
  min,
  max,
  step = 1,
  onChange,
}: NumberFieldProps) {
  return (
    <Field label={label} help={help}>
      <Input
        aria-label={label}
        type="number"
        min={min}
        max={max}
        step={step}
        value={String(value)}
        onChangeValue={newValue => onChange(parseNumber(newValue, value))}
        style={{ ...controlStyle, ...styles.tnum }}
      />
    </Field>
  );
}

type SelectFieldProps<Value extends string> = {
  label: string;
  help: string;
  value: Value;
  options: SelectOption<Value>[];
  defaultLabel?: string;
  onChange: (value: Value) => void;
};

function SelectField<Value extends string>({
  label,
  help,
  value,
  options,
  defaultLabel,
  onChange,
}: SelectFieldProps<Value>) {
  return (
    <Field label={label} help={help}>
      <Select
        value={value}
        options={options}
        defaultLabel={defaultLabel}
        onChange={onChange}
        style={controlStyle}
      />
    </Field>
  );
}

type CheckboxFieldProps = {
  label: string;
  help: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

function CheckboxField({ label, help, checked, onChange }: CheckboxFieldProps) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        minHeight: 34,
        paddingTop: 19,
        color: theme.pageText,
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={event => onChange(event.currentTarget.checked)}
      />
      <Text>{label}</Text>
      <HelpIcon label={label} help={help} />
    </label>
  );
}

function Field({
  label,
  help,
  wide = false,
  children,
}: {
  label: string;
  help: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <View
      style={{
        gap: 6,
        minWidth: 0,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: wide ? '100%' : 210,
      }}
    >
      <HeaderLabel label={label} help={help} />
      {children}
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

function getOptionLabel(
  options: SelectOption<string>[],
  value: string | undefined,
  fallback: string,
): string {
  if (!value) {
    return fallback;
  }

  const option = options.find(
    option => Array.isArray(option) && option[0] === value,
  );

  return Array.isArray(option) ? option[1] : fallback;
}

function formatActive(value: boolean, t: TranslationFn): string {
  return value ? t('Active') : t('Inactive');
}

function formatBoolean(value: boolean, t: TranslationFn): string {
  return value ? t('Yes') : t('No');
}

function getRoleLabel(role: FlowHouseholdMember['role'], t: TranslationFn) {
  switch (role) {
    case 'owner':
      return t('Owner');
    case 'partner':
      return t('Partner');
    case 'child':
      return t('Child');
    case 'other':
      return t('Other');
    default:
      return role;
  }
}

function getSplitMethodLabel(
  splitMethod: FlowFixedBill['splitMethod'],
  t: TranslationFn,
) {
  switch (splitMethod) {
    case 'shared-50-50':
      return t('Shared 50/50');
    case 'only-member':
      return t('Only selected member');
    case 'custom':
      return t('Custom');
    default:
      return splitMethod;
  }
}

function getForecastMethodLabel(
  forecastMethod: FlowVariableSpendingRule['forecastMethod'],
  t: TranslationFn,
) {
  switch (forecastMethod) {
    case 'daily-spread':
      return t('Daily spread');
    case 'weekly-spread':
      return t('Weekly spread');
    case 'one-reserve':
      return t('One reserve');
    case 'manual':
      return t('Manual');
    default:
      return forecastMethod;
  }
}

function getScenarioTypeLabel(
  scenarioType: FlowScenario['type'],
  t: TranslationFn,
) {
  switch (scenarioType) {
    case 'base':
      return t('Base');
    case 'stress':
      return t('Stress');
    case 'custom':
      return t('Custom');
    default:
      return scenarioType;
  }
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

function formatTimestamp(timestamp: string | null, dateFormat: string): string {
  if (!timestamp) {
    return '';
  }

  try {
    return formatDate(parseISO(timestamp), `${dateFormat} HH:mm:ss`);
  } catch {
    return timestamp;
  }
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

function getStatusText(status: StatusState, t: TranslationFn): string {
  switch (status.kind) {
    case 'saved':
      return t('Flow settings saved.');
    case 'autosaved':
      return t('Flow settings autosaved.');
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

const cardBaseStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.tableBackground,
};

const savedPulseAnimation = keyframes({
  '0%': {
    opacity: 0.35,
    transform: 'translateY(2px) scale(0.98)',
  },
  '100%': {
    opacity: 1,
    transform: 'translateY(0) scale(1)',
  },
});

const savedIndicatorStyle: CSSProperties = {
  flexDirection: 'row',
  alignItems: 'center',
  gap: 6,
  color: theme.noticeTextLight,
  lineHeight: 1.4,
};

const actionBarStyle: CSSProperties = {
  ...cardBaseStyle,
  padding: 18,
  minHeight: 92,
};

const sectionStyle: CSSProperties = {
  ...cardBaseStyle,
  padding: 18,
  gap: 18,
};

const itemCardStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.pageBackground,
  padding: 14,
  gap: 14,
};

const tableWrapStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.pageBackground,
  overflowX: 'auto',
};

const compactTableStyle: CSSProperties = {
  width: '100%',
  minWidth: 760,
  borderCollapse: 'collapse',
};

const tableHeaderCellStyle: CSSProperties = {
  padding: '10px 12px',
  borderBottom: `1px solid ${theme.tableBorder}`,
  color: theme.pageTextSubdued,
  fontWeight: 600,
  verticalAlign: 'middle',
  whiteSpace: 'nowrap',
};

const tableCellStyle: CSSProperties = {
  padding: '10px 12px',
  borderBottom: `1px solid ${theme.tableBorder}`,
  color: theme.tableText,
  verticalAlign: 'middle',
};

const fieldGridStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: '14px 16px',
  alignItems: 'flex-end',
};

const controlStyle: CSSProperties = {
  width: '100%',
  minHeight: 34,
};

const detailsStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  padding: 14,
};

const summaryStyle: CSSProperties = {
  cursor: 'pointer',
  color: theme.pageText,
  fontWeight: 600,
};

const helpIconStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 16,
  height: 16,
  borderRadius: 999,
  color: theme.pageTextSubdued,
  cursor: 'help',
  flexShrink: 0,
};
