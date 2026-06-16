import type { ComponentType, SVGProps } from 'react';

import {
  SvgCalculator,
  SvgCalendar,
  SvgChartBar,
  SvgCheckmarkOutline,
  SvgCog,
  SvgCreditCard,
  SvgDashboard,
  SvgFlag,
  SvgPortfolio,
  SvgRefresh,
  SvgShield,
  SvgSwap,
  SvgTarget,
} from '@actual-app/components/icons/v1';
import type { TFunction } from 'i18next';

export type FlowPage = {
  id: string;
  path: string;
  title: string;
  description: string;
  sidebarGroup: 'primary' | 'more';
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

export function getFlowPages(t: TFunction): FlowPage[] {
  return [
    {
      id: 'cashflow',
      path: '/cashflow',
      title: t('Cashflow'),
      description: t(
        'This page will forecast future liquidity using transactions, planned income, recurring bills, goals, debts, and scenarios.',
      ),
      sidebarGroup: 'primary',
      Icon: SvgChartBar,
    },
    {
      id: 'goals',
      path: '/goals',
      title: t('Goals'),
      description: t(
        'This page will track real progress toward household goals using linked categories, linked accounts, and marked contributions.',
      ),
      sidebarGroup: 'primary',
      Icon: SvgTarget,
    },
    {
      id: 'debts',
      path: '/debts',
      title: t('Debts'),
      description: t(
        'This page will plan and track debts, payoff dates, payment progress, and monthly debt commitments.',
      ),
      sidebarGroup: 'primary',
      Icon: SvgCreditCard,
    },
    {
      id: 'monthly-close',
      path: '/monthly-close',
      title: t('Monthly Close'),
      description: t(
        'This page will guide month-end and month-start checks so account balances, settlements, goals, debts, and cashflow stay reviewed.',
      ),
      sidebarGroup: 'primary',
      Icon: SvgCheckmarkOutline,
    },
    {
      id: 'account-control',
      path: '/account-control',
      title: t('Account Control'),
      description: t(
        'This page will compare expected balances with manually confirmed real balances and highlight unresolved differences.',
      ),
      sidebarGroup: 'more',
      Icon: SvgShield,
    },
    {
      id: 'settlement',
      path: '/settlement',
      title: t('Settlement'),
      description: t(
        'This page will track shared spending, reimbursements, and who owes whom for each month.',
      ),
      sidebarGroup: 'more',
      Icon: SvgSwap,
    },
    {
      id: 'affordability',
      path: '/affordability',
      title: t('Affordability'),
      description: t(
        'This page will estimate whether a planned purchase is safe based on cashflow, account balances, goals, debts, and upcoming bills.',
      ),
      sidebarGroup: 'more',
      Icon: SvgCalculator,
    },
    {
      id: 'subscriptions',
      path: '/subscriptions',
      title: t('Subscriptions'),
      description: t(
        'This page will track recurring services, upcoming payments, yearly cost, usage, and cancellation candidates.',
      ),
      sidebarGroup: 'more',
      Icon: SvgRefresh,
    },
    {
      id: 'deadlines',
      path: '/deadlines',
      title: t('Deadlines'),
      description: t(
        'This page will track financial and administrative deadlines, reminders, priority, risk, and any cashflow impact.',
      ),
      sidebarGroup: 'more',
      Icon: SvgFlag,
    },
    {
      id: 'investments',
      path: '/investments',
      title: t('Investments'),
      description: t(
        'This page will track investments and model long-term ETF growth, contributions, fees, inflation, and scenarios.',
      ),
      sidebarGroup: 'more',
      Icon: SvgPortfolio,
    },
    {
      id: 'system-check',
      path: '/system-check',
      title: t('System Check'),
      description: t(
        'This page will run health checks for stale data, unresolved differences, missing plans, unmatched reimbursements, and other blockers.',
      ),
      sidebarGroup: 'more',
      Icon: SvgDashboard,
    },
    {
      id: 'monthly-overview',
      path: '/monthly-overview',
      title: t('Monthly Overview'),
      description: t(
        'This page will summarize each month with income, expenses, savings, debt, end cash, net worth, status, and notes.',
      ),
      sidebarGroup: 'more',
      Icon: SvgCalendar,
    },
    {
      id: 'flow-settings',
      path: '/flow-settings',
      title: t('Flow Settings'),
      description: t(
        'This page configures global Flow household rules and planning assumptions for future Flow modules.',
      ),
      sidebarGroup: 'more',
      Icon: SvgCog,
    },
  ];
}
