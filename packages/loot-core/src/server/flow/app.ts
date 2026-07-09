import { createApp } from '#server/app';
import * as db from '#server/db';
import { mutator } from '#server/mutators';
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

type FlowTransactionMetadataSaveRequest = {
  actualTransactionId: string;
  data: FlowTransactionMetadataData;
};

type FlowTransactionMetadataDeleteResponse = {
  deleted: boolean;
};

export type FlowHandlers = {
  'flow/settings-get': typeof getFlowSettingsRow;
  'flow/settings-save': typeof saveFlowSettingsRow;
  'flow/transaction-metadata-get': typeof getTransactionMetadata;
  'flow/transaction-metadata-get-many': typeof getTransactionMetadataMany;
  'flow/transaction-metadata-save': typeof saveTransactionMetadata;
  'flow/transaction-metadata-delete': typeof deleteTransactionMetadata;
};

export const app = createApp<FlowHandlers>();

app.method('flow/settings-get', getFlowSettingsRow);
app.method('flow/settings-save', mutator(saveFlowSettingsRow));
app.method('flow/transaction-metadata-get', getTransactionMetadata);
app.method('flow/transaction-metadata-get-many', getTransactionMetadataMany);
app.method('flow/transaction-metadata-save', mutator(saveTransactionMetadata));
app.method(
  'flow/transaction-metadata-delete',
  mutator(deleteTransactionMetadata),
);

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
