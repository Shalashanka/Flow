import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { SvgInformationCircle } from '@actual-app/components/icons/v2';
import { Input } from '@actual-app/components/input';
import { Select } from '@actual-app/components/select';
import type { SelectOption } from '@actual-app/components/select';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { Tooltip } from '@actual-app/components/tooltip';
import { View } from '@actual-app/components/view';

import { DateSelect } from '#components/select/DateSelect';
import { FinancialInput } from '#components/util/FinancialInput';

import {
  formGridStyle,
  fullWidthInputStyle,
  panelStyle,
  selectStyle,
  textareaStyle,
} from './styles';
import type {
  FlowSubscription,
  FlowSubscriptionRecurrence,
  FlowSubscriptionStatus,
} from './types';

export type SubscriptionDraft = {
  id?: string;
  name: string;
  payeeId: string;
  actualScheduleId: string;
  categoryId: string;
  accountId: string;
  amount: number;
  recurrence: FlowSubscriptionRecurrence;
  firstSeen: string;
  lastSeen: string;
  nextExpectedDate: string;
  status: FlowSubscriptionStatus;
  confidence: number;
  notes: string;
};

export function SubscriptionForm({
  draft,
  accountOptions,
  categoryOptions,
  payeeOptions,
  recurrenceOptions,
  statusOptions,
  dateFormat,
  onChange,
  onSave,
  onCancel,
}: {
  draft: SubscriptionDraft;
  accountOptions: Array<SelectOption<string>>;
  categoryOptions: Array<SelectOption<string>>;
  payeeOptions: Array<SelectOption<string>>;
  recurrenceOptions: Array<SelectOption<FlowSubscriptionRecurrence>>;
  statusOptions: Array<SelectOption<FlowSubscriptionStatus>>;
  dateFormat: string;
  onChange: (draft: SubscriptionDraft) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const help = getSubscriptionFieldHelp(t);
  const set = <Key extends keyof SubscriptionDraft>(
    key: Key,
    value: SubscriptionDraft[Key],
  ) => {
    onChange({ ...draft, [key]: value });
  };

  return (
    <View style={panelStyle}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <View style={{ gap: 4 }}>
          <Text style={{ fontSize: 17, fontWeight: 600 }}>
            {draft.id ? t('Edit subscription') : t('Add subscription')}
          </Text>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              Actual links are references only. Saving here does not edit
              transactions, rules, payees, or schedules.
            </Trans>
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button variant="normal" onPress={onCancel}>
            <Trans>Cancel</Trans>
          </Button>
          <Button variant="primary" onPress={onSave}>
            <Trans>Save subscription</Trans>
          </Button>
        </View>
      </View>

      <View style={formGridStyle}>
        <Field label={t('Name')} help={help.name}>
          <Input
            value={draft.name}
            onChangeValue={value => set('name', value)}
            style={fullWidthInputStyle}
          />
        </Field>
        <Field label={t('Status')} help={help.status}>
          <Select
            options={statusOptions}
            value={draft.status}
            onChange={value => set('status', value)}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Recurrence')} help={help.recurrence}>
          <Select
            options={recurrenceOptions}
            value={draft.recurrence}
            onChange={value => set('recurrence', value)}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Expected amount')} help={help.amount}>
          <FinancialInput
            value={draft.amount}
            onUpdate={value => set('amount', Math.max(0, value))}
            style={fullWidthInputStyle}
          />
        </Field>
        <Field label={t('Linked Actual payee')} help={help.payeeId}>
          <Select
            options={payeeOptions}
            value={draft.payeeId}
            onChange={value => set('payeeId', value)}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Linked Actual account')} help={help.accountId}>
          <Select
            options={accountOptions}
            value={draft.accountId}
            onChange={value => set('accountId', value)}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Linked Actual category')} help={help.categoryId}>
          <Select
            options={categoryOptions}
            value={draft.categoryId}
            onChange={value => set('categoryId', value)}
            style={selectStyle}
          />
        </Field>
        <Field label={t('Next expected date')} help={help.nextExpectedDate}>
          <DateSelect
            value={draft.nextExpectedDate}
            dateFormat={dateFormat}
            onSelect={value => set('nextExpectedDate', value)}
            inputProps={{
              style: fullWidthInputStyle,
              placeholder: t('Choose expected date'),
            }}
          />
        </Field>
        <Field label={t('Confidence')} help={help.confidence}>
          <Text style={{ padding: '7px 0', fontWeight: 600 }}>
            {t('{{confidence}}%', { confidence: draft.confidence })}
          </Text>
        </Field>
        <Field label={t('Actual schedule')} help={help.actualScheduleId}>
          <Text style={{ padding: '7px 0', color: theme.pageTextSubdued }}>
            {draft.actualScheduleId || t('Link schedule later')}
          </Text>
        </Field>
      </View>

      <Field label={t('Notes')} help={help.notes}>
        <textarea
          value={draft.notes}
          onChange={event => set('notes', event.currentTarget.value)}
          style={textareaStyle}
        />
      </Field>
    </View>
  );
}

export function createBlankSubscriptionDraft(): SubscriptionDraft {
  return {
    name: '',
    payeeId: '',
    actualScheduleId: '',
    categoryId: '',
    accountId: '',
    amount: 0,
    recurrence: 'monthly',
    firstSeen: '',
    lastSeen: '',
    nextExpectedDate: '',
    status: 'candidate',
    confidence: 0,
    notes: '',
  };
}

export function subscriptionToDraft(
  subscription: FlowSubscription,
): SubscriptionDraft {
  return {
    id: subscription.id,
    name: subscription.name,
    payeeId: subscription.payeeId ?? '',
    actualScheduleId: subscription.actualScheduleId ?? '',
    categoryId: subscription.categoryId ?? '',
    accountId: subscription.accountId ?? '',
    amount: subscription.amount,
    recurrence: subscription.recurrence,
    firstSeen: subscription.firstSeen ?? '',
    lastSeen: subscription.lastSeen ?? '',
    nextExpectedDate: subscription.nextExpectedDate ?? '',
    status: subscription.status,
    confidence: subscription.confidence,
    notes: subscription.notes ?? '',
  };
}

export function draftToSubscription(
  draft: SubscriptionDraft,
): Partial<FlowSubscription> {
  return {
    id: draft.id,
    name: draft.name.trim(),
    payeeId: optionalString(draft.payeeId),
    actualScheduleId: optionalString(draft.actualScheduleId),
    categoryId: optionalString(draft.categoryId),
    accountId: optionalString(draft.accountId),
    amount: Math.max(0, Math.round(draft.amount)),
    recurrence: draft.recurrence,
    firstSeen: optionalString(draft.firstSeen),
    lastSeen: optionalString(draft.lastSeen),
    nextExpectedDate: optionalString(draft.nextExpectedDate),
    status: draft.status,
    confidence: Math.max(0, Math.min(100, Math.round(draft.confidence))),
    notes: optionalString(draft.notes),
  };
}

function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: 5, minWidth: 0 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Text style={{ color: theme.pageTextSubdued, fontSize: 12 }}>
          {label}
        </Text>
        {help && <HelpTooltip content={help} />}
      </View>
      {children}
    </View>
  );
}

function HelpTooltip({ content }: { content: string }) {
  const { t } = useTranslation();

  return (
    <Tooltip
      content={
        <Text
          style={{ color: theme.pageTextLight, lineHeight: 1.5, maxWidth: 340 }}
        >
          {content}
        </Text>
      }
      placement="top start"
    >
      <SvgInformationCircle
        width={12}
        height={12}
        aria-label={t('Field help')}
        style={{ color: theme.pageTextSubdued, cursor: 'help' }}
      />
    </Tooltip>
  );
}

function getSubscriptionFieldHelp(t: (key: string) => string) {
  return {
    name: t('Name shown on the Subscriptions page.'),
    status: t(
      'Candidates require review. Confirmed subscriptions count toward totals. Paused, ignored, and cancelled records remain available for history.',
    ),
    recurrence: t(
      'Expected payment interval. The scanner estimates this from transaction dates, and you can correct it after review.',
    ),
    amount: t(
      'Expected charge in Actual integer money units. Price-change warnings compare recent matched transactions with earlier amounts.',
    ),
    payeeId: t(
      'Actual payee used to identify the merchant. Flow stores the ID and does not rename or edit the payee.',
    ),
    accountId: t(
      'Actual account most often used for this payment. This is a reference only.',
    ),
    categoryId: t(
      'Actual category most often used for this payment. This is a reference only.',
    ),
    nextExpectedDate: t(
      "Expected next charge date. It uses Actual's date picker and the date format configured in Settings.",
    ),
    confidence: t(
      'Detector confidence from repeated payee, amount stability, recurring spacing, category consistency, and account consistency.',
    ),
    actualScheduleId: t(
      'A future task can link or create an Actual schedule. TASK011 never creates schedules automatically.',
    ),
    notes: t('Review notes, cancellation details, or other context.'),
  };
}

function optionalString(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}
