import { createApp } from '#server/app';
import * as db from '#server/db';
import { mutator } from '#server/mutators';
import { batchMessages } from '#server/sync';
import { isFlowDebtPriority, isFlowDebtStatus } from '#shared/flow-debt';
import type { FlowDebt } from '#shared/flow-debt';
import {
  isFlowSettlementMonthStatus,
  isFlowSettlementPaymentLinkStatus,
  isFlowSettlementStatus,
} from '#shared/flow-settlement';
import type {
  FlowSettlementItem,
  FlowSettlementMonthClosure,
  FlowSettlementMonthStatus,
  FlowSettlementPaymentLink,
  FlowSettlementSnapshot,
  FlowSettlementStatus,
  FlowSettlementSummary,
} from '#shared/flow-settlement';
import { normalizeFlowTransactionMetadataData } from '#shared/flow-transaction-metadata';
import type {
  FlowTransactionMetadataData,
  FlowTransactionMetadataRecord,
} from '#shared/flow-transaction-metadata';

const FLOW_SETTINGS_ID = 'default';

export type FlowSettingsRow = {
  id: string;
  version: number | null;
  data: string | null;
  created_at: string | null;
  updated_at: string | null;
};

export type FlowSettingsSaveRequest = {
  data: string;
  version: number;
};

export type FlowSettingsResponse = {
  row: FlowSettingsRow | null;
};

type FlowTransactionMetadataRow = {
  id: string;
  actual_transaction_id: string | null;
  data: string | null;
  created_at: string | null;
  updated_at: string | null;
  tombstone: number | null;
};

type FlowTransactionMetadataGetRequest = {
  actualTransactionId: string;
};

type FlowTransactionMetadataGetManyRequest = {
  actualTransactionIds: string[];
};

type FlowTransactionMetadataGetBySettlementMonthRequest = {
  settlementMonth: string;
};

type FlowTransactionMetadataSaveRequest = {
  actualTransactionId: string;
  data: FlowTransactionMetadataData;
};

type FlowTransactionMetadataDeleteResponse = {
  deleted: boolean;
};

type FlowSettlementsMonthRequest = {
  month: string;
};

type FlowSettlementsSaveRequest = {
  month: string;
  settlements: FlowSettlementSummary[];
  items: FlowSettlementItem[];
};

type FlowSettlementsSaveResponse = {
  saved: boolean;
};

type FlowSettlementsDeleteResponse = {
  deleted: boolean;
};

type FlowSettlementItemsResponse = {
  items: FlowSettlementItem[];
};

type FlowSettlementPaymentLinksResponse = {
  links: FlowSettlementPaymentLink[];
};

type FlowSettlementPaymentLinkSaveRequest = {
  settlementId: string;
  month: string;
  paymentTransactionId: string;
  amount: number;
  notes?: string;
};

type FlowSettlementPaymentLinkDeleteRequest = {
  settlementId: string;
  month: string;
};

type FlowSettlementPaymentLinkSaveResponse = {
  saved: boolean;
};

type FlowSettlementPaymentLinkDeleteResponse = {
  deleted: boolean;
};

type FlowSettlementMonthCloseSaveRequest = {
  month: string;
  status: 'closed';
  notes?: string;
};

type FlowSettlementMonthCloseSaveResponse = {
  saved: boolean;
};

type FlowSettlementMonthReopenRequest = {
  month: string;
  notes?: string;
};

type FlowSettlementMonthReopenResponse = {
  reopened: boolean;
};

type FlowSettlementRow = {
  id: string;
  month: string | null;
  from_member_id: string | null;
  to_member_id: string | null;
  amount: number | null;
  item_count: number | null;
  status: string | null;
  payment_transaction_id: string | null;
  notes: string | null;
  tombstone: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type FlowSettlementItemRow = {
  id: string;
  settlement_id: string | null;
  month: string | null;
  actual_transaction_id: string | null;
  owed_by_member_id: string | null;
  owed_to_member_id: string | null;
  amount: number | null;
  source_amount: number | null;
  split_method: string | null;
  settlement_status: string | null;
  notes: string | null;
  tombstone: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type FlowSettlementPaymentLinkRow = {
  id: string;
  settlement_id: string | null;
  month: string | null;
  payment_transaction_id: string | null;
  amount: number | null;
  link_status: string | null;
  notes: string | null;
  tombstone: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type FlowSettlementMonthClosureRow = {
  id: string;
  month: string | null;
  status: string | null;
  closed_at: string | null;
  reopened_at: string | null;
  notes: string | null;
  tombstone: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type FlowDebtRow = {
  id: string;
  name: string | null;
  lender: string | null;
  actual_account_id: string | null;
  actual_category_id: string | null;
  original_amount: number | null;
  current_balance_override: number | null;
  minimum_payment: number | null;
  planned_payment: number | null;
  due_day: number | null;
  interest_rate_bps: number | null;
  priority: string | null;
  status: string | null;
  active: number | null;
  notes: string | null;
  tombstone: number | null;
  created_at: string | null;
  updated_at: string | null;
};

type FlowDebtSaveRequest = Partial<FlowDebt> & {
  id?: string;
};

type FlowDebtDeleteRequest = {
  id: string;
};

type FlowDebtDeleteResponse = {
  deleted: boolean;
};

export type FlowHandlers = {
  'flow/settings-get': typeof getFlowSettingsRow;
  'flow/settings-save': typeof saveFlowSettingsRow;
  'flow/transaction-metadata-get': typeof getTransactionMetadata;
  'flow/transaction-metadata-get-many': typeof getTransactionMetadataMany;
  'flow/transaction-metadata-get-by-settlement-month': typeof getTransactionMetadataBySettlementMonth;
  'flow/transaction-metadata-save': typeof saveTransactionMetadata;
  'flow/transaction-metadata-delete': typeof deleteTransactionMetadata;
  'flow/settlements-get': typeof getSettlements;
  'flow/settlements-save': typeof saveSettlements;
  'flow/settlements-delete': typeof deleteSettlements;
  'flow/settlement-items-get': typeof getSettlementItems;
  'flow/settlement-payment-links-get': typeof getSettlementPaymentLinks;
  'flow/settlement-payment-link-save': typeof saveSettlementPaymentLink;
  'flow/settlement-payment-link-delete': typeof deleteSettlementPaymentLink;
  'flow/settlement-month-close-get': typeof getSettlementMonthClose;
  'flow/settlement-month-close-save': typeof saveSettlementMonthClose;
  'flow/settlement-month-reopen': typeof reopenSettlementMonth;
  'flow/debts-get': typeof getDebts;
  'flow/debt-save': typeof saveDebt;
  'flow/debt-delete': typeof deleteDebt;
};

export const app = createApp<FlowHandlers>();

app.method('flow/settings-get', getFlowSettingsRow);
app.method('flow/settings-save', mutator(saveFlowSettingsRow));
app.method('flow/transaction-metadata-get', getTransactionMetadata);
app.method('flow/transaction-metadata-get-many', getTransactionMetadataMany);
app.method(
  'flow/transaction-metadata-get-by-settlement-month',
  getTransactionMetadataBySettlementMonth,
);
app.method('flow/transaction-metadata-save', mutator(saveTransactionMetadata));
app.method(
  'flow/transaction-metadata-delete',
  mutator(deleteTransactionMetadata),
);
app.method('flow/settlements-get', getSettlements);
app.method('flow/settlements-save', mutator(saveSettlements));
app.method('flow/settlements-delete', mutator(deleteSettlements));
app.method('flow/settlement-items-get', getSettlementItems);
app.method('flow/settlement-payment-links-get', getSettlementPaymentLinks);
app.method(
  'flow/settlement-payment-link-save',
  mutator(saveSettlementPaymentLink),
);
app.method(
  'flow/settlement-payment-link-delete',
  mutator(deleteSettlementPaymentLink),
);
app.method('flow/settlement-month-close-get', getSettlementMonthClose);
app.method(
  'flow/settlement-month-close-save',
  mutator(saveSettlementMonthClose),
);
app.method('flow/settlement-month-reopen', mutator(reopenSettlementMonth));
app.method('flow/debts-get', getDebts);
app.method('flow/debt-save', mutator(saveDebt));
app.method('flow/debt-delete', mutator(deleteDebt));

async function getFlowSettingsRow(): Promise<FlowSettingsResponse> {
  return {
    row: await selectFlowSettingsRow(),
  };
}

async function saveFlowSettingsRow({
  data,
  version,
}: FlowSettingsSaveRequest): Promise<FlowSettingsResponse> {
  if (typeof data !== 'string' || data.length === 0) {
    throw new Error('Flow settings data is required.');
  }

  if (!Number.isInteger(version) || version < 1) {
    throw new Error('Flow settings version is invalid.');
  }

  const now = new Date().toISOString();
  const existingRow = await db.first<Pick<FlowSettingsRow, 'id'>>(
    'SELECT id FROM flow_settings WHERE id = ?',
    [FLOW_SETTINGS_ID],
  );

  if (existingRow) {
    await db.update('flow_settings', {
      id: FLOW_SETTINGS_ID,
      version,
      data,
      updated_at: now,
    });
  } else {
    await db.insert('flow_settings', {
      id: FLOW_SETTINGS_ID,
      version,
      data,
      created_at: now,
      updated_at: now,
    });
  }

  return {
    row: await selectFlowSettingsRow(),
  };
}

async function selectFlowSettingsRow(): Promise<FlowSettingsRow | null> {
  return db.first<FlowSettingsRow>(
    `
      SELECT id, version, data, created_at, updated_at
      FROM flow_settings
      WHERE id = ?
    `,
    [FLOW_SETTINGS_ID],
  );
}

async function getTransactionMetadata({
  actualTransactionId,
}: FlowTransactionMetadataGetRequest): Promise<FlowTransactionMetadataRecord | null> {
  const row = await selectTransactionMetadataRow(
    requireActualTransactionId(actualTransactionId),
  );

  return row ? rowToTransactionMetadataRecord(row) : null;
}

async function getTransactionMetadataMany({
  actualTransactionIds,
}: FlowTransactionMetadataGetManyRequest): Promise<
  FlowTransactionMetadataRecord[]
> {
  const ids = dedupeTransactionIds(actualTransactionIds);

  if (ids.length === 0) {
    return [];
  }

  const rows = await db.all<FlowTransactionMetadataRow>(
    `
      SELECT id, actual_transaction_id, data, created_at, updated_at, tombstone
      FROM flow_transaction_metadata
      WHERE actual_transaction_id IN (${ids.map(() => '?').join(', ')})
        AND COALESCE(tombstone, 0) = 0
    `,
    ids,
  );

  return rows
    .map(rowToTransactionMetadataRecord)
    .filter(isTransactionMetadataRecord);
}

async function getTransactionMetadataBySettlementMonth({
  settlementMonth,
}: FlowTransactionMetadataGetBySettlementMonthRequest): Promise<
  FlowTransactionMetadataRecord[]
> {
  const month = requireMonth(settlementMonth);
  const rows = await db.all<FlowTransactionMetadataRow>(
    `
      SELECT id, actual_transaction_id, data, created_at, updated_at, tombstone
      FROM flow_transaction_metadata
      WHERE COALESCE(tombstone, 0) = 0
    `,
  );

  return rows
    .map(rowToTransactionMetadataRecord)
    .filter(isTransactionMetadataRecord)
    .filter(record => record.data.settlementMonth === month);
}

async function saveTransactionMetadata({
  actualTransactionId,
  data,
}: FlowTransactionMetadataSaveRequest): Promise<FlowTransactionMetadataRecord> {
  const id = requireActualTransactionId(actualTransactionId);
  const normalizedData = normalizeFlowTransactionMetadataData(data);
  const now = new Date().toISOString();
  const existingRow = await db.first<Pick<FlowTransactionMetadataRow, 'id'>>(
    'SELECT id FROM flow_transaction_metadata WHERE id = ?',
    [id],
  );

  if (existingRow) {
    await db.update('flow_transaction_metadata', {
      id,
      actual_transaction_id: id,
      data: JSON.stringify(normalizedData),
      updated_at: now,
      tombstone: 0,
    });
  } else {
    await db.insert('flow_transaction_metadata', {
      id,
      actual_transaction_id: id,
      data: JSON.stringify(normalizedData),
      created_at: now,
      updated_at: now,
      tombstone: 0,
    });
  }

  const savedRow = await selectTransactionMetadataRow(id);

  if (!savedRow) {
    throw new Error('Flow transaction metadata save failed.');
  }

  const record = rowToTransactionMetadataRecord(savedRow);

  if (!record) {
    throw new Error('Flow transaction metadata save returned invalid data.');
  }

  return record;
}

async function deleteTransactionMetadata({
  actualTransactionId,
}: FlowTransactionMetadataGetRequest): Promise<FlowTransactionMetadataDeleteResponse> {
  const id = requireActualTransactionId(actualTransactionId);
  const existingRow = await db.first<Pick<FlowTransactionMetadataRow, 'id'>>(
    'SELECT id FROM flow_transaction_metadata WHERE id = ?',
    [id],
  );

  if (!existingRow) {
    return { deleted: false };
  }

  await db.update('flow_transaction_metadata', {
    id,
    data: null,
    updated_at: new Date().toISOString(),
    tombstone: 1,
  });

  return { deleted: true };
}

async function getDebts(): Promise<FlowDebt[]> {
  const rows = await selectDebtRows();

  return rows.map(rowToDebt).filter(isDebt);
}

async function saveDebt(debt: FlowDebtSaveRequest): Promise<FlowDebt> {
  const normalizedDebt = normalizeDebt(debt);
  const now = new Date().toISOString();
  const existingRow = await db.first<Pick<FlowDebtRow, 'id'>>(
    'SELECT id FROM flow_debts WHERE id = ?',
    [normalizedDebt.id],
  );
  const row = debtToRow(normalizedDebt, now);

  if (existingRow) {
    await db.update('flow_debts', row);
  } else {
    await db.insert('flow_debts', {
      ...row,
      created_at: now,
    });
  }

  const savedRow = await selectDebtRow(normalizedDebt.id);

  if (!savedRow) {
    throw new Error('Flow debt save failed.');
  }

  const savedDebt = rowToDebt(savedRow);

  if (!savedDebt) {
    throw new Error('Flow debt save returned invalid data.');
  }

  return savedDebt;
}

async function deleteDebt({
  id,
}: FlowDebtDeleteRequest): Promise<FlowDebtDeleteResponse> {
  const normalizedId = requireDebtId(id);
  const existingRow = await db.first<Pick<FlowDebtRow, 'id'>>(
    'SELECT id FROM flow_debts WHERE id = ?',
    [normalizedId],
  );

  if (!existingRow) {
    return { deleted: false };
  }

  await db.update('flow_debts', {
    id: normalizedId,
    status: 'ignored',
    active: 0,
    tombstone: 1,
    updated_at: new Date().toISOString(),
  });

  return { deleted: true };
}

async function selectDebtRows(): Promise<FlowDebtRow[]> {
  return db.all<FlowDebtRow>(
    `
      SELECT
        id,
        name,
        lender,
        actual_account_id,
        actual_category_id,
        original_amount,
        current_balance_override,
        minimum_payment,
        planned_payment,
        due_day,
        interest_rate_bps,
        priority,
        status,
        active,
        notes,
        tombstone,
        created_at,
        updated_at
      FROM flow_debts
      WHERE COALESCE(tombstone, 0) = 0
      ORDER BY active DESC, status, priority DESC, name
    `,
  );
}

async function selectDebtRow(id: string): Promise<FlowDebtRow | null> {
  return db.first<FlowDebtRow>(
    `
      SELECT
        id,
        name,
        lender,
        actual_account_id,
        actual_category_id,
        original_amount,
        current_balance_override,
        minimum_payment,
        planned_payment,
        due_day,
        interest_rate_bps,
        priority,
        status,
        active,
        notes,
        tombstone,
        created_at,
        updated_at
      FROM flow_debts
      WHERE id = ?
        AND COALESCE(tombstone, 0) = 0
    `,
    [id],
  );
}

function debtToRow(debt: FlowDebt, updatedAt: string) {
  return {
    id: debt.id,
    name: debt.name,
    lender: debt.lender ?? null,
    actual_account_id: debt.actualAccountId ?? null,
    actual_category_id: debt.actualCategoryId ?? null,
    original_amount: debt.originalAmount,
    current_balance_override: debt.currentBalanceOverride ?? null,
    minimum_payment: debt.minimumPayment,
    planned_payment: debt.plannedPayment,
    due_day: debt.dueDay ?? null,
    interest_rate_bps: debt.interestRateBps,
    priority: debt.priority,
    status: debt.status,
    active: debt.active ? 1 : 0,
    notes: debt.notes ?? null,
    tombstone: 0,
    updated_at: updatedAt,
  };
}

function rowToDebt(row: FlowDebtRow): FlowDebt | null {
  const id = getString(row.id);
  const name = getString(row.name);

  if (!id || !name) {
    return null;
  }

  const priority = getString(row.priority);
  const status = getString(row.status);
  const dueDay = getInteger(row.due_day);

  return {
    id,
    name,
    lender: getString(row.lender),
    actualAccountId: getString(row.actual_account_id),
    actualCategoryId: getString(row.actual_category_id),
    originalAmount: Math.max(0, getInteger(row.original_amount) ?? 0),
    currentBalanceOverride: getOptionalNonNegativeInteger(
      row.current_balance_override,
    ),
    minimumPayment: Math.max(0, getInteger(row.minimum_payment) ?? 0),
    plannedPayment: Math.max(0, getInteger(row.planned_payment) ?? 0),
    dueDay: isValidDueDay(dueDay) ? dueDay : undefined,
    interestRateBps: Math.max(0, getInteger(row.interest_rate_bps) ?? 0),
    priority: isFlowDebtPriority(priority) ? priority : 'normal',
    status: isFlowDebtStatus(status) ? status : 'active',
    active: row.active !== 0,
    notes: getString(row.notes),
    createdAt: getString(row.created_at),
    updatedAt: getString(row.updated_at),
  };
}

function normalizeDebt(debt: FlowDebtSaveRequest): FlowDebt {
  const id = getString(debt.id) ?? createDebtId();
  const name = getString(debt.name)?.trim();
  const priority = getString(debt.priority);
  const status = getString(debt.status);
  const dueDay = getInteger(debt.dueDay);

  if (!name) {
    throw new Error('Debt name is required.');
  }

  return {
    id,
    name,
    lender: getTrimmedString(debt.lender),
    actualAccountId: getTrimmedString(debt.actualAccountId),
    actualCategoryId: getTrimmedString(debt.actualCategoryId),
    originalAmount: Math.max(0, getInteger(debt.originalAmount) ?? 0),
    currentBalanceOverride: getOptionalNonNegativeInteger(
      debt.currentBalanceOverride,
    ),
    minimumPayment: Math.max(0, getInteger(debt.minimumPayment) ?? 0),
    plannedPayment: Math.max(0, getInteger(debt.plannedPayment) ?? 0),
    dueDay: isValidDueDay(dueDay) ? dueDay : undefined,
    interestRateBps: Math.max(0, getInteger(debt.interestRateBps) ?? 0),
    priority: isFlowDebtPriority(priority) ? priority : 'normal',
    status: isFlowDebtStatus(status) ? status : 'active',
    active: getBoolean(debt.active) ?? true,
    notes: getTrimmedString(debt.notes),
  };
}

function requireDebtId(id: string): string {
  if (!id) {
    throw new Error('Debt id is required.');
  }

  return id;
}

function createDebtId() {
  return `flow-debt:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`;
}

function getTrimmedString(value: unknown): string | undefined {
  const stringValue = getString(value)?.trim();
  return stringValue ? stringValue : undefined;
}

function getOptionalNonNegativeInteger(value: unknown): number | undefined {
  const integer = getInteger(value);

  if (integer == null) {
    return undefined;
  }

  return Math.max(0, integer);
}

function isValidDueDay(value: number | undefined): value is number {
  return value != null && value >= 1 && value <= 31;
}

async function selectTransactionMetadataRow(
  actualTransactionId: string,
): Promise<FlowTransactionMetadataRow | null> {
  return db.first<FlowTransactionMetadataRow>(
    `
      SELECT id, actual_transaction_id, data, created_at, updated_at, tombstone
      FROM flow_transaction_metadata
      WHERE actual_transaction_id = ?
        AND COALESCE(tombstone, 0) = 0
    `,
    [actualTransactionId],
  );
}

function rowToTransactionMetadataRecord(
  row: FlowTransactionMetadataRow,
): FlowTransactionMetadataRecord | null {
  if (!row.data) {
    return null;
  }

  return {
    actualTransactionId: row.actual_transaction_id ?? row.id,
    data: normalizeFlowTransactionMetadataData(parseMetadataJson(row.data)),
    exists: true,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function parseMetadataJson(json: string): unknown {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return null;
  }
}

function requireActualTransactionId(actualTransactionId: string): string {
  if (!actualTransactionId) {
    throw new Error('Actual transaction id is required.');
  }

  return actualTransactionId;
}

function dedupeTransactionIds(actualTransactionIds: string[]): string[] {
  return [...new Set(actualTransactionIds.filter(Boolean))];
}

function isTransactionMetadataRecord(
  record: FlowTransactionMetadataRecord | null,
): record is FlowTransactionMetadataRecord {
  return record !== null;
}

async function getSettlements({
  month,
}: FlowSettlementsMonthRequest): Promise<FlowSettlementSnapshot> {
  const normalizedMonth = requireMonth(month);

  const [settlementRows, itemRows] = await Promise.all([
    selectSettlementRows(normalizedMonth),
    selectSettlementItemRows(normalizedMonth),
  ]);

  return {
    settlements: settlementRows
      .map(rowToSettlementSummary)
      .filter(isSettlementSummary),
    items: itemRows.map(rowToSettlementItem).filter(isSettlementItem),
  };
}

async function getSettlementItems({
  month,
}: FlowSettlementsMonthRequest): Promise<FlowSettlementItemsResponse> {
  const itemRows = await selectSettlementItemRows(requireMonth(month));

  return {
    items: itemRows.map(rowToSettlementItem).filter(isSettlementItem),
  };
}

async function getSettlementPaymentLinks({
  month,
}: FlowSettlementsMonthRequest): Promise<FlowSettlementPaymentLinksResponse> {
  const rows = await selectSettlementPaymentLinkRows(requireMonth(month));

  return {
    links: rows.map(rowToSettlementPaymentLink).filter(isSettlementPaymentLink),
  };
}

async function saveSettlementPaymentLink({
  settlementId,
  month,
  paymentTransactionId,
  amount,
  notes,
}: FlowSettlementPaymentLinkSaveRequest): Promise<FlowSettlementPaymentLinkSaveResponse> {
  const normalizedMonth = requireMonth(month);
  const normalizedSettlementId = requireSettlementId(settlementId);
  const normalizedPaymentTransactionId =
    requireActualTransactionId(paymentTransactionId);
  const normalizedAmount = Math.abs(requireNonNegativeInteger(amount));
  const now = new Date().toISOString();

  await assertSettlementMonthNotClosed(normalizedMonth);

  await batchMessages(async () => {
    await upsertSettlementPaymentLinkRow(
      {
        id: paymentLinkIdFor(normalizedSettlementId),
        settlementId: normalizedSettlementId,
        month: normalizedMonth,
        paymentTransactionId: normalizedPaymentTransactionId,
        amount: normalizedAmount,
        linkStatus: 'linked',
        notes: getString(notes),
      },
      now,
    );
    await updateSettlementPaymentState(
      normalizedSettlementId,
      normalizedPaymentTransactionId,
      'paid',
      now,
    );
    await upsertSettlementMonthClosureIfNotClosed(
      normalizedMonth,
      'payment-linked',
      now,
    );
  });

  return { saved: true };
}

async function deleteSettlementPaymentLink({
  settlementId,
  month,
}: FlowSettlementPaymentLinkDeleteRequest): Promise<FlowSettlementPaymentLinkDeleteResponse> {
  const normalizedMonth = requireMonth(month);
  const normalizedSettlementId = requireSettlementId(settlementId);
  const now = new Date().toISOString();
  const existingRow = await db.first<Pick<FlowSettlementPaymentLinkRow, 'id'>>(
    'SELECT id FROM flow_settlement_payment_links WHERE id = ?',
    [paymentLinkIdFor(normalizedSettlementId)],
  );

  await assertSettlementMonthNotClosed(normalizedMonth);

  await batchMessages(async () => {
    if (existingRow) {
      await db.update('flow_settlement_payment_links', {
        id: existingRow.id,
        link_status: 'unlinked',
        tombstone: 1,
        updated_at: now,
      });
    }

    await updateSettlementPaymentState(
      normalizedSettlementId,
      null,
      'open',
      now,
    );
    await refreshSettlementMonthClosureFromLinks(normalizedMonth, now);
  });

  return { deleted: Boolean(existingRow) };
}

async function getSettlementMonthClose({
  month,
}: FlowSettlementsMonthRequest): Promise<FlowSettlementMonthClosure | null> {
  const row = await selectSettlementMonthClosureRow(requireMonth(month));

  return row ? rowToSettlementMonthClosure(row) : null;
}

async function saveSettlementMonthClose({
  month,
  status,
  notes,
}: FlowSettlementMonthCloseSaveRequest): Promise<FlowSettlementMonthCloseSaveResponse> {
  const normalizedMonth = requireMonth(month);

  if (status !== 'closed') {
    throw new Error('Settlement month close status must be closed.');
  }

  const now = new Date().toISOString();

  await batchMessages(async () => {
    await upsertSettlementMonthClosure(
      {
        month: normalizedMonth,
        status: 'closed',
        closedAt: now,
        notes: getString(notes),
      },
      now,
    );
    await updateSettlementRowsForMonthStatus(normalizedMonth, 'closed', now);
  });

  return { saved: true };
}

async function reopenSettlementMonth({
  month,
  notes,
}: FlowSettlementMonthReopenRequest): Promise<FlowSettlementMonthReopenResponse> {
  const normalizedMonth = requireMonth(month);
  const now = new Date().toISOString();

  await batchMessages(async () => {
    await upsertSettlementMonthClosure(
      {
        month: normalizedMonth,
        status: 'reopened',
        reopenedAt: now,
        notes: getString(notes),
      },
      now,
    );
    await updateSettlementRowsForMonthOpenState(normalizedMonth, now);
  });

  return { reopened: true };
}

async function saveSettlements({
  month,
  settlements,
  items,
}: FlowSettlementsSaveRequest): Promise<FlowSettlementsSaveResponse> {
  const normalizedMonth = requireMonth(month);
  const now = new Date().toISOString();

  await assertSettlementMonthNotClosed(normalizedMonth);

  const normalizedSettlements = (settlements ?? [])
    .map(settlement => normalizeSettlementSummary(normalizedMonth, settlement))
    .filter(isSettlementSummary);
  const normalizedItems = (items ?? [])
    .map(item => normalizeSettlementItem(item))
    .filter(isSettlementItem);

  await batchMessages(async () => {
    await tombstoneSettlementsForMonth(normalizedMonth, now);

    for (const settlement of normalizedSettlements) {
      await upsertSettlementRow(settlement, now);
    }

    for (const item of normalizedItems) {
      await upsertSettlementItemRow(normalizedMonth, item, now);
    }

    await upsertSettlementMonthClosureIfNotClosed(
      normalizedMonth,
      'calculated',
      now,
    );
  });

  return { saved: true };
}

async function deleteSettlements({
  month,
}: FlowSettlementsMonthRequest): Promise<FlowSettlementsDeleteResponse> {
  const normalizedMonth = requireMonth(month);
  const now = new Date().toISOString();

  await assertSettlementMonthNotClosed(normalizedMonth);

  await batchMessages(async () => {
    await tombstoneSettlementsForMonth(normalizedMonth, now);
    await tombstoneSettlementPaymentLinksForMonth(normalizedMonth, now);
    await upsertSettlementMonthClosureIfNotClosed(normalizedMonth, 'open', now);
  });
  return { deleted: true };
}

async function selectSettlementRows(
  month: string,
): Promise<FlowSettlementRow[]> {
  return db.all<FlowSettlementRow>(
    `
      SELECT
        id,
        month,
        from_member_id,
        to_member_id,
        amount,
        item_count,
        status,
        payment_transaction_id,
        notes,
        tombstone,
        created_at,
        updated_at
      FROM flow_settlements
      WHERE month = ?
        AND COALESCE(tombstone, 0) = 0
      ORDER BY from_member_id, to_member_id
    `,
    [month],
  );
}

async function selectSettlementItemRows(
  month: string,
): Promise<FlowSettlementItemRow[]> {
  return db.all<FlowSettlementItemRow>(
    `
      SELECT
        id,
        settlement_id,
        month,
        actual_transaction_id,
        owed_by_member_id,
        owed_to_member_id,
        amount,
        source_amount,
        split_method,
        settlement_status,
        notes,
        tombstone,
        created_at,
        updated_at
      FROM flow_settlement_items
      WHERE month = ?
        AND COALESCE(tombstone, 0) = 0
      ORDER BY actual_transaction_id, owed_by_member_id, owed_to_member_id
    `,
    [month],
  );
}

async function selectSettlementPaymentLinkRows(
  month: string,
): Promise<FlowSettlementPaymentLinkRow[]> {
  return db.all<FlowSettlementPaymentLinkRow>(
    `
      SELECT
        id,
        settlement_id,
        month,
        payment_transaction_id,
        amount,
        link_status,
        notes,
        tombstone,
        created_at,
        updated_at
      FROM flow_settlement_payment_links
      WHERE month = ?
        AND COALESCE(tombstone, 0) = 0
      ORDER BY settlement_id, payment_transaction_id
    `,
    [month],
  );
}

async function selectSettlementPaymentLinkRow(
  settlementId: string,
): Promise<FlowSettlementPaymentLinkRow | null> {
  return db.first<FlowSettlementPaymentLinkRow>(
    `
      SELECT
        id,
        settlement_id,
        month,
        payment_transaction_id,
        amount,
        link_status,
        notes,
        tombstone,
        created_at,
        updated_at
      FROM flow_settlement_payment_links
      WHERE settlement_id = ?
        AND COALESCE(tombstone, 0) = 0
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [settlementId],
  );
}

async function selectSettlementMonthClosureRow(
  month: string,
): Promise<FlowSettlementMonthClosureRow | null> {
  return db.first<FlowSettlementMonthClosureRow>(
    `
      SELECT
        id,
        month,
        status,
        closed_at,
        reopened_at,
        notes,
        tombstone,
        created_at,
        updated_at
      FROM flow_settlement_month_closures
      WHERE month = ?
        AND COALESCE(tombstone, 0) = 0
      ORDER BY updated_at DESC
      LIMIT 1
    `,
    [month],
  );
}

async function tombstoneSettlementsForMonth(
  month: string,
  updatedAt: string,
): Promise<void> {
  const settlementRows = await db.all<Pick<FlowSettlementRow, 'id'>>(
    `
      SELECT id
      FROM flow_settlements
      WHERE month = ?
        AND COALESCE(tombstone, 0) = 0
    `,
    [month],
  );
  const itemRows = await db.all<Pick<FlowSettlementItemRow, 'id'>>(
    `
      SELECT id
      FROM flow_settlement_items
      WHERE month = ?
        AND COALESCE(tombstone, 0) = 0
    `,
    [month],
  );

  for (const row of settlementRows) {
    await db.update('flow_settlements', {
      id: row.id,
      tombstone: 1,
      updated_at: updatedAt,
    });
  }

  for (const row of itemRows) {
    await db.update('flow_settlement_items', {
      id: row.id,
      tombstone: 1,
      updated_at: updatedAt,
    });
  }
}

async function tombstoneSettlementPaymentLinksForMonth(
  month: string,
  updatedAt: string,
): Promise<void> {
  const linkRows = await db.all<Pick<FlowSettlementPaymentLinkRow, 'id'>>(
    `
      SELECT id
      FROM flow_settlement_payment_links
      WHERE month = ?
        AND COALESCE(tombstone, 0) = 0
    `,
    [month],
  );

  for (const row of linkRows) {
    await db.update('flow_settlement_payment_links', {
      id: row.id,
      link_status: 'unlinked',
      tombstone: 1,
      updated_at: updatedAt,
    });
  }
}

async function upsertSettlementRow(
  settlement: FlowSettlementSummary,
  now: string,
): Promise<void> {
  const id = settlementIdFor(
    settlement.month,
    settlement.fromMemberId,
    settlement.toMemberId,
  );
  const existingRow = await db.first<Pick<FlowSettlementRow, 'id'>>(
    'SELECT id FROM flow_settlements WHERE id = ?',
    [id],
  );
  const paymentLink = await selectSettlementPaymentLinkRow(id);
  const linkedPaymentTransactionId =
    settlement.paymentTransactionId ??
    getString(paymentLink?.payment_transaction_id);
  const status =
    linkedPaymentTransactionId && settlement.status === 'open'
      ? 'paid'
      : settlement.status;
  const row = {
    id,
    month: settlement.month,
    from_member_id: settlement.fromMemberId,
    to_member_id: settlement.toMemberId,
    amount: settlement.amount,
    item_count: settlement.itemCount,
    status,
    payment_transaction_id: linkedPaymentTransactionId ?? null,
    updated_at: now,
    tombstone: 0,
  };

  if (existingRow) {
    await db.update('flow_settlements', row);
  } else {
    await db.insert('flow_settlements', {
      ...row,
      created_at: now,
    });
  }
}

async function upsertSettlementPaymentLinkRow(
  link: FlowSettlementPaymentLink,
  now: string,
): Promise<void> {
  const existingRow = await db.first<Pick<FlowSettlementPaymentLinkRow, 'id'>>(
    'SELECT id FROM flow_settlement_payment_links WHERE id = ?',
    [link.id],
  );
  const row = {
    id: link.id,
    settlement_id: link.settlementId,
    month: link.month,
    payment_transaction_id: link.paymentTransactionId,
    amount: link.amount,
    link_status: link.linkStatus,
    notes: link.notes ?? null,
    updated_at: now,
    tombstone: 0,
  };

  if (existingRow) {
    await db.update('flow_settlement_payment_links', row);
  } else {
    await db.insert('flow_settlement_payment_links', {
      ...row,
      created_at: now,
    });
  }
}

async function upsertSettlementMonthClosure(
  closure: FlowSettlementMonthClosure,
  now: string,
): Promise<void> {
  const id = monthClosureIdFor(closure.month);
  const existingRow = await db.first<Pick<FlowSettlementMonthClosureRow, 'id'>>(
    'SELECT id FROM flow_settlement_month_closures WHERE id = ?',
    [id],
  );
  const existingClosure = existingRow
    ? await selectSettlementMonthClosureRow(closure.month)
    : null;
  const row = {
    id,
    month: closure.month,
    status: closure.status,
    closed_at: closure.closedAt ?? existingClosure?.closed_at ?? null,
    reopened_at: closure.reopenedAt ?? existingClosure?.reopened_at ?? null,
    notes: closure.notes ?? existingClosure?.notes ?? null,
    updated_at: now,
    tombstone: 0,
  };

  if (existingRow) {
    await db.update('flow_settlement_month_closures', row);
  } else {
    await db.insert('flow_settlement_month_closures', {
      ...row,
      created_at: now,
    });
  }
}

async function upsertSettlementMonthClosureIfNotClosed(
  month: string,
  status: FlowSettlementMonthStatus,
  now: string,
): Promise<void> {
  const existingClosure = await selectSettlementMonthClosureRow(month);

  if (existingClosure?.status === 'closed') {
    return;
  }

  await upsertSettlementMonthClosure(
    {
      month,
      status,
      closedAt: existingClosure?.closed_at ?? undefined,
      reopenedAt: existingClosure?.reopened_at ?? undefined,
      notes: existingClosure?.notes ?? undefined,
    },
    now,
  );
}

async function refreshSettlementMonthClosureFromLinks(
  month: string,
  now: string,
): Promise<void> {
  const existingClosure = await selectSettlementMonthClosureRow(month);

  if (existingClosure?.status === 'closed') {
    return;
  }

  const linkCount = await db.first<{ count: number }>(
    `
      SELECT COUNT(*) AS count
      FROM flow_settlement_payment_links
      WHERE month = ?
        AND COALESCE(tombstone, 0) = 0
    `,
    [month],
  );
  const settlementCount = await db.first<{ count: number }>(
    `
      SELECT COUNT(*) AS count
      FROM flow_settlements
      WHERE month = ?
        AND COALESCE(tombstone, 0) = 0
    `,
    [month],
  );
  const nextStatus =
    (linkCount?.count ?? 0) > 0
      ? 'payment-linked'
      : (settlementCount?.count ?? 0) > 0
        ? 'calculated'
        : 'open';

  await upsertSettlementMonthClosure(
    {
      month,
      status: nextStatus,
      closedAt: existingClosure?.closed_at ?? undefined,
      reopenedAt: existingClosure?.reopened_at ?? undefined,
      notes: existingClosure?.notes ?? undefined,
    },
    now,
  );
}

async function assertSettlementMonthNotClosed(month: string): Promise<void> {
  const existingClosure = await selectSettlementMonthClosureRow(month);

  if (existingClosure?.status === 'closed') {
    throw new Error('Settlement month is closed. Reopen it before editing.');
  }
}

async function updateSettlementPaymentState(
  settlementId: string,
  paymentTransactionId: string | null,
  status: 'open' | 'paid',
  updatedAt: string,
): Promise<void> {
  const existingRow = await db.first<Pick<FlowSettlementRow, 'id'>>(
    'SELECT id FROM flow_settlements WHERE id = ?',
    [settlementId],
  );

  if (!existingRow) {
    return;
  }

  await db.update('flow_settlements', {
    id: settlementId,
    payment_transaction_id: paymentTransactionId,
    status,
    updated_at: updatedAt,
    tombstone: 0,
  });
}

async function updateSettlementRowsForMonthStatus(
  month: string,
  status: FlowSettlementStatus,
  updatedAt: string,
): Promise<void> {
  const rows = await db.all<Pick<FlowSettlementRow, 'id'>>(
    `
      SELECT id
      FROM flow_settlements
      WHERE month = ?
        AND COALESCE(tombstone, 0) = 0
    `,
    [month],
  );

  for (const row of rows) {
    await db.update('flow_settlements', {
      id: row.id,
      status,
      updated_at: updatedAt,
    });
  }
}

async function updateSettlementRowsForMonthOpenState(
  month: string,
  updatedAt: string,
): Promise<void> {
  const rows = await db.all<
    Pick<FlowSettlementRow, 'id' | 'payment_transaction_id'>
  >(
    `
      SELECT id, payment_transaction_id
      FROM flow_settlements
      WHERE month = ?
        AND COALESCE(tombstone, 0) = 0
    `,
    [month],
  );

  for (const row of rows) {
    await db.update('flow_settlements', {
      id: row.id,
      status: row.payment_transaction_id ? 'paid' : 'open',
      updated_at: updatedAt,
    });
  }
}

async function upsertSettlementItemRow(
  month: string,
  item: FlowSettlementItem,
  now: string,
): Promise<void> {
  const existingRow = await db.first<Pick<FlowSettlementItemRow, 'id'>>(
    'SELECT id FROM flow_settlement_items WHERE id = ?',
    [item.id],
  );
  const row = {
    id: item.id,
    settlement_id: settlementIdFor(
      month,
      item.owedByMemberId,
      item.owedToMemberId,
    ),
    month,
    actual_transaction_id: item.actualTransactionId,
    owed_by_member_id: item.owedByMemberId,
    owed_to_member_id: item.owedToMemberId,
    amount: item.amount,
    source_amount: item.sourceAmount,
    split_method: item.splitMethod,
    settlement_status: item.settlementStatus ?? null,
    notes: item.notes ?? null,
    updated_at: now,
    tombstone: 0,
  };

  if (existingRow) {
    await db.update('flow_settlement_items', row);
  } else {
    await db.insert('flow_settlement_items', {
      ...row,
      created_at: now,
    });
  }
}

function rowToSettlementSummary(
  row: FlowSettlementRow,
): FlowSettlementSummary | null {
  const month = getString(row.month);
  const fromMemberId = getString(row.from_member_id);
  const toMemberId = getString(row.to_member_id);
  const amount = getInteger(row.amount);

  if (!month || !fromMemberId || !toMemberId || amount == null) {
    return null;
  }

  const status = row.status ?? undefined;

  return {
    month,
    fromMemberId,
    toMemberId,
    amount,
    itemCount: getInteger(row.item_count) ?? 0,
    status: isFlowSettlementStatus(status) ? status : 'open',
    paymentTransactionId: getString(row.payment_transaction_id),
  };
}

function rowToSettlementPaymentLink(
  row: FlowSettlementPaymentLinkRow,
): FlowSettlementPaymentLink | null {
  const id = getString(row.id);
  const settlementId = getString(row.settlement_id);
  const month = getString(row.month);
  const paymentTransactionId = getString(row.payment_transaction_id);
  const amount = getInteger(row.amount);

  if (
    !id ||
    !settlementId ||
    !month ||
    !paymentTransactionId ||
    amount == null
  ) {
    return null;
  }

  const linkStatus = getString(row.link_status);

  return {
    id,
    settlementId,
    month,
    paymentTransactionId,
    amount,
    linkStatus: isFlowSettlementPaymentLinkStatus(linkStatus)
      ? linkStatus
      : 'linked',
    notes: getString(row.notes),
    createdAt: getString(row.created_at),
    updatedAt: getString(row.updated_at),
  };
}

function rowToSettlementMonthClosure(
  row: FlowSettlementMonthClosureRow,
): FlowSettlementMonthClosure | null {
  const month = getString(row.month);

  if (!month) {
    return null;
  }

  const status = getString(row.status);

  return {
    month,
    status: isFlowSettlementMonthStatus(status) ? status : 'open',
    closedAt: getString(row.closed_at),
    reopenedAt: getString(row.reopened_at),
    notes: getString(row.notes),
    createdAt: getString(row.created_at),
    updatedAt: getString(row.updated_at),
  };
}

function rowToSettlementItem(
  row: FlowSettlementItemRow,
): FlowSettlementItem | null {
  const id = getString(row.id);
  const actualTransactionId = getString(row.actual_transaction_id);
  const owedByMemberId = getString(row.owed_by_member_id);
  const owedToMemberId = getString(row.owed_to_member_id);
  const amount = getInteger(row.amount);
  const sourceAmount = getInteger(row.source_amount);

  if (
    !id ||
    !actualTransactionId ||
    !owedByMemberId ||
    !owedToMemberId ||
    amount == null ||
    sourceAmount == null
  ) {
    return null;
  }

  return {
    id,
    actualTransactionId,
    owedByMemberId,
    owedToMemberId,
    amount,
    sourceAmount,
    splitMethod: getString(row.split_method) ?? 'unknown',
    settlementStatus: getString(row.settlement_status),
    notes: getString(row.notes),
  };
}

function normalizeSettlementSummary(
  month: string,
  settlement: FlowSettlementSummary,
): FlowSettlementSummary | null {
  const fromMemberId = getString(settlement?.fromMemberId);
  const toMemberId = getString(settlement?.toMemberId);
  const amount = getInteger(settlement?.amount);

  if (!fromMemberId || !toMemberId || amount == null || amount <= 0) {
    return null;
  }

  return {
    month,
    fromMemberId,
    toMemberId,
    amount,
    itemCount: Math.max(0, getInteger(settlement?.itemCount) ?? 0),
    status: isFlowSettlementStatus(settlement?.status)
      ? settlement.status
      : 'open',
    paymentTransactionId: getString(settlement?.paymentTransactionId),
  };
}

function normalizeSettlementItem(
  item: FlowSettlementItem,
): FlowSettlementItem | null {
  const id = getString(item?.id);
  const actualTransactionId = getString(item?.actualTransactionId);
  const owedByMemberId = getString(item?.owedByMemberId);
  const owedToMemberId = getString(item?.owedToMemberId);
  const amount = getInteger(item?.amount);
  const sourceAmount = getInteger(item?.sourceAmount);
  const splitMethod = getString(item?.splitMethod);

  if (
    !id ||
    !actualTransactionId ||
    !owedByMemberId ||
    !owedToMemberId ||
    amount == null ||
    amount <= 0 ||
    sourceAmount == null ||
    sourceAmount < 0 ||
    !splitMethod
  ) {
    return null;
  }

  return {
    id,
    actualTransactionId,
    owedByMemberId,
    owedToMemberId,
    amount,
    sourceAmount,
    splitMethod,
    notes: getString(item.notes),
    settlementStatus: getString(item.settlementStatus),
  };
}

function settlementIdFor(
  month: string,
  fromMemberId: string,
  toMemberId: string,
) {
  return `flow-settlement:${month}:${fromMemberId}:${toMemberId}`;
}

function paymentLinkIdFor(settlementId: string) {
  return `flow-settlement-payment-link:${settlementId}`;
}

function monthClosureIdFor(month: string) {
  return `flow-settlement-month-close:${month}`;
}

function requireMonth(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error('Settlement month must use YYYY-MM format.');
  }

  return month;
}

function requireSettlementId(settlementId: string): string {
  if (!settlementId) {
    throw new Error('Settlement id is required.');
  }

  return settlementId;
}

function requireNonNegativeInteger(value: number): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      'Settlement payment amount must be a non-negative integer.',
    );
  }

  return value;
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function getInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isInteger(value)
    ? value
    : undefined;
}

function getBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value !== 0;
  }

  return undefined;
}

function isSettlementSummary(
  settlement: FlowSettlementSummary | null,
): settlement is FlowSettlementSummary {
  return settlement !== null;
}

function isSettlementItem(
  item: FlowSettlementItem | null,
): item is FlowSettlementItem {
  return item !== null;
}

function isSettlementPaymentLink(
  link: FlowSettlementPaymentLink | null,
): link is FlowSettlementPaymentLink {
  return link !== null;
}

function isDebt(debt: FlowDebt | null): debt is FlowDebt {
  return debt !== null;
}
