import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { baseInputStyle } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import type { SelectOption } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';
import * as monthUtils from '@actual-app/core/shared/months';
import {
  currencyToInteger,
  integerToCurrency,
} from '@actual-app/core/shared/util';

import { DateSelect } from '#components/select/DateSelect';
import type { FlowSettings } from '#flow/planning/types';
import { useDateFormat } from '#hooks/useDateFormat';

import {
  deleteFlowTransactionMetadata,
  getFlowTransactionMetadata,
  saveFlowTransactionMetadata,
} from './storage';
import type {
  FlowSettlementStatus,
  FlowSharedStatus,
  FlowSplitMethod,
  FlowSplitParticipant,
  FlowTransactionMetadataData,
  FlowTransactionMetadataRecord,
} from './types';

const sharedStatusOptions: FlowSharedStatus[] = [
  'personal',
  'shared',
  'ignored',
];

const splitMethodOptions: FlowSplitMethod[] = [
  'none',
  'equal',
  'percentage',
  'fixed-amount',
  'custom',
];

const settlementStatusOptions: FlowSettlementStatus[] = [
  'not-needed',
  'open',
  'settled',
  'reimbursed',
  'ignored',
];

type FlowTransactionMetadataEditorProps = {
  record: FlowTransactionMetadataRecord;
  settings: FlowSettings | null;
  onRecordChange: (record: FlowTransactionMetadataRecord) => void;
  onClose: () => void;
};

export function FlowTransactionMetadataEditor({
  record,
  settings,
  onRecordChange,
  onClose,
}: FlowTransactionMetadataEditorProps) {
  const { t } = useTranslation();
  const dateFormat = useDateFormat() || 'MM/dd/yyyy';
  const [draft, setDraft] = useState<FlowTransactionMetadataData>(() =>
    copyMetadataData(record.data),
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const householdMembers = settings?.householdMembers ?? [];
  const memberOptions: SelectOption<string>[] = [
    ['', t('No member')],
    ...householdMembers.map(
      member => [member.id, member.name] as [string, string],
    ),
  ];

  useEffect(() => {
    setDraft(copyMetadataData(record.data));
    setError(null);
  }, [record]);

  async function handleSave() {
    setIsSaving(true);
    setError(null);

    try {
      const savedRecord = await saveFlowTransactionMetadata(
        record.actualTransactionId,
        normalizeDraft(draft),
      );
      onRecordChange(savedRecord);
      onClose();
    } catch {
      setError(t('Flow metadata could not be saved. Try again.'));
    } finally {
      setIsSaving(false);
    }
  }

  async function handleClear() {
    setIsSaving(true);
    setError(null);

    try {
      await deleteFlowTransactionMetadata(record.actualTransactionId);
      const defaultRecord = await getFlowTransactionMetadata(
        record.actualTransactionId,
      );
      onRecordChange(defaultRecord);
      onClose();
    } catch {
      setError(t('Flow metadata could not be cleared. Try again.'));
    } finally {
      setIsSaving(false);
    }
  }

  function updateDraft<K extends keyof FlowTransactionMetadataData>(
    key: K,
    value: FlowTransactionMetadataData[K],
  ) {
    setDraft(current => ({ ...current, [key]: value }));
  }

  function updateSplitMethod(splitMethod: FlowSplitMethod) {
    setDraft(current => ({
      ...current,
      splitMethod,
      splitData: shouldUseSplitData(splitMethod)
        ? current.splitData ?? createDefaultSplitData(splitMethod, householdMembers)
        : current.splitData,
    }));
  }

  function updateSplitParticipants(participants: FlowSplitParticipant[]) {
    setDraft(current => ({
      ...current,
      splitData: participants.length > 0 ? { participants } : undefined,
    }));
  }

  return (
    <View style={{ gap: 12, width: 460 }}>
      <View style={{ gap: 3 }}>
        <Text style={{ fontWeight: 600 }}>
          <Trans>Edit Flow metadata</Trans>
        </Text>
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          {record.exists ? (
            <Trans>Saved Flow metadata overrides the settings defaults.</Trans>
          ) : (
            <Trans>
              This transaction is currently showing Flow Settings defaults.
            </Trans>
          )}
        </Text>
      </View>

      {householdMembers.length === 0 && (
        <Text style={{ color: theme.warningText }}>
          <Trans>
            No household members are configured yet. Member fields can stay
            blank.
          </Trans>
        </Text>
      )}

      <View
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
        }}
      >
        <EditorField label={t('Paid by')}>
          <Select
            options={memberOptions}
            value={draft.paidByMemberId ?? ''}
            onChange={value =>
              updateDraft('paidByMemberId', value || undefined)
            }
            style={selectStyle}
            popoverStyle={selectPopoverStyle}
          />
        </EditorField>

        <EditorField label={t('Entered by')}>
          <Select
            options={memberOptions}
            value={draft.enteredByMemberId ?? ''}
            onChange={value =>
              updateDraft('enteredByMemberId', value || undefined)
            }
            style={selectStyle}
            popoverStyle={selectPopoverStyle}
          />
        </EditorField>

        <EditorField label={t('Shared status')}>
          <Select
            options={sharedStatusOptions.map(status => [
              status,
              getSharedStatusLabel(status, t),
            ])}
            value={draft.sharedStatus}
            onChange={value => updateDraft('sharedStatus', value)}
            style={selectStyle}
            popoverStyle={selectPopoverStyle}
          />
        </EditorField>

        <EditorField label={t('Split method')}>
          <Select
            options={splitMethodOptions.map(method => [
              method,
              getSplitMethodLabel(method, t),
            ])}
            value={draft.splitMethod}
            onChange={updateSplitMethod}
            style={selectStyle}
            popoverStyle={selectPopoverStyle}
          />
        </EditorField>

        <EditorField label={t('Settlement status')}>
          <Select
            options={settlementStatusOptions.map(status => [
              status,
              getSettlementStatusLabel(status, t),
            ])}
            value={draft.settlementStatus}
            onChange={value => updateDraft('settlementStatus', value)}
            style={selectStyle}
            popoverStyle={selectPopoverStyle}
          />
        </EditorField>

        <EditorField label={t('Settlement month')}>
          <DateSelect
            value={
              draft.settlementMonth
                ? monthUtils.firstDayOfMonth(draft.settlementMonth)
                : ''
            }
            dateFormat={dateFormat}
            inputProps={{
              'aria-label': t('Settlement month'),
              style: selectStyle,
            }}
            clearOnBlur={false}
            onSelect={date =>
              updateDraft('settlementMonth', monthUtils.monthFromDate(date))
            }
          />
        </EditorField>
      </View>

      {draft.sharedStatus === 'shared' && shouldUseSplitData(draft.splitMethod) && (
        <SplitParticipantsEditor
          splitMethod={draft.splitMethod}
          members={householdMembers.filter(member => member.active)}
          participants={draft.splitData?.participants ?? []}
          onChange={updateSplitParticipants}
        />
      )}

      <label
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: theme.pageText,
        }}
      >
        <input
          aria-label={t('Cashflow included')}
          type="checkbox"
          checked={draft.cashflowIncluded}
          onChange={event =>
            updateDraft('cashflowIncluded', event.currentTarget.checked)
          }
        />
        <Text>
          <Trans>Cashflow included</Trans>
        </Text>
      </label>

      <EditorField label={t('Flow notes')}>
        <textarea
          aria-label={t('Flow notes')}
          value={draft.flowNotes ?? ''}
          onChange={event => updateDraft('flowNotes', event.target.value)}
          style={textareaStyle}
        />
      </EditorField>

      {error && <Text style={{ color: theme.errorText }}>{error}</Text>}

      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <Button
          variant="bare"
          onPress={handleClear}
          isDisabled={isSaving}
          style={{ color: theme.errorText }}
        >
          <Trans>Clear Flow metadata</Trans>
        </Button>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="normal" onPress={onClose} isDisabled={isSaving}>
            <Trans>Cancel</Trans>
          </Button>
          <Button variant="primary" onPress={handleSave} isDisabled={isSaving}>
            {isSaving ? t('Saving...') : t('Save')}
          </Button>
        </View>
      </View>
    </View>
  );
}

type EditorFieldProps = {
  label: string;
  children: ReactNode;
};

function EditorField({ label, children }: EditorFieldProps) {
  return (
    <View style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

type SplitParticipantsEditorProps = {
  splitMethod: FlowSplitMethod;
  members: FlowSettings['householdMembers'];
  participants: FlowSplitParticipant[];
  onChange: (participants: FlowSplitParticipant[]) => void;
};

function SplitParticipantsEditor({
  splitMethod,
  members,
  participants,
  onChange,
}: SplitParticipantsEditorProps) {
  const { t } = useTranslation();
  const participantByMemberId = new Map(
    participants.map(participant => [participant.memberId, participant]),
  );

  function updateParticipant(
    memberId: string,
    updater: (participant: FlowSplitParticipant) => FlowSplitParticipant,
  ) {
    const current = participantByMemberId.get(memberId) ?? { memberId };
    const nextParticipant = updater(current);
    const nextParticipants = members
      .map(member =>
        member.id === memberId
          ? nextParticipant
          : participantByMemberId.get(member.id),
      )
      .filter(isSplitParticipantIncluded);

    onChange(nextParticipants);
  }

  function toggleParticipant(memberId: string, checked: boolean) {
    if (checked) {
      updateParticipant(memberId, participant => participant);
      return;
    }

    onChange(participants.filter(participant => participant.memberId !== memberId));
  }

  return (
    <View
      style={{
        border: `1px solid ${theme.tableBorder}`,
        borderRadius: 6,
        padding: 10,
        gap: 8,
      }}
    >
      <View style={{ gap: 3 }}>
        <Text style={{ fontWeight: 600 }}>
          <Trans>Split participants</Trans>
        </Text>
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          {splitMethod === 'percentage' ? (
            <Trans>Included percentages must total 100%.</Trans>
          ) : splitMethod === 'fixed-amount' ? (
            <Trans>
              Fixed amounts are entered as currency values and cannot exceed the
              transaction amount.
            </Trans>
          ) : (
            <Trans>
              Custom splits can use fixed amounts, percentages, or both.
              Percentages apply to any amount left after fixed amounts.
            </Trans>
          )}
        </Text>
      </View>

      {members.length === 0 ? (
        <Text style={{ color: theme.warningText }}>
          <Trans>No active household members are available for split data.</Trans>
        </Text>
      ) : (
        <View style={{ gap: 6 }}>
          {members.map(member => {
            const participant = participantByMemberId.get(member.id);
            const isIncluded = participant !== undefined;

            return (
              <View
                key={member.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns:
                    splitMethod === 'custom'
                      ? 'minmax(130px, 1fr) 95px 120px'
                      : 'minmax(130px, 1fr) 120px',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: theme.pageText,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isIncluded}
                    onChange={event =>
                      toggleParticipant(member.id, event.currentTarget.checked)
                    }
                  />
                  <Text>{member.name}</Text>
                </label>

                {(splitMethod === 'percentage' || splitMethod === 'custom') && (
                  <input
                    aria-label={t('Percentage for {{name}}', {
                      name: member.name,
                    })}
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={participant?.percentage ?? ''}
                    disabled={!isIncluded}
                    placeholder={t('Percent')}
                    onChange={event =>
                      updateParticipant(member.id, current => ({
                        ...current,
                        percentage: parseOptionalNumber(
                          event.currentTarget.value,
                        ),
                      }))
                    }
                    style={splitInputStyle}
                  />
                )}

                {(splitMethod === 'fixed-amount' ||
                  splitMethod === 'custom') && (
                  <input
                    aria-label={t('Fixed amount for {{name}}', {
                      name: member.name,
                    })}
                    value={
                      participant?.fixedAmount != null
                        ? integerToCurrency(participant.fixedAmount)
                        : ''
                    }
                    disabled={!isIncluded}
                    placeholder={t('Amount')}
                    onChange={event =>
                      updateParticipant(member.id, current => ({
                        ...current,
                        fixedAmount: parseOptionalCurrency(
                          event.currentTarget.value,
                        ),
                      }))
                    }
                    style={splitInputStyle}
                  />
                )}
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

function copyMetadataData(
  data: FlowTransactionMetadataData,
): FlowTransactionMetadataData {
  return {
    ...data,
    splitData: data.splitData
      ? {
          participants: data.splitData.participants.map(participant => ({
            ...participant,
          })),
        }
      : undefined,
  };
}

function normalizeDraft(
  draft: FlowTransactionMetadataData,
): FlowTransactionMetadataData {
  return {
    ...draft,
    paidByMemberId: cleanOptionalString(draft.paidByMemberId),
    enteredByMemberId: cleanOptionalString(draft.enteredByMemberId),
    settlementMonth: cleanOptionalString(draft.settlementMonth),
    flowNotes: cleanOptionalString(draft.flowNotes),
    splitData: shouldUseSplitData(draft.splitMethod)
      ? cleanSplitData(draft.splitData?.participants ?? [])
      : undefined,
  };
}

function cleanOptionalString(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
}

function shouldUseSplitData(splitMethod: FlowSplitMethod) {
  return (
    splitMethod === 'percentage' ||
    splitMethod === 'fixed-amount' ||
    splitMethod === 'custom'
  );
}

function createDefaultSplitData(
  splitMethod: FlowSplitMethod,
  members: FlowSettings['householdMembers'],
): { participants: FlowSplitParticipant[] } | undefined {
  const activeMembers = members.filter(member => member.active);

  if (activeMembers.length === 0) {
    return undefined;
  }

  if (splitMethod === 'percentage') {
    const basisPoints = splitInteger(10_000, activeMembers.length);

    return {
      participants: activeMembers.map((member, index) => ({
        memberId: member.id,
        percentage: (basisPoints[index] ?? 0) / 100,
      })),
    };
  }

  return {
    participants: activeMembers.map(member => ({ memberId: member.id })),
  };
}

function cleanSplitData(
  participants: FlowSplitParticipant[],
): { participants: FlowSplitParticipant[] } | undefined {
  const cleanedParticipants = participants
    .map(participant => ({
      memberId: cleanOptionalString(participant.memberId),
      percentage: participant.percentage,
      fixedAmount: participant.fixedAmount,
    }))
    .filter(
      (
        participant,
      ): participant is {
        memberId: string;
        percentage: number | undefined;
        fixedAmount: number | undefined;
      } => participant.memberId !== undefined,
    )
    .map(participant => ({
      memberId: participant.memberId,
      percentage:
        participant.percentage != null && participant.percentage >= 0
          ? participant.percentage
          : undefined,
      fixedAmount:
        participant.fixedAmount != null && participant.fixedAmount >= 0
          ? participant.fixedAmount
          : undefined,
    }));

  return cleanedParticipants.length > 0
    ? { participants: cleanedParticipants }
    : undefined;
}

function isSplitParticipantIncluded(
  participant: FlowSplitParticipant | undefined,
): participant is FlowSplitParticipant {
  return participant !== undefined;
}

function parseOptionalNumber(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) && numberValue >= 0
    ? numberValue
    : undefined;
}

function parseOptionalCurrency(value: string): number | undefined {
  if (value.trim() === '') {
    return undefined;
  }

  const amount = currencyToInteger(value);
  return amount != null && amount >= 0 ? amount : undefined;
}

function splitInteger(amount: number, count: number): number[] {
  const baseAmount = Math.floor(amount / count);
  const remainder = amount % count;

  return Array.from({ length: count }, (_, index) =>
    index < remainder ? baseAmount + 1 : baseAmount,
  );
}

type TranslationFn = ReturnType<typeof useTranslation>['t'];

function getSharedStatusLabel(status: FlowSharedStatus, t: TranslationFn) {
  switch (status) {
    case 'personal':
      return t('Personal');
    case 'shared':
      return t('Shared');
    case 'ignored':
      return t('Ignored');
    default:
      return status;
  }
}

function getSplitMethodLabel(method: FlowSplitMethod, t: TranslationFn) {
  switch (method) {
    case 'none':
      return t('None');
    case 'equal':
      return t('Equal');
    case 'percentage':
      return t('Percentage');
    case 'fixed-amount':
      return t('Fixed amount');
    case 'custom':
      return t('Custom');
    default:
      return method;
  }
}

function getSettlementStatusLabel(
  status: FlowSettlementStatus,
  t: TranslationFn,
) {
  switch (status) {
    case 'not-needed':
      return t('Not needed');
    case 'open':
      return t('Open');
    case 'settled':
      return t('Settled');
    case 'reimbursed':
      return t('Reimbursed');
    case 'ignored':
      return t('Ignored');
    default:
      return status;
  }
}

const selectStyle: CSSProperties = {
  ...baseInputStyle,
  width: '100%',
  height: 30,
  justifyContent: 'center',
  padding: '0 8px',
};

const selectPopoverStyle: CSSProperties = {
  minWidth: 220,
};

const splitInputStyle: CSSProperties = {
  ...baseInputStyle,
  width: '100%',
  height: 30,
  padding: '0 8px',
};

const textareaStyle: CSSProperties = {
  ...baseInputStyle,
  width: '100%',
  minHeight: 70,
  resize: 'vertical',
};
