import { send } from '@actual-app/core/platform/client/connection';

import {
  getFlowTransactionMetadataMany,
  saveFlowTransactionMetadata,
} from '#flow/transaction-metadata/storage';

import type {
  FlowSettlementCalculation,
  FlowSettlementItem,
  FlowSettlementSnapshot,
} from './types';

export async function getSavedFlowSettlements(
  month: string,
): Promise<FlowSettlementSnapshot> {
  return send('flow/settlements-get', { month });
}

export async function saveFlowSettlementSnapshot(
  calculation: FlowSettlementCalculation,
): Promise<{ saved: boolean }> {
  return send('flow/settlements-save', {
    month: calculation.month,
    settlements: calculation.summaries,
    items: calculation.items,
  });
}

export async function clearFlowSettlementSnapshot(
  month: string,
): Promise<{ deleted: boolean }> {
  return send('flow/settlements-delete', { month });
}

export async function markFlowSettlementTransactionsSettled(
  month: string,
  items: FlowSettlementItem[],
): Promise<{ updated: number }> {
  const transactionIds = [
    ...new Set(items.map(item => item.actualTransactionId).filter(Boolean)),
  ];

  if (transactionIds.length === 0) {
    return { updated: 0 };
  }

  const records = await getFlowTransactionMetadataMany(transactionIds);

  await Promise.all(
    records.map(record =>
      saveFlowTransactionMetadata(record.actualTransactionId, {
        ...record.data,
        settlementStatus: 'settled',
        settlementMonth: month,
      }),
    ),
  );

  return { updated: records.length };
}
