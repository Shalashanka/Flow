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

import type { FlowSettings } from '#flow/planning/types';

import {
  deleteFlowTransactionMetadata,
  getFlowTransactionMetadata,
  saveFlowTransactionMetadata,
} from './storage';
import type {
  FlowSettlementStatus,
  FlowSharedStatus,
  FlowSplitMethod,
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
            onChange={value => updateDraft('splitMethod', value)}
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
          <input
            aria-label={t('Settlement month')}
            type="text"
            value={draft.settlementMonth ?? ''}
            onChange={event =>
              updateDraft('settlementMonth', event.target.value || undefined)
            }
            inputMode="numeric"
            maxLength={7}
            placeholder={t('YYYY-MM')}
            style={selectStyle}
          />
        </EditorField>
      </View>

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

function copyMetadataData(
  data: FlowTransactionMetadataData,
): FlowTransactionMetadataData {
  return { ...data };
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
  };
}

function cleanOptionalString(value: string | undefined): string | undefined {
  const trimmedValue = value?.trim();
  return trimmedValue ? trimmedValue : undefined;
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

const textareaStyle: CSSProperties = {
  ...baseInputStyle,
  width: '100%',
  minHeight: 70,
  resize: 'vertical',
};
