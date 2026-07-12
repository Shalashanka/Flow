import { send } from '@actual-app/core/platform/client/connection';

import type { FlowSubscription, FlowSubscriptionMatch } from './types';

export async function getFlowSubscriptions(): Promise<FlowSubscription[]> {
  return send('flow/subscriptions-get');
}

export async function saveFlowSubscription(
  subscription: Partial<FlowSubscription>,
): Promise<FlowSubscription> {
  return send('flow/subscription-save', subscription);
}

export async function deleteFlowSubscription(
  id: string,
): Promise<{ deleted: boolean }> {
  return send('flow/subscription-delete', { id });
}

export async function getFlowSubscriptionMatches(
  subscriptionId?: string,
): Promise<FlowSubscriptionMatch[]> {
  return send('flow/subscription-matches-get', { subscriptionId });
}

export async function saveFlowSubscriptionMatches(
  subscriptionId: string,
  matches: FlowSubscriptionMatch[],
): Promise<{ saved: boolean; count: number }> {
  return send('flow/subscription-matches-save', {
    subscriptionId,
    matches,
  });
}
