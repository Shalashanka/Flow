import { send } from '@actual-app/core/platform/client/connection';

import { getFlowSettings } from '#flow/planning/storage';
import type {
  FlowSettings,
  FlowSplitMethod as FlowSettingsSplitMethod,
} from '#flow/planning/types';

import {
  createDefaultFlowTransactionMetadataData,
  normalizeFlowTransactionMetadataData,
} from './normalize';
import type {
  FlowSharedStatus,
  FlowSplitMethod,
  FlowTransactionMetadataData,
  FlowTransactionMetadataRecord,
} from './types';

type SplitDefaults = {
  sharedStatus: FlowSharedStatus;
  splitMethod: FlowSplitMethod;
};

export async function getFlowTransactionMetadata(
  actualTransactionId: string,
): Promise<FlowTransactionMetadataRecord> {
  const defaultData = await getDefaultMetadataData();

  try {
    const record = await send('flow/transaction-metadata-get', {
      actualTransactionId,
    });

    return record
      ? normalizeRecord(record)
      : createDefaultRecord(actualTransactionId, defaultData);
  } catch {
    return createDefaultRecord(actualTransactionId, defaultData);
  }
}

export async function getFlowTransactionMetadataMany(
  actualTransactionIds: string[],
): Promise<FlowTransactionMetadataRecord[]> {
  const ids = dedupeTransactionIds(actualTransactionIds);
  const defaultData = await getDefaultMetadataData();

  if (ids.length === 0) {
    return [];
  }

  try {
    const records = await send('flow/transaction-metadata-get-many', {
      actualTransactionIds: ids,
    });
    const recordsByTransactionId = new Map(
      records.map(record => [
        record.actualTransactionId,
        normalizeRecord(record),
      ]),
    );

    return ids.map(
      id =>
        recordsByTransactionId.get(id) ?? createDefaultRecord(id, defaultData),
    );
  } catch {
    return ids.map(id => createDefaultRecord(id, defaultData));
  }
}

export async function getFlowTransactionMetadataBySettlementMonth(
  settlementMonth: string,
): Promise<FlowTransactionMetadataRecord[]> {
  try {
    const records = await send(
      'flow/transaction-metadata-get-by-settlement-month',
      { settlementMonth },
    );

    return records.map(normalizeRecord);
  } catch {
    return [];
  }
}

export async function saveFlowTransactionMetadata(
  actualTransactionId: string,
  data: FlowTransactionMetadataData,
): Promise<FlowTransactionMetadataRecord> {
  const record = await send('flow/transaction-metadata-save', {
    actualTransactionId,
    data: normalizeFlowTransactionMetadataData(data),
  });

  return normalizeRecord(record);
}

export async function deleteFlowTransactionMetadata(
  actualTransactionId: string,
): Promise<{ deleted: boolean }> {
  return send('flow/transaction-metadata-delete', { actualTransactionId });
}

async function getDefaultMetadataData(): Promise<FlowTransactionMetadataData> {
  try {
    return createDefaultFlowTransactionMetadataDataFromSettings(
      await getFlowSettings(),
    );
  } catch {
    return createDefaultFlowTransactionMetadataData();
  }
}

export function createDefaultFlowTransactionMetadataDataFromSettings(
  settings: FlowSettings,
): FlowTransactionMetadataData {
  const splitDefaults = getSplitDefaults(
    settings.transactionRules.defaultSplitMethod,
  );

  return createDefaultFlowTransactionMetadataData({
    paidByMemberId: settings.transactionRules.defaultPaidByMemberId,
    enteredByMemberId: settings.transactionRules.defaultEnteredByMemberId,
    cashflowIncluded: settings.transactionRules.defaultCashflowIncluded,
    ...splitDefaults,
  });
}

function getSplitDefaults(splitMethod: FlowSettingsSplitMethod): SplitDefaults {
  switch (splitMethod) {
    case 'shared-50-50':
      return {
        sharedStatus: 'shared',
        splitMethod: 'equal',
      };
    case 'only-member':
      return {
        sharedStatus: 'personal',
        splitMethod: 'none',
      };
    case 'custom':
      return {
        sharedStatus: 'shared',
        splitMethod: 'custom',
      };
    default:
      return {
        sharedStatus: 'personal',
        splitMethod: 'none',
      };
  }
}

function normalizeRecord(
  record: FlowTransactionMetadataRecord,
): FlowTransactionMetadataRecord {
  return {
    ...record,
    data: normalizeFlowTransactionMetadataData(record.data),
    exists: true,
  };
}

function createDefaultRecord(
  actualTransactionId: string,
  data: FlowTransactionMetadataData,
): FlowTransactionMetadataRecord {
  return {
    actualTransactionId,
    data,
    exists: false,
  };
}

function dedupeTransactionIds(actualTransactionIds: string[]): string[] {
  return [...new Set(actualTransactionIds.filter(Boolean))];
}
