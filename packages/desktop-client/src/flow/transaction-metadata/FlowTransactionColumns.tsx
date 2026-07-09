import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Popover } from '@actual-app/components/popover';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { Cell, CellButton, Field } from '#components/table';
import type { FlowSettings } from '#flow/planning/types';

import { FlowTransactionMetadataEditor } from './FlowTransactionMetadataEditor';
import type {
  FlowSettlementStatus,
  FlowSharedStatus,
  FlowSplitMethod,
  FlowTransactionMetadataRecord,
} from './types';

const FLOW_PAID_BY_WIDTH = 86;
const FLOW_SHARED_WIDTH = 68;
const FLOW_SPLIT_WIDTH = 84;
const FLOW_SETTLEMENT_WIDTH = 90;
const FLOW_CASHFLOW_WIDTH = 82;
const FLOW_NOTES_WIDTH = 120;
const FLOW_EDIT_WIDTH = 72;

type FlowTransactionHeaderCellsProps = {
  isLoading?: boolean;
};

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
};

export function FlowTransactionCells({
  record,
  settings,
  onRecordChange,
}: FlowTransactionCellsProps) {
  const { t } = useTranslation();
  const [isEditorOpen, setEditorOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);

  if (!record) {
    return <FlowTransactionPlaceholderCells label={t('Loading')} />;
  }

  const isDefault = !record.exists;
  const data = record.data;
  const notesPreview = data.flowNotes ?? '';

  return (
    <>
      <FlowDataCell
        name="flow-paid-by"
        width={FLOW_PAID_BY_WIDTH}
        value={withDefaultPrefix(
          getMemberName(data.paidByMemberId, settings, t),
          isDefault,
          t,
        )}
        isDefault={isDefault}
      />
      <FlowDataCell
        name="flow-shared"
        width={FLOW_SHARED_WIDTH}
        value={getSharedStatusLabel(data.sharedStatus, t)}
        isDefault={isDefault}
      />
      <FlowDataCell
        name="flow-split"
        width={FLOW_SPLIT_WIDTH}
        value={getSplitMethodLabel(data.splitMethod, t)}
        isDefault={isDefault}
      />
      <FlowDataCell
        name="flow-settlement"
        width={FLOW_SETTLEMENT_WIDTH}
        value={getSettlementStatusLabel(data.settlementStatus, t)}
        isDefault={isDefault}
      />
      <FlowDataCell
        name="flow-cashflow"
        width={FLOW_CASHFLOW_WIDTH}
        value={data.cashflowIncluded ? t('Included') : t('Excluded')}
        isDefault={isDefault}
      />
      <FlowDataCell
        name="flow-notes"
        width={FLOW_NOTES_WIDTH}
        value={notesPreview}
        isDefault={isDefault}
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
            record={record}
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
