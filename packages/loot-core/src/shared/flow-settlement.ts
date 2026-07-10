export const flowSettlementStatuses = [
  'open',
  'paid',
  'closed',
  'adjusted',
  'ignored',
] as const;

export type FlowSettlementStatus = (typeof flowSettlementStatuses)[number];

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
