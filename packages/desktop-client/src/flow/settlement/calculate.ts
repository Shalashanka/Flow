import * as monthUtils from '@actual-app/core/shared/months';

import {
  getFlowTransactions,
  getFlowTransactionsByIds,
} from '#flow/actual-adapter';
import type { FlowTransaction } from '#flow/actual-adapter';
import { getFlowSettings } from '#flow/planning/storage';
import type { FlowHouseholdMember, FlowSettings } from '#flow/planning/types';
import {
  getFlowTransactionMetadataBySettlementMonth,
  getFlowTransactionMetadataMany,
} from '#flow/transaction-metadata/storage';
import type {
  FlowSplitMethod,
  FlowSplitParticipant,
  FlowTransactionMetadataData,
  FlowTransactionMetadataRecord,
} from '#flow/transaction-metadata/types';

import type {
  FlowSettlementCalculation,
  FlowSettlementItem,
  FlowSettlementSummary,
} from './types';

const METADATA_BATCH_SIZE = 250;

type CalculationWarningInput = {
  transaction: FlowTransaction;
  reason: string;
};

export async function calculateFlowSettlement(
  month: string,
): Promise<FlowSettlementCalculation> {
  const [settings, dateMonthTransactions, assignedMonthMetadataRecords] =
    await Promise.all([
      getFlowSettings(),
      getFlowTransactions({
        start: monthUtils.firstDayOfMonth(month),
        end: monthUtils.lastDayOfMonth(month),
      }),
      getFlowTransactionMetadataBySettlementMonth(month),
    ]);
  const assignedMonthTransactions = await getFlowTransactionsByIds(
    assignedMonthMetadataRecords.map(record => record.actualTransactionId),
  );
  const transactions = dedupeTransactions([
    ...dateMonthTransactions,
    ...assignedMonthTransactions,
  ]);
  const metadataRecords = dedupeMetadataRecords([
    ...(await getMetadataRecords(
      transactions.map(transaction => transaction.id),
    )),
    ...assignedMonthMetadataRecords,
  ]);

  return calculateFlowSettlementFromData({
    month,
    settings,
    transactions,
    metadataRecords,
  });
}

type CalculateFlowSettlementFromDataInput = {
  month: string;
  settings: FlowSettings;
  transactions: FlowTransaction[];
  metadataRecords: FlowTransactionMetadataRecord[];
};

export function calculateFlowSettlementFromData({
  month,
  settings,
  transactions,
  metadataRecords,
}: CalculateFlowSettlementFromDataInput): FlowSettlementCalculation {
  const warnings: string[] = [];
  const activeMembers = settings.householdMembers.filter(
    member => member.active,
  );
  const metadataByTransactionId = new Map(
    metadataRecords.map(record => [record.actualTransactionId, record]),
  );

  if (activeMembers.length === 0) {
    warnings.push(
      'No active household members are configured. Configure Flow Settings before calculating settlement.',
    );
  }

  const items =
    activeMembers.length === 0
      ? []
      : transactions.flatMap(transaction =>
          calculateItemsForTransaction({
            month,
            transaction,
            metadata: metadataByTransactionId.get(transaction.id)?.data,
            activeMembers,
            warnings,
          }),
        );

  if (
    activeMembers.length > 0 &&
    transactions.length > 0 &&
    items.length === 0
  ) {
    warnings.push(
      'No open shared expense transactions were found for this month. Check that transactions are marked Shared, have a paid-by member, use a supported split method, and have settlement status Open.',
    );
  }

  return {
    month,
    generatedAt: new Date().toISOString(),
    members: activeMembers.map(member => ({
      id: member.id,
      name: member.name,
    })),
    items,
    summaries: calculateGlobalNetSummaries(month, items),
    warnings,
  };
}

type CalculateItemsInput = {
  month: string;
  transaction: FlowTransaction;
  metadata: FlowTransactionMetadataData | undefined;
  activeMembers: FlowHouseholdMember[];
  warnings: string[];
};

function calculateItemsForTransaction({
  month,
  transaction,
  metadata,
  activeMembers,
  warnings,
}: CalculateItemsInput): FlowSettlementItem[] {
  if (!metadata || metadata.sharedStatus !== 'shared') {
    return [];
  }

  const effectiveSettlementMonth =
    metadata.settlementMonth ?? monthUtils.monthFromDate(transaction.date);

  if (effectiveSettlementMonth !== month) {
    return [];
  }

  if (
    ['ignored', 'settled', 'reimbursed'].includes(metadata.settlementStatus)
  ) {
    return [];
  }

  if (transaction.amount > 0) {
    addWarning(
      {
        transaction,
        reason:
          'Shared transaction is an inflow. Income is excluded from TASK008 settlement.',
      },
      warnings,
    );
    return [];
  }

  if (transaction.amount === 0) {
    addWarning(
      {
        transaction,
        reason: 'Shared transaction has a zero amount.',
      },
      warnings,
    );
    return [];
  }

  if (!metadata.paidByMemberId) {
    addWarning(
      {
        transaction,
        reason: 'Shared transaction is missing a paid-by member.',
      },
      warnings,
    );
    return [];
  }

  const payer = activeMembers.find(
    member => member.id === metadata.paidByMemberId,
  );

  if (!payer) {
    addWarning(
      {
        transaction,
        reason:
          'Shared transaction paid-by member is not an active household member.',
      },
      warnings,
    );
    return [];
  }

  switch (metadata.splitMethod) {
    case 'equal':
      return calculateEqualSplitItems({
        month,
        transaction,
        metadata,
        payer,
        activeMembers,
        warnings,
      });

    case 'none':
      return [];

    case 'custom':
    case 'fixed-amount':
    case 'percentage':
      return calculateSplitDataItems({
        month,
        transaction,
        metadata,
        payer,
        activeMembers,
        warnings,
      });

    default:
      addWarning(
        {
          transaction,
          reason: 'Shared transaction uses an unsupported split method.',
        },
        warnings,
      );
      return [];
  }
}

type CalculateEqualSplitInput = {
  month: string;
  transaction: FlowTransaction;
  metadata: FlowTransactionMetadataData;
  payer: FlowHouseholdMember;
  activeMembers: FlowHouseholdMember[];
  warnings: string[];
};

function calculateEqualSplitItems({
  month,
  transaction,
  metadata,
  payer,
  activeMembers,
  warnings,
}: CalculateEqualSplitInput): FlowSettlementItem[] {
  const participants = getEqualSplitParticipants(
    metadata.splitData?.participants,
    activeMembers,
    transaction,
    warnings,
  );

  if (participants.length < 2) {
    addWarning(
      {
        transaction,
        reason: 'Equal split needs at least two active participants.',
      },
      warnings,
    );
    return [];
  }

  const sourceAmount = Math.abs(transaction.amount);
  const shares = divideIntegerAmount(sourceAmount, participants.length);

  return createItemsFromShares({
    month,
    transaction,
    metadata,
    payer,
    shares: participants.map((participant, index) => ({
      member: participant,
      amount: shares[index] ?? 0,
    })),
  });
}

function getEqualSplitParticipants(
  splitParticipants: FlowSplitParticipant[] | undefined,
  activeMembers: FlowHouseholdMember[],
  transaction: FlowTransaction,
  warnings: string[],
): FlowHouseholdMember[] {
  if (!splitParticipants || splitParticipants.length === 0) {
    return activeMembers;
  }

  const activeMembersById = new Map(
    activeMembers.map(member => [member.id, member]),
  );
  const seenMemberIds = new Set<string>();
  const participants: FlowHouseholdMember[] = [];

  for (const splitParticipant of splitParticipants) {
    if (seenMemberIds.has(splitParticipant.memberId)) {
      continue;
    }

    seenMemberIds.add(splitParticipant.memberId);
    const member = activeMembersById.get(splitParticipant.memberId);

    if (member) {
      participants.push(member);
    } else {
      addWarning(
        {
          transaction,
          reason:
            'Split data references a member that is not active or no longer exists.',
        },
        warnings,
      );
    }
  }

  return participants;
}

type CalculateSplitDataInput = {
  month: string;
  transaction: FlowTransaction;
  metadata: FlowTransactionMetadataData;
  payer: FlowHouseholdMember;
  activeMembers: FlowHouseholdMember[];
  warnings: string[];
};

function calculateSplitDataItems({
  month,
  transaction,
  metadata,
  payer,
  activeMembers,
  warnings,
}: CalculateSplitDataInput): FlowSettlementItem[] {
  const participants = getExplicitSplitParticipants(
    metadata.splitData?.participants,
    activeMembers,
    transaction,
    warnings,
  );

  if (participants.length === 0) {
    addWarning(
      {
        transaction,
        reason: `${getSplitMethodName(metadata.splitMethod)} split needs at least one active participant with split data.`,
      },
      warnings,
    );
    return [];
  }

  const sourceAmount = Math.abs(transaction.amount);
  const shareAmounts = calculateShareAmounts({
    splitMethod: metadata.splitMethod,
    sourceAmount,
    participants,
    transaction,
    warnings,
  });

  if (!shareAmounts) {
    return [];
  }

  return createItemsFromShares({
    month,
    transaction,
    metadata,
    payer,
    shares: participants.map(participant => ({
      member: participant.member,
      amount: shareAmounts.get(participant.member.id) ?? 0,
    })),
  });
}

type ExplicitParticipant = {
  member: FlowHouseholdMember;
  percentage?: number;
  fixedAmount?: number;
};

function getExplicitSplitParticipants(
  splitParticipants: FlowSplitParticipant[] | undefined,
  activeMembers: FlowHouseholdMember[],
  transaction: FlowTransaction,
  warnings: string[],
): ExplicitParticipant[] {
  if (!splitParticipants || splitParticipants.length === 0) {
    return [];
  }

  const activeMembersById = new Map(
    activeMembers.map(member => [member.id, member]),
  );
  const seenMemberIds = new Set<string>();
  const participants: ExplicitParticipant[] = [];

  for (const splitParticipant of splitParticipants) {
    if (seenMemberIds.has(splitParticipant.memberId)) {
      continue;
    }

    seenMemberIds.add(splitParticipant.memberId);
    const member = activeMembersById.get(splitParticipant.memberId);

    if (member) {
      participants.push({
        member,
        percentage: splitParticipant.percentage,
        fixedAmount: splitParticipant.fixedAmount,
      });
    } else {
      addWarning(
        {
          transaction,
          reason:
            'Split data references a member that is not active or no longer exists.',
        },
        warnings,
      );
    }
  }

  return participants;
}

type CalculateShareAmountsInput = {
  splitMethod: FlowSplitMethod;
  sourceAmount: number;
  participants: ExplicitParticipant[];
  transaction: FlowTransaction;
  warnings: string[];
};

function calculateShareAmounts({
  splitMethod,
  sourceAmount,
  participants,
  transaction,
  warnings,
}: CalculateShareAmountsInput): Map<string, number> | null {
  switch (splitMethod) {
    case 'percentage':
      return calculatePercentageShareAmounts({
        sourceAmount,
        participants,
        transaction,
        warnings,
      });

    case 'fixed-amount':
      return calculateFixedShareAmounts({
        sourceAmount,
        participants,
        transaction,
        warnings,
      });

    case 'custom':
      return calculateCustomShareAmounts({
        sourceAmount,
        participants,
        transaction,
        warnings,
      });

    default:
      return null;
  }
}

function calculatePercentageShareAmounts({
  sourceAmount,
  participants,
  transaction,
  warnings,
}: Omit<CalculateShareAmountsInput, 'splitMethod'>): Map<
  string,
  number
> | null {
  const weightedParticipants = participants
    .map(participant => ({
      memberId: participant.member.id,
      weight: percentageToBasisPoints(participant.percentage),
    }))
    .filter(participant => participant.weight > 0);

  const totalWeight = weightedParticipants.reduce(
    (sum, participant) => sum + participant.weight,
    0,
  );

  if (totalWeight !== 10_000) {
    addWarning(
      {
        transaction,
        reason:
          'Percentage split must have participant percentages that total 100%.',
      },
      warnings,
    );
    return null;
  }

  return allocateWeightedAmount(sourceAmount, weightedParticipants);
}

function calculateFixedShareAmounts({
  sourceAmount,
  participants,
  transaction,
  warnings,
}: Omit<CalculateShareAmountsInput, 'splitMethod'>): Map<
  string,
  number
> | null {
  const amounts = new Map<string, number>();
  let fixedTotal = 0;

  for (const participant of participants) {
    const amount = participant.fixedAmount ?? 0;

    if (amount < 0) {
      addWarning(
        {
          transaction,
          reason: 'Fixed split contains a negative participant amount.',
        },
        warnings,
      );
      return null;
    }

    fixedTotal += amount;
    amounts.set(participant.member.id, amount);
  }

  if (fixedTotal === 0) {
    addWarning(
      {
        transaction,
        reason: 'Fixed split needs at least one participant amount.',
      },
      warnings,
    );
    return null;
  }

  if (fixedTotal > sourceAmount) {
    addWarning(
      {
        transaction,
        reason:
          'Fixed split participant amounts are greater than the transaction amount.',
      },
      warnings,
    );
    return null;
  }

  return amounts;
}

function calculateCustomShareAmounts({
  sourceAmount,
  participants,
  transaction,
  warnings,
}: Omit<CalculateShareAmountsInput, 'splitMethod'>): Map<
  string,
  number
> | null {
  const amounts = new Map<string, number>();
  const fixedParticipants = participants.filter(
    participant => (participant.fixedAmount ?? 0) > 0,
  );
  const percentageParticipants = participants
    .map(participant => ({
      memberId: participant.member.id,
      weight: percentageToBasisPoints(participant.percentage),
    }))
    .filter(participant => participant.weight > 0);
  const fixedTotal = fixedParticipants.reduce(
    (sum, participant) => sum + (participant.fixedAmount ?? 0),
    0,
  );

  if (fixedTotal > sourceAmount) {
    addWarning(
      {
        transaction,
        reason:
          'Custom split fixed participant amounts are greater than the transaction amount.',
      },
      warnings,
    );
    return null;
  }

  for (const participant of fixedParticipants) {
    amounts.set(participant.member.id, participant.fixedAmount ?? 0);
  }

  if (percentageParticipants.length > 0) {
    const totalWeight = percentageParticipants.reduce(
      (sum, participant) => sum + participant.weight,
      0,
    );

    if (totalWeight !== 10_000) {
      addWarning(
        {
          transaction,
          reason:
            'Custom split percentages must total 100% when percentage values are used.',
        },
        warnings,
      );
      return null;
    }

    const remainingAmount = sourceAmount - fixedTotal;
    const percentageAmounts = allocateWeightedAmount(
      remainingAmount,
      percentageParticipants,
    );

    for (const [memberId, amount] of percentageAmounts) {
      amounts.set(memberId, (amounts.get(memberId) ?? 0) + amount);
    }
  }

  if (amounts.size === 0) {
    addWarning(
      {
        transaction,
        reason:
          'Custom split needs fixed amounts, percentages, or both in split data.',
      },
      warnings,
    );
    return null;
  }

  return amounts;
}

function createItemsFromShares({
  month,
  transaction,
  metadata,
  payer,
  shares,
}: {
  month: string;
  transaction: FlowTransaction;
  metadata: FlowTransactionMetadataData;
  payer: FlowHouseholdMember;
  shares: Array<{ member: FlowHouseholdMember; amount: number }>;
}): FlowSettlementItem[] {
  const sourceAmount = Math.abs(transaction.amount);

  return shares.flatMap((share, index) => {
    if (share.member.id === payer.id || share.amount <= 0) {
      return [];
    }

    return [
      {
        id: createSettlementItemId(
          month,
          transaction.id,
          share.member.id,
          payer.id,
          index,
        ),
        actualTransactionId: transaction.id,
        owedByMemberId: share.member.id,
        owedToMemberId: payer.id,
        amount: share.amount,
        sourceAmount,
        splitMethod: metadata.splitMethod,
        notes: metadata.flowNotes,
        transactionDate: transaction.date,
        payeeName: transaction.payeeName,
        categoryName: transaction.categoryName,
        paidByMemberId: payer.id,
        settlementStatus: metadata.settlementStatus,
      },
    ];
  });
}

function calculateGlobalNetSummaries(
  month: string,
  items: FlowSettlementItem[],
): FlowSettlementSummary[] {
  const netByMemberId = new Map<string, number>();
  const itemCountByMemberId = new Map<string, number>();

  for (const item of items) {
    netByMemberId.set(
      item.owedByMemberId,
      (netByMemberId.get(item.owedByMemberId) ?? 0) - item.amount,
    );
    netByMemberId.set(
      item.owedToMemberId,
      (netByMemberId.get(item.owedToMemberId) ?? 0) + item.amount,
    );
    itemCountByMemberId.set(
      item.owedByMemberId,
      (itemCountByMemberId.get(item.owedByMemberId) ?? 0) + 1,
    );
    itemCountByMemberId.set(
      item.owedToMemberId,
      (itemCountByMemberId.get(item.owedToMemberId) ?? 0) + 1,
    );
  }

  const debtors = [...netByMemberId]
    .filter(([, amount]) => amount < 0)
    .map(([memberId, amount]) => ({ memberId, amount: Math.abs(amount) }))
    .sort(
      (left, right) =>
        right.amount - left.amount ||
        left.memberId.localeCompare(right.memberId),
    );
  const creditors = [...netByMemberId]
    .filter(([, amount]) => amount > 0)
    .map(([memberId, amount]) => ({ memberId, amount }))
    .sort(
      (left, right) =>
        right.amount - left.amount ||
        left.memberId.localeCompare(right.memberId),
    );
  const summaries: FlowSettlementSummary[] = [];

  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.amount, creditor.amount);

    if (amount > 0) {
      summaries.push({
        month,
        fromMemberId: debtor.memberId,
        toMemberId: creditor.memberId,
        amount,
        itemCount:
          (itemCountByMemberId.get(debtor.memberId) ?? 0) +
          (itemCountByMemberId.get(creditor.memberId) ?? 0),
        status: 'open',
      });
    }

    debtor.amount -= amount;
    creditor.amount -= amount;

    if (debtor.amount === 0) {
      debtorIndex += 1;
    }

    if (creditor.amount === 0) {
      creditorIndex += 1;
    }
  }

  return summaries.sort(
    (left, right) =>
      left.fromMemberId.localeCompare(right.fromMemberId) ||
      left.toMemberId.localeCompare(right.toMemberId),
  );
}

async function getMetadataRecords(
  transactionIds: string[],
): Promise<FlowTransactionMetadataRecord[]> {
  const uniqueIds = [...new Set(transactionIds.filter(Boolean))];
  const records: FlowTransactionMetadataRecord[] = [];

  for (let index = 0; index < uniqueIds.length; index += METADATA_BATCH_SIZE) {
    records.push(
      ...(await getFlowTransactionMetadataMany(
        uniqueIds.slice(index, index + METADATA_BATCH_SIZE),
      )),
    );
  }

  return records;
}

function dedupeTransactions(
  transactions: FlowTransaction[],
): FlowTransaction[] {
  const transactionsById = new Map<string, FlowTransaction>();

  for (const transaction of transactions) {
    transactionsById.set(transaction.id, transaction);
  }

  return [...transactionsById.values()];
}

function dedupeMetadataRecords(
  records: FlowTransactionMetadataRecord[],
): FlowTransactionMetadataRecord[] {
  const recordsByTransactionId = new Map<
    string,
    FlowTransactionMetadataRecord
  >();

  for (const record of records) {
    recordsByTransactionId.set(record.actualTransactionId, record);
  }

  return [...recordsByTransactionId.values()];
}

function divideIntegerAmount(amount: number, divisor: number): number[] {
  const baseShare = Math.floor(amount / divisor);
  const remainder = amount % divisor;

  return Array.from({ length: divisor }, (_, index) =>
    index < remainder ? baseShare + 1 : baseShare,
  );
}

function percentageToBasisPoints(percentage: number | undefined): number {
  if (percentage == null || percentage <= 0) {
    return 0;
  }

  const normalizedPercentage = percentage <= 1 ? percentage * 100 : percentage;
  return Math.round(normalizedPercentage * 100);
}

function allocateWeightedAmount(
  amount: number,
  weightedParticipants: Array<{ memberId: string; weight: number }>,
): Map<string, number> {
  const totalWeight = weightedParticipants.reduce(
    (sum, participant) => sum + participant.weight,
    0,
  );
  const allocations = weightedParticipants.map(participant => {
    const weightedAmount = amount * participant.weight;
    const baseAmount = Math.floor(weightedAmount / totalWeight);

    return {
      memberId: participant.memberId,
      amount: baseAmount,
      remainder: weightedAmount - baseAmount * totalWeight,
    };
  });
  let remainder =
    amount -
    allocations.reduce((sum, allocation) => sum + allocation.amount, 0);

  [...allocations]
    .sort(
      (left, right) =>
        right.remainder - left.remainder ||
        left.memberId.localeCompare(right.memberId),
    )
    .forEach(allocation => {
      if (remainder <= 0) {
        return;
      }

      allocation.amount += 1;
      remainder -= 1;
    });

  return new Map(
    allocations.map(allocation => [allocation.memberId, allocation.amount]),
  );
}

function getSplitMethodName(splitMethod: FlowSplitMethod) {
  switch (splitMethod) {
    case 'percentage':
      return 'Percentage';
    case 'fixed-amount':
      return 'Fixed amount';
    case 'custom':
      return 'Custom';
    case 'equal':
      return 'Equal';
    case 'none':
      return 'None';
    default:
      return splitMethod;
  }
}

function addWarning(
  { transaction, reason }: CalculationWarningInput,
  warnings: string[],
) {
  const label =
    transaction.payeeName ||
    transaction.notes ||
    transaction.id ||
    'Unknown transaction';
  warnings.push(`${transaction.date} ${label}: ${reason}`);
}

function createSettlementItemId(
  month: string,
  transactionId: string,
  owedByMemberId: string,
  owedToMemberId: string,
  index: number,
) {
  return `flow-settlement-item:${month}:${transactionId}:${owedByMemberId}:${owedToMemberId}:${index}`;
}
