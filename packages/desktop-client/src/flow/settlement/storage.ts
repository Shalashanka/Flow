import { send } from '@actual-app/core/platform/client/connection';

import {
  getFlowTransactionMetadataMany,
  saveFlowTransactionMetadata,
} from '#flow/transaction-metadata/storage';

import type {
  FlowSettlementCalculation,
  FlowSettlementItem,
  FlowSettlementMonthClosure,
  FlowSettlementPaymentLink,
  FlowSettlementSnapshot,
  FlowSettlementSummary,
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

export async function getSettlementPaymentLinks(
  month: string,
): Promise<FlowSettlementPaymentLink[]> {
  const response = await send('flow/settlement-payment-links-get', { month });
  return response.links;
}

export async function saveSettlementPaymentLink({
  settlementId,
  month,
  paymentTransactionId,
  amount,
  notes,
}: {
  settlementId: string;
  month: string;
  paymentTransactionId: string;
  amount: number;
  notes?: string;
}): Promise<{ saved: boolean }> {
  return send('flow/settlement-payment-link-save', {
    settlementId,
    month,
    paymentTransactionId,
    amount,
    notes,
  });
}

export async function deleteSettlementPaymentLink(
  settlementId: string,
  month: string,
): Promise<{ deleted: boolean }> {
  return send('flow/settlement-payment-link-delete', { settlementId, month });
}

export async function getSettlementMonthClose(
  month: string,
): Promise<FlowSettlementMonthClosure | null> {
  return send('flow/settlement-month-close-get', { month });
}

export async function closeSettlementMonth(
  month: string,
  notes?: string,
): Promise<{ saved: boolean }> {
  return send('flow/settlement-month-close-save', {
    month,
    status: 'closed',
    notes,
  });
}

export async function reopenSettlementMonth(
  month: string,
  notes?: string,
): Promise<{ reopened: boolean }> {
  return send('flow/settlement-month-reopen', { month, notes });
}

export function getSettlementId(summary: FlowSettlementSummary) {
  return `flow-settlement:${summary.month}:${summary.fromMemberId}:${summary.toMemberId}`;
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
