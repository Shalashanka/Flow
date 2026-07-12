import { send } from '@actual-app/core/platform/client/connection';

import type { FlowDebt } from './types';

export async function getFlowDebts(): Promise<FlowDebt[]> {
  return send('flow/debts-get');
}

export async function saveFlowDebt(debt: Partial<FlowDebt>): Promise<FlowDebt> {
  return send('flow/debt-save', debt);
}

export async function deleteFlowDebt(
  id: string,
): Promise<{ deleted: boolean }> {
  return send('flow/debt-delete', { id });
}
