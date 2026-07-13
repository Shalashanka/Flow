import { send } from '@actual-app/core/platform/client/connection';

import type { FlowCashflowRow, FlowCashflowRun } from './types';

export async function getFlowCashflowRuns(
  month?: string,
): Promise<FlowCashflowRun[]> {
  return send('flow/cashflow-runs-get', { month });
}

export async function saveFlowCashflowRun(
  run: FlowCashflowRun,
  rows: FlowCashflowRow[],
): Promise<{ saved: boolean; runId: string }> {
  return send('flow/cashflow-run-save', { run, rows });
}

export async function deleteFlowCashflowRun(
  runId: string,
): Promise<{ deleted: boolean }> {
  return send('flow/cashflow-run-delete', { runId });
}

export async function getFlowCashflowRows(
  runId: string,
): Promise<FlowCashflowRow[]> {
  return send('flow/cashflow-rows-get', { runId });
}
