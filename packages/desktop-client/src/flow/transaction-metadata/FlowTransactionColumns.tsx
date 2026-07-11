import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { baseInputStyle } from '@actual-app/components/input';
import { Popover } from '@actual-app/components/popover';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { Cell, CellButton, Field, InputCell } from '#components/table';
import type { FlowSettings } from '#flow/planning/types';

import { FlowTransactionMetadataEditor } from './FlowTransactionMetadataEditor';
import {
  createDefaultFlowTransactionMetadataDataFromSettings,
  saveFlowTransactionMetadata,
} from './storage';
import type {
  FlowSettlementStatus,
  FlowSharedStatus,
  FlowSplitMethod,
  FlowTransactionMetadataData,
  FlowTransactionMetadataRecord,
} from './types';

const FLOW_PAID_BY_WIDTH = 86;
const FLOW_SHARED_WIDTH = 68;
const FLOW_SPLIT_WIDTH = 84;
const FLOW_SETTLEMENT_WIDTH = 90;
const FLOW_CASHFLOW_WIDTH = 82;
const FLOW_NOTES_WIDTH = 120;
const FLOW_EDIT_WIDTH = 72;

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

type FlowTransactionHeaderCellsProps = {
  isLoading?: boolean;
};

export function createDefaultFlowTransactionRecord(
  actualTransactionId: string,
  settings: FlowSettings | null,
  isTransfer = false,
): FlowTransactionMetadataRecord {
  if (isTransfer) {
    return createTransferDefaultFlowTransactionRecord(actualTransactionId);
  }

  return {
    actualTransactionId,
    data: settings
      ? createDefaultFlowTransactionMetadataDataFromSettings(settings)
      : {
          version: 1,
          sharedStatus: 'personal',
          splitMethod: 'none',
          settlementStatus: 'not-needed',
          cashflowIncluded: true,
        },
    exists: false,
  };
}

function createTransferDefaultFlowTransactionRecord(
  actualTransactionId: string,
): FlowTransactionMetadataRecord {
  return {
    actualTransactionId,
    data: {
      version: 1,
      sharedStatus: 'personal',
      splitMethod: 'none',
      settlementStatus: 'not-needed',
      cashflowIncluded: false,
    },
    exists: false,
  };
}

export function FlowTransactionHeaderCells({
  isLoading,
}: FlowTransactionHeaderCellsProps) {
  return (
    <>
      <FlowHeaderCell width={FLOW_PAID_BY_WIDTH}>
        <Trans>Paid by</Trans>
      </FlowHeaderCell>
      <FlowHeaderCell width={FLOW_SHARED_WIDTH}>
        <Trans>Shared?</Trans>
      </FlowHeaderCell>
      <FlowHeaderCell width={FLOW_SPLIT_WIDTH}>
        <Trans>Split</Trans>
      </FlowHeaderCell>
      <FlowHeaderCell width={FLOW_SETTLEMENT_WIDTH}>
        <Trans>Settlement</Trans>
      </FlowHeaderCell>
      <FlowHeaderCell width={FLOW_CASHFLOW_WIDTH}>
        <Trans>Cashflow</Trans>
      </FlowHeaderCell>
      <FlowHeaderCell width={FLOW_NOTES_WIDTH}>
        <Trans>Flow notes</Trans>
      </FlowHeaderCell>
      <FlowHeaderCell width={FLOW_EDIT_WIDTH}>
        {isLoading ? <Trans>Loading</Trans> : <Trans>Flow</Trans>}
      </FlowHeaderCell>
    </>
  );
}

type FlowTransactionCellsProps = {
  record: FlowTransactionMetadataRecord | undefined;
  settings: FlowSettings | null;
  onRecordChange: (record: FlowTransactionMetadataRecord) => void;
  focusedField?: string;
  onEdit?: (field: string) => void;
  onUpdateData?: (
    record: FlowTransactionMetadataRecord,
    data: FlowTransactionMetadataData,
  ) => Promise<FlowTransactionMetadataRecord> | FlowTransactionMetadataRecord;
  isTransfer?: boolean;
};

export function FlowTransactionCells({
  record,
  settings,
  onRecordChange,
  focusedField,
  onEdit,
  onUpdateData,
  isTransfer = false,
}: FlowTransactionCellsProps) {
  const { t } = useTranslation();
  const [isEditorOpen, setEditorOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  if (!record) {
    return <FlowTransactionPlaceholderCells label={t('Loading')} />;
  }

  const activeRecord =
    isTransfer && !record.exists
      ? createTransferDefaultFlowTransactionRecord(record.actualTransactionId)
      : record;
  const isDefault = !activeRecord.exists;
  const data = activeRecord.data;
  const notesPreview = data.flowNotes ?? '';

  async function saveData(nextData: FlowTransactionMetadataData) {
    setSaveError(null);

    try {
      const savedRecord = onUpdateData
        ? await onUpdateData(activeRecord, nextData)
        : await saveFlowTransactionMetadata(
            activeRecord.actualTransactionId,
            nextData,
          );
      onRecordChange(savedRecord);
    } catch {
      setSaveError(t('Flow metadata could not be saved.'));
    }
  }

  function updateData<K extends keyof FlowTransactionMetadataData>(
    key: K,
    value: FlowTransactionMetadataData[K],
  ) {
    void saveData({ ...data, [key]: value });
  }

  return (
    <>
      <FlowSelectCell
        name="flow-paid-by"
        width={FLOW_PAID_BY_WIDTH}
        value={withDefaultPrefix(
          getMemberName(data.paidByMemberId, settings, t),
          isDefault,
          t,
        )}
        rawValue={data.paidByMemberId ?? ''}
        options={[
          ['', t('No member')],
          ...(settings?.householdMembers ?? []).map(
            member => [member.id, member.name] as [string, string],
          ),
        ]}
        isDefault={isDefault}
        focused={focusedField === 'flow-paid-by'}
        onExpose={() => onEdit?.('flow-paid-by')}
        onChange={value => updateData('paidByMemberId', value || undefined)}
      />
      <FlowSelectCell
        name="flow-shared"
        width={FLOW_SHARED_WIDTH}
        value={getSharedStatusLabel(data.sharedStatus, t)}
        rawValue={data.sharedStatus}
        options={sharedStatusOptions.map(status => [
          status,
          getSharedStatusLabel(status, t),
        ])}
        isDefault={isDefault}
        focused={focusedField === 'flow-shared'}
        onExpose={() => onEdit?.('flow-shared')}
        onChange={value =>
          updateData('sharedStatus', value as FlowSharedStatus)
        }
      />
      <FlowSelectCell
        name="flow-split"
        width={FLOW_SPLIT_WIDTH}
        value={getSplitMethodLabel(data.splitMethod, t)}
        rawValue={data.splitMethod}
        options={splitMethodOptions.map(method => [
          method,
          getSplitMethodLabel(method, t),
        ])}
        isDefault={isDefault}
        focused={focusedField === 'flow-split'}
        onExpose={() => onEdit?.('flow-split')}
        onChange={value => updateData('splitMethod', value as FlowSplitMethod)}
      />
      <FlowSelectCell
        name="flow-settlement"
        width={FLOW_SETTLEMENT_WIDTH}
        value={getSettlementStatusLabel(data.settlementStatus, t)}
        rawValue={data.settlementStatus}
        options={settlementStatusOptions.map(status => [
          status,
          getSettlementStatusLabel(status, t),
        ])}
        isDefault={isDefault}
        focused={focusedField === 'flow-settlement'}
        onExpose={() => onEdit?.('flow-settlement')}
        onChange={value =>
          updateData('settlementStatus', value as FlowSettlementStatus)
        }
      />
      <FlowSelectCell
        name="flow-cashflow"
        width={FLOW_CASHFLOW_WIDTH}
        value={data.cashflowIncluded ? t('Included') : t('Excluded')}
        rawValue={data.cashflowIncluded ? 'included' : 'excluded'}
        options={[
          ['included', t('Included')],
          ['excluded', t('Excluded')],
        ]}
        isDefault={isDefault}
        focused={focusedField === 'flow-cashflow'}
        onExpose={() => onEdit?.('flow-cashflow')}
        onChange={value => updateData('cashflowIncluded', value === 'included')}
      />
      <InputCell
        name="flow-notes"
        width={FLOW_NOTES_WIDTH}
        value={notesPreview}
        exposed={focusedField === 'flow-notes'}
        focused={focusedField === 'flow-notes'}
        onExpose={() => onEdit?.('flow-notes')}
        onUpdate={value => updateData('flowNotes', value || undefined)}
        valueStyle={{
          color: isDefault ? theme.pageTextSubdued : 'inherit',
          fontStyle: isDefault ? 'italic' : 'normal',
          fontSize: 12,
        }}
        inputProps={{
          value: notesPreview,
          style: { fontSize: 12 },
        }}
      />
      <Cell
        name="flow-edit"
        width={FLOW_EDIT_WIDTH}
        plain
        style={{ alignItems: 'stretch' }}
      >
        <CellButton
          ref={triggerRef}
          bare
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: '0 5px',
            color: theme.pageTextLink,
          }}
          onSelect={() => setEditorOpen(true)}
        >
          <Text style={{ fontSize: 12 }}>
            <Trans>Edit Flow</Trans>
          </Text>
        </CellButton>
        {saveError && (
          <Text style={{ color: theme.errorText, fontSize: 10 }}>
            {saveError}
          </Text>
        )}
        <Popover
          triggerRef={triggerRef}
          placement="bottom end"
          isOpen={isEditorOpen}
          onOpenChange={setEditorOpen}
          style={{ padding: 14 }}
          isNonModal={false}
          shouldCloseOnInteractOutside={element =>
            !element.closest('[data-popover]')
          }
        >
          <FlowTransactionMetadataEditor
            record={activeRecord}
            settings={settings}
            onRecordChange={onRecordChange}
            onClose={() => setEditorOpen(false)}
          />
        </Popover>
      </Cell>
    </>
  );
}

type FlowTransactionPlaceholderCellsProps = {
  label?: string;
};

export function FlowTransactionPlaceholderCells({
  label = '',
}: FlowTransactionPlaceholderCellsProps) {
  return (
    <>
      <FlowDataCell
        name="flow-paid-by"
        width={FLOW_PAID_BY_WIDTH}
        value={label}
      />
      <FlowDataCell name="flow-shared" width={FLOW_SHARED_WIDTH} value="" />
      <FlowDataCell name="flow-split" width={FLOW_SPLIT_WIDTH} value="" />
      <FlowDataCell
        name="flow-settlement"
        width={FLOW_SETTLEMENT_WIDTH}
        value=""
      />
      <FlowDataCell name="flow-cashflow" width={FLOW_CASHFLOW_WIDTH} value="" />
      <FlowDataCell name="flow-notes" width={FLOW_NOTES_WIDTH} value="" />
      <Cell name="flow-edit" width={FLOW_EDIT_WIDTH} plain />
    </>
  );
}

type FlowHeaderCellProps = {
  width: number;
  children: ReactNode;
};

function FlowHeaderCell({ width, children }: FlowHeaderCellProps) {
  return (
    <Field
      width={width}
      contentStyle={{
        alignItems: 'flex-start',
      }}
    >
      {children}
    </Field>
  );
}

type FlowDataCellProps = {
  name: string;
  width: number;
  value: string;
  isDefault?: boolean;
};

function FlowDataCell({ name, width, value, isDefault }: FlowDataCellProps) {
  return (
    <Cell
      name={name}
      width={width}
      plain
      style={{
        minWidth: width,
      }}
      title={value}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: '0 5px',
          overflow: 'hidden',
        }}
      >
        <Text
          style={{
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            color: isDefault ? theme.pageTextSubdued : 'inherit',
            fontStyle: isDefault ? 'italic' : 'normal',
            fontSize: 12,
          }}
        >
          {value}
        </Text>
      </View>
    </Cell>
  );
}

type FlowSelectCellProps = FlowDataCellProps & {
  rawValue: string;
  options: Array<[string, string]>;
  focused?: boolean;
  onExpose: () => void;
  onChange: (value: string) => void;
};

function FlowSelectCell({
  name,
  width,
  value,
  rawValue,
  options,
  isDefault,
  focused,
  onExpose,
  onChange,
}: FlowSelectCellProps) {
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (focused) {
      selectRef.current?.focus();
    }
  }, [focused]);

  return (
    <Cell
      name={name}
      width={width}
      value={value}
      exposed={focused}
      focused={focused}
      plain={false}
      onExpose={onExpose}
      valueStyle={{
        color: isDefault ? theme.pageTextSubdued : 'inherit',
        fontStyle: isDefault ? 'italic' : 'normal',
        fontSize: 12,
      }}
      style={{
        minWidth: width,
      }}
      title={value}
    >
      {() => (
        <select
          ref={selectRef}
          value={rawValue}
          onChange={event => onChange(event.currentTarget.value)}
          onKeyDown={event => {
            if (event.key.startsWith('Arrow')) {
              event.stopPropagation();
            }
          }}
          style={{
            ...baseInputStyle,
            width: '100%',
            height: 24,
            padding: '0 20px 0 6px',
            backgroundColor: theme.tableBackground,
            color: theme.formInputText,
            fontSize: 12,
            lineHeight: '22px',
          }}
        >
          {options.map(([optionValue, label]) => (
            <option key={optionValue} value={optionValue}>
              {label}
            </option>
          ))}
        </select>
      )}
    </Cell>
  );
}

type TranslationFn = ReturnType<typeof useTranslation>['t'];

function getMemberName(
  memberId: string | undefined,
  settings: FlowSettings | null,
  t: TranslationFn,
) {
  if (!memberId) {
    return t('No member');
  }

  return (
    settings?.householdMembers.find(member => member.id === memberId)?.name ??
    memberId
  );
}

function withDefaultPrefix(
  value: string,
  isDefault: boolean,
  t: TranslationFn,
) {
  return isDefault ? `${t('Default')}: ${value}` : value;
}

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
