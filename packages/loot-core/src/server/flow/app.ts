import { createApp } from '#server/app';
import * as db from '#server/db';
import { mutator } from '#server/mutators';

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

export type FlowHandlers = {
  'flow/settings-get': typeof getFlowSettingsRow;
  'flow/settings-save': typeof saveFlowSettingsRow;
};

export const app = createApp<FlowHandlers>();

app.method('flow/settings-get', getFlowSettingsRow);
app.method('flow/settings-save', mutator(saveFlowSettingsRow));

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
