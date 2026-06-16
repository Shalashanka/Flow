import {
  createCashflowSettings,
  createDefaultFlowSettings,
  createFixedBill,
  createHouseholdMember,
  createIncomePlan,
  createScenario,
  createTransactionRules,
  createVariableSpendingRule,
} from './defaults';
import type {
  FlowCashflowSettings,
  FlowFixedBill,
  FlowHouseholdMember,
  FlowHouseholdRole,
  FlowIncomePlan,
  FlowScenario,
  FlowSettings,
  FlowSplitMethod,
  FlowTransactionRules,
  FlowVariableSpendingRule,
} from './types';
import {
  flowForecastMethods,
  flowHouseholdRoles,
  flowScenarioTypes,
  flowSplitMethods,
} from './types';

export const FLOW_SETTINGS_STORAGE_KEY = 'flow.settings.v1';

type FlowForecastMethod = FlowVariableSpendingRule['forecastMethod'];

export type FlowSettingsImportResult =
  | { ok: true; settings: FlowSettings }
  | { ok: false; error: string };

export async function getFlowSettings(): Promise<FlowSettings> {
  const storedValue = getStorage()?.getItem(FLOW_SETTINGS_STORAGE_KEY);

  if (!storedValue) {
    return createDefaultFlowSettings();
  }

  const parsed = parseFlowSettingsJson(storedValue);
  return parsed.ok ? parsed.settings : createDefaultFlowSettings();
}

export async function saveFlowSettings(
  settings: FlowSettings,
): Promise<FlowSettings> {
  const settingsToSave = {
    ...settings,
    updatedAt: new Date().toISOString(),
  };

  getStorage()?.setItem(
    FLOW_SETTINGS_STORAGE_KEY,
    JSON.stringify(settingsToSave),
  );

  return settingsToSave;
}

export async function resetFlowSettings(): Promise<FlowSettings> {
  const settings = createDefaultFlowSettings();
  return saveFlowSettings(settings);
}

export function exportFlowSettings(settings: FlowSettings): string {
  return JSON.stringify(settings, null, 2);
}

export function parseFlowSettingsJson(json: string): FlowSettingsImportResult {
  try {
    const parsed: unknown = JSON.parse(json);
    const settings = normalizeFlowSettings(parsed);

    if (!settings) {
      return {
        ok: false,
        error: 'Invalid Flow settings JSON. Expected version 1 settings.',
      };
    }

    return { ok: true, settings };
  } catch {
    return {
      ok: false,
      error: 'Invalid JSON. Check the exported settings text and try again.',
    };
  }
}

function normalizeFlowSettings(value: unknown): FlowSettings | null {
  if (!isRecord(value) || getNumber(value, 'version') !== 1) {
    return null;
  }

  const defaults = createDefaultFlowSettings();
  const scenarios = getArray(value, 'scenarios')
    .map(normalizeScenario)
    .filter(isPresent);

  return {
    version: 1,
    householdMembers: withFallback(
      getArray(value, 'householdMembers')
        .map(normalizeHouseholdMember)
        .filter(isPresent),
      defaults.householdMembers,
    ),
    transactionRules: normalizeTransactionRules(
      getValue(value, 'transactionRules'),
      defaults.transactionRules,
    ),
    cashflowSettings: normalizeCashflowSettings(
      getValue(value, 'cashflowSettings'),
      defaults.cashflowSettings,
      scenarios,
    ),
    incomePlans: getArray(value, 'incomePlans')
      .map(normalizeIncomePlan)
      .filter(isPresent),
    fixedBills: getArray(value, 'fixedBills')
      .map(normalizeFixedBill)
      .filter(isPresent),
    variableSpendingRules: getArray(value, 'variableSpendingRules')
      .map(normalizeVariableSpendingRule)
      .filter(isPresent),
    scenarios: withFallback(scenarios, defaults.scenarios),
    updatedAt: getString(value, 'updatedAt') ?? defaults.updatedAt,
  };
}

function normalizeHouseholdMember(value: unknown): FlowHouseholdMember | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value, 'id');

  if (!id) {
    return null;
  }

  const role = getString(value, 'role');

  return createHouseholdMember({
    id,
    name: getString(value, 'name') ?? '',
    role: isHouseholdRole(role) ? role : 'other',
    active: getBoolean(value, 'active') ?? true,
    defaultAccountId: getString(value, 'defaultAccountId'),
  });
}

function normalizeTransactionRules(
  value: unknown,
  defaults: FlowTransactionRules,
): FlowTransactionRules {
  if (!isRecord(value)) {
    return defaults;
  }

  const splitMethod = getString(value, 'defaultSplitMethod');

  return createTransactionRules({
    defaultPaidByMemberId: getString(value, 'defaultPaidByMemberId'),
    defaultEnteredByMemberId: getString(value, 'defaultEnteredByMemberId'),
    defaultSplitMethod: isSplitMethod(splitMethod)
      ? splitMethod
      : defaults.defaultSplitMethod,
    defaultCashflowIncluded:
      getBoolean(value, 'defaultCashflowIncluded') ??
      defaults.defaultCashflowIncluded,
  });
}

function normalizeCashflowSettings(
  value: unknown,
  defaults: FlowCashflowSettings,
  scenarios: FlowScenario[],
): FlowCashflowSettings {
  if (!isRecord(value)) {
    return defaults;
  }

  const defaultProjectionMode = getString(value, 'defaultProjectionMode');
  const defaultStartingBalanceMode = getString(
    value,
    'defaultStartingBalanceMode',
  );
  const defaultScenarioId =
    getString(value, 'defaultScenarioId') ?? defaults.defaultScenarioId;
  const hasScenario = scenarios.some(
    scenario => scenario.id === defaultScenarioId,
  );

  return createCashflowSettings({
    defaultProjectionMode:
      defaultProjectionMode === 'next-month'
        ? 'next-month'
        : defaults.defaultProjectionMode,
    defaultScenarioId: hasScenario
      ? defaultScenarioId
      : defaults.defaultScenarioId,
    minimumSafeBalance:
      getNumber(value, 'minimumSafeBalance') ?? defaults.minimumSafeBalance,
    warningBalance:
      getNumber(value, 'warningBalance') ?? defaults.warningBalance,
    defaultStartingBalanceMode:
      defaultStartingBalanceMode === 'manual'
        ? 'manual'
        : defaults.defaultStartingBalanceMode,
    includeOffBudgetAccounts:
      getBoolean(value, 'includeOffBudgetAccounts') ??
      defaults.includeOffBudgetAccounts,
    includeTransfers:
      getBoolean(value, 'includeTransfers') ?? defaults.includeTransfers,
  });
}

function normalizeIncomePlan(value: unknown): FlowIncomePlan | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value, 'id');

  if (!id) {
    return null;
  }

  return createIncomePlan({
    id,
    name: getString(value, 'name') ?? '',
    memberId: getString(value, 'memberId'),
    amount: getNumber(value, 'amount') ?? 0,
    dayOfMonth: normalizeDay(getNumber(value, 'dayOfMonth')),
    accountId: getString(value, 'accountId'),
    categoryId: getString(value, 'categoryId'),
    active: getBoolean(value, 'active') ?? true,
    startDate: getString(value, 'startDate'),
    endDate: getString(value, 'endDate'),
    uncertain: getBoolean(value, 'uncertain') ?? false,
    notes: getString(value, 'notes'),
  });
}

function normalizeFixedBill(value: unknown): FlowFixedBill | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value, 'id');
  const splitMethod = getString(value, 'splitMethod');

  if (!id) {
    return null;
  }

  return createFixedBill({
    id,
    name: getString(value, 'name') ?? '',
    amount: getNumber(value, 'amount') ?? 0,
    dayOfMonth: normalizeDay(getNumber(value, 'dayOfMonth')),
    accountId: getString(value, 'accountId'),
    categoryId: getString(value, 'categoryId'),
    splitMethod: isSplitMethod(splitMethod) ? splitMethod : 'shared-50-50',
    memberId: getString(value, 'memberId'),
    active: getBoolean(value, 'active') ?? true,
    startDate: getString(value, 'startDate'),
    endDate: getString(value, 'endDate'),
    notes: getString(value, 'notes'),
  });
}

function normalizeVariableSpendingRule(
  value: unknown,
): FlowVariableSpendingRule | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value, 'id');
  const forecastMethod = getString(value, 'forecastMethod');

  if (!id) {
    return null;
  }

  return createVariableSpendingRule({
    id,
    name: getString(value, 'name') ?? '',
    categoryId: getString(value, 'categoryId'),
    monthlyBudget: getNumber(value, 'monthlyBudget') ?? 0,
    forecastMethod: isForecastMethod(forecastMethod)
      ? forecastMethod
      : 'daily-spread',
    budgetWeight: getNumber(value, 'budgetWeight') ?? 1,
    active: getBoolean(value, 'active') ?? true,
    notes: getString(value, 'notes'),
  });
}

function normalizeScenario(value: unknown): FlowScenario | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value, 'id');
  const type = getString(value, 'type');

  if (!id) {
    return null;
  }

  return createScenario({
    id,
    name: getString(value, 'name') ?? '',
    type: isScenarioType(type) ? type : 'custom',
    active: getBoolean(value, 'active') ?? true,
    incomeMultiplier: getNumber(value, 'incomeMultiplier') ?? 1,
    expenseMultiplier: getNumber(value, 'expenseMultiplier') ?? 1,
    savingsMultiplier: getNumber(value, 'savingsMultiplier') ?? 1,
    notes: getString(value, 'notes'),
  });
}

function normalizeDay(value: number | undefined): number {
  if (value == null || !Number.isFinite(value)) {
    return 1;
  }

  return Math.max(1, Math.min(31, Math.round(value)));
}

function isHouseholdRole(
  value: string | undefined,
): value is FlowHouseholdRole {
  return flowHouseholdRoles.some(role => role === value);
}

function isSplitMethod(value: string | undefined): value is FlowSplitMethod {
  return flowSplitMethods.some(splitMethod => splitMethod === value);
}

function isForecastMethod(
  value: string | undefined,
): value is FlowForecastMethod {
  return flowForecastMethods.some(method => method === value);
}

function isScenarioType(
  value: string | undefined,
): value is FlowScenario['type'] {
  return flowScenarioTypes.some(type => type === value);
}

function withFallback<T>(items: T[], fallback: T[]): T[] {
  return items.length > 0 ? items : fallback;
}

function isPresent<T>(value: T | null): value is T {
  return value !== null;
}

function getStorage(): Storage | undefined {
  return typeof window === 'undefined' ? undefined : window.localStorage;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getArray(record: Record<string, unknown>, key: string): unknown[] {
  const value = getValue(record, key);
  return Array.isArray(value) ? value : [];
}

function getValue(record: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(record, key) ? Reflect.get(record, key) : undefined;
}

function getString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = getValue(record, key);
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function getNumber(
  record: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = getValue(record, key);
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

function getBoolean(
  record: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const value = getValue(record, key);

  if (typeof value === 'boolean') {
    return value;
  }

  return undefined;
}
