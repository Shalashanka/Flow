import { send } from '@actual-app/core/platform/client/connection';

import type { FlowAffordabilityCheck } from './types';

export async function getFlowAffordabilityChecks(
  month?: string,
): Promise<FlowAffordabilityCheck[]> {
  return send('flow/affordability-checks-get', { month });
}

export async function saveFlowAffordabilityCheck(
  check: FlowAffordabilityCheck,
): Promise<FlowAffordabilityCheck> {
  return send('flow/affordability-check-save', { check });
}

export async function deleteFlowAffordabilityCheck(
  id: string,
): Promise<{ deleted: boolean }> {
  return send('flow/affordability-check-delete', { id });
}
