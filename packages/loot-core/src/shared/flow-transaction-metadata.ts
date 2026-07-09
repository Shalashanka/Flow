export const flowSharedStatuses = ['personal', 'shared', 'ignored'] as const;

export const flowSplitMethods = [
  'none',
  'equal',
  'percentage',
  'fixed-amount',
  'custom',
] as const;

export const flowSettlementStatuses = [
  'not-needed',
  'open',
  'settled',
  'reimbursed',
  'ignored',
] as const;

export type FlowSharedStatus = (typeof flowSharedStatuses)[number];

export type FlowSplitMethod = (typeof flowSplitMethods)[number];

export type FlowSettlementStatus = (typeof flowSettlementStatuses)[number];

export type FlowSplitParticipant = {
  memberId: string;
  percentage?: number;
  fixedAmount?: number;
};

export type FlowSplitData = {
  participants: FlowSplitParticipant[];
};

export type FlowTransactionMetadataData = {
  version: 1;
  paidByMemberId?: string;
  enteredByMemberId?: string;
  sharedStatus: FlowSharedStatus;
  splitMethod: FlowSplitMethod;
  splitData?: FlowSplitData;
  settlementStatus: FlowSettlementStatus;
  settlementMonth?: string;
  reimbursementLinkId?: string;
  cashflowIncluded: boolean;
  flowNotes?: string;
};

export type FlowTransactionMetadataRecord = {
  actualTransactionId: string;
  data: FlowTransactionMetadataData;
  exists: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export function createDefaultFlowTransactionMetadataData(
  defaults: Partial<FlowTransactionMetadataData> = {},
): FlowTransactionMetadataData {
  return {
    version: 1,
    sharedStatus: defaults.sharedStatus ?? 'personal',
    splitMethod: defaults.splitMethod ?? 'none',
    settlementStatus: defaults.settlementStatus ?? 'not-needed',
    cashflowIncluded: defaults.cashflowIncluded ?? true,
    paidByMemberId: defaults.paidByMemberId,
    enteredByMemberId: defaults.enteredByMemberId,
    splitData: defaults.splitData,
    settlementMonth: defaults.settlementMonth,
    reimbursementLinkId: defaults.reimbursementLinkId,
    flowNotes: defaults.flowNotes,
  };
}

export function normalizeFlowTransactionMetadataData(
  value: unknown,
  defaults: FlowTransactionMetadataData = createDefaultFlowTransactionMetadataData(),
): FlowTransactionMetadataData {
  if (!isRecord(value) || getNumber(value, 'version') !== 1) {
    return createDefaultFlowTransactionMetadataData(defaults);
  }

  const paidByMemberId = getString(value, 'paidByMemberId');
  const enteredByMemberId = getString(value, 'enteredByMemberId');
  const sharedStatus = getSharedStatus(value, defaults.sharedStatus);
  const splitMethod = getSplitMethod(value, defaults.splitMethod);
  const splitData = normalizeSplitData(getValue(value, 'splitData'));
  const settlementStatus = getSettlementStatus(
    value,
    defaults.settlementStatus,
  );
  const settlementMonth = normalizeSettlementMonth(
    getString(value, 'settlementMonth'),
  );
  const reimbursementLinkId = getString(value, 'reimbursementLinkId');
  const cashflowIncluded =
    getBoolean(value, 'cashflowIncluded') ?? defaults.cashflowIncluded;
  const flowNotes = getString(value, 'flowNotes');

  return {
    version: 1,
    paidByMemberId: paidByMemberId ?? defaults.paidByMemberId,
    enteredByMemberId: enteredByMemberId ?? defaults.enteredByMemberId,
    sharedStatus,
    splitMethod,
    splitData: splitData ?? defaults.splitData,
    settlementStatus,
    settlementMonth: settlementMonth ?? defaults.settlementMonth,
    reimbursementLinkId: reimbursementLinkId ?? defaults.reimbursementLinkId,
    cashflowIncluded,
    flowNotes: flowNotes ?? defaults.flowNotes,
  };
}

function getSharedStatus(
  record: Record<string, unknown>,
  fallback: FlowSharedStatus,
): FlowSharedStatus {
  const value = getString(record, 'sharedStatus');
  return isFlowSharedStatus(value) ? value : fallback;
}

function getSplitMethod(
  record: Record<string, unknown>,
  fallback: FlowSplitMethod,
): FlowSplitMethod {
  const value = getString(record, 'splitMethod');
  return isFlowSplitMethod(value) ? value : fallback;
}

function getSettlementStatus(
  record: Record<string, unknown>,
  fallback: FlowSettlementStatus,
): FlowSettlementStatus {
  const value = getString(record, 'settlementStatus');
  return isFlowSettlementStatus(value) ? value : fallback;
}

function isFlowSharedStatus(
  value: string | undefined,
): value is FlowSharedStatus {
  return flowSharedStatuses.some(status => status === value);
}

function isFlowSplitMethod(
  value: string | undefined,
): value is FlowSplitMethod {
  return flowSplitMethods.some(method => method === value);
}

function isFlowSettlementStatus(
  value: string | undefined,
): value is FlowSettlementStatus {
  return flowSettlementStatuses.some(status => status === value);
}

function normalizeSplitData(value: unknown): FlowSplitData | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const participants = getArray(value, 'participants')
    .map(normalizeParticipant)
    .filter(isPresent);

  return participants.length > 0 ? { participants } : undefined;
}

function normalizeParticipant(
  value: unknown,
): FlowSplitParticipant | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const memberId = getString(value, 'memberId');

  if (!memberId) {
    return undefined;
  }

  const percentage = getNumber(value, 'percentage');
  const fixedAmount = getNumber(value, 'fixedAmount');

  return {
    memberId,
    percentage: percentage != null && percentage >= 0 ? percentage : undefined,
    fixedAmount:
      fixedAmount != null && Number.isInteger(fixedAmount)
        ? fixedAmount
        : undefined,
  };
}

function normalizeSettlementMonth(value: string | undefined) {
  return value && /^\d{4}-\d{2}$/.test(value) ? value : undefined;
}

function isPresent<T>(value: T | undefined): value is T {
  return value !== undefined;
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
  return typeof value === 'boolean' ? value : undefined;
}
