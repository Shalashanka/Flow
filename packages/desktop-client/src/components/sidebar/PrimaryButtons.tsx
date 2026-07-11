import React, { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';

import {
  SvgCheveronDown,
  SvgCheveronRight,
  SvgCog,
  SvgCreditCard,
  SvgReports,
  SvgStoreFront,
  SvgTag,
  SvgTuning,
  SvgWallet,
} from '@actual-app/components/icons/v1';
import { SvgCalendar3 } from '@actual-app/components/icons/v2';
import { View } from '@actual-app/components/view';

import { getFlowPages } from '#flow/flowPages';
import { useIsTestEnv } from '#hooks/useIsTestEnv';
import { useNavigate } from '#hooks/useNavigate';
import { useSyncServerStatus } from '#hooks/useSyncServerStatus';

import { Item } from './Item';
import { SecondaryItem } from './SecondaryItem';

export function PrimaryButtons() {
  const { t } = useTranslation();
  const [isMoreOpen, setMoreOpen] = useState(false);
  const onMoreToggle = useCallback(() => setMoreOpen(open => !open), []);
  const navigate = useNavigate();
  const location = useLocation();
  const flowPages = getFlowPages(t);
  const primaryFlowPages = flowPages.filter(
    page => page.sidebarGroup === 'primary',
  );
  const moreFlowPages = flowPages.filter(page => page.sidebarGroup === 'more');

  const syncServerStatus = useSyncServerStatus();
  const isTestEnv = useIsTestEnv();
  const isUsingServer = syncServerStatus !== 'no-server' || isTestEnv;

  const isMoreActive = [
    ...moreFlowPages.map(page => page.path),
    '/payees',
    '/rules',
    '/bank-sync',
    '/tags',
    '/settings',
    '/tools',
  ].some(route => location.pathname.startsWith(route));

  const navigateFromMore = useCallback(
    (path: string) => {
      setMoreOpen(false);
      void navigate(path);
    },
    [navigate],
  );

  return (
    <View style={{ flexShrink: 0 }}>
      <Item title={t('Budget')} Icon={SvgWallet} to="/budget" />
      <Item title={t('Reports')} Icon={SvgReports} to="/reports" />
      <Item title={t('Schedules')} Icon={SvgCalendar3} to="/schedules" />
      {primaryFlowPages.map(page => (
        <Item
          key={page.id}
          title={page.title}
          Icon={page.Icon}
          to={page.path}
        />
      ))}
      <Item
        title={t('More')}
        Icon={isMoreOpen ? SvgCheveronDown : SvgCheveronRight}
        onClick={onMoreToggle}
        style={{ marginBottom: isMoreOpen ? 8 : 0 }}
        forceActive={!isMoreOpen && isMoreActive}
      />
      {isMoreOpen && (
        <>
          {moreFlowPages.map(page => (
            <SecondaryItem
              key={page.id}
              title={page.title}
              Icon={page.Icon}
              onClick={() => navigateFromMore(page.path)}
              indent={15}
            />
          ))}
          <SecondaryItem
            title={t('Payees')}
            Icon={SvgStoreFront}
            onClick={() => navigateFromMore('/payees')}
            indent={15}
          />
          <SecondaryItem
            title={t('Rules')}
            Icon={SvgTuning}
            onClick={() => navigateFromMore('/rules')}
            indent={15}
          />
          {isUsingServer && (
            <SecondaryItem
              title={t('Bank Sync')}
              Icon={SvgCreditCard}
              onClick={() => navigateFromMore('/bank-sync')}
              indent={15}
            />
          )}
          <SecondaryItem
            title={t('Tags')}
            Icon={SvgTag}
            onClick={() => navigateFromMore('/tags')}
            indent={15}
          />
          <SecondaryItem
            title={t('Settings')}
            Icon={SvgCog}
            onClick={() => navigateFromMore('/settings')}
            indent={15}
          />
        </>
      )}
    </View>
  );
}
