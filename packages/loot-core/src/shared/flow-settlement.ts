export const flowSettlementStatuses = [
  'open',
  'paid',
  'closed',
  'adjusted',
  'ignored',
] as const;

export type FlowSettlementStatus = (typeof flowSettlementStatuses)[number];

export const flowSettlementPaymentLinkStatuses = [
  'linked',
  'unlinked',
  'ignored',
] as const;

export type FlowSettlementPaymentLinkStatus =
  (typeof flowSettlementPaymentLinkStatuses)[number];

export const flowSettlementMonthStatuses = [
  'open',
  'calculated',
  'payment-linked',
  'closed',
  'reopened',
] as const;

export type FlowSettlementMonthStatus =
  (typeof flowSettlementMonthStatuses)[number];

export type FlowSettlementItem = {
  id: string;
  actualTransactionId: string;
  owedByMemberId: string;
  owedToMemberId: string;
  amount: number;
  sourceAmount: number;
  splitMethod: string;
  notes?: string;
  transactionDate?: string;
  payeeName?: string;
  categoryName?: string;
  paidByMemberId?: string;
  settlementStatus?: string;
};

export type FlowSettlementSummary = {
  month: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  itemCount: number;
  status: FlowSettlementStatus;
  paymentTransactionId?: string;
};

export type FlowSettlementPaymentLink = {
  id: string;
  settlementId: string;
  month: string;
  paymentTransactionId: string;
  amount: number;
  linkStatus: FlowSettlementPaymentLinkStatus;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FlowSettlementMonthClosure = {
  month: string;
  status: FlowSettlementMonthStatus;
  closedAt?: string;
  reopenedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FlowSettlementCalculation = {
  month: string;
  generatedAt: string;
  members: Array<{
    id: string;
    name: string;
  }>;
  items: FlowSettlementItem[];
  summaries: FlowSettlementSummary[];
  warnings: string[];
};

export type FlowSettlementSnapshot = {
  settlements: FlowSettlementSummary[];
  items: FlowSettlementItem[];
};

export function isFlowSettlementStatus(
  value: string | undefined,
): value is FlowSettlementStatus {
  return flowSettlementStatuses.some(status => status === value);
}

export function isFlowSettlementPaymentLinkStatus(
  value: string | undefined,
): value is FlowSettlementPaymentLinkStatus {
  return flowSettlementPaymentLinkStatuses.some(status => status === value);
}

export function isFlowSettlementMonthStatus(
  value: string | undefined,
): value is FlowSettlementMonthStatus {
  return flowSettlementMonthStatuses.some(status => status === value);
}
