import type { CSSProperties } from 'react';

import { baseInputStyle } from '@actual-app/components/input';
import { theme } from '@actual-app/components/theme';

export const panelStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.tableBackground,
  padding: 16,
  gap: 16,
};

export const answerGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
  gap: 12,
};

export const metricStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.pageBackground,
  padding: 14,
  gap: 7,
};

export const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
  gap: 14,
};

export const fullWidthStyle: CSSProperties = {
  width: '100%',
};

export const selectStyle: CSSProperties = {
  ...baseInputStyle,
  width: '100%',
  justifyContent: 'space-between',
};

export const detailsStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.tableBackground,
  padding: 14,
};

export const tableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

export const tableHeaderStyle: CSSProperties = {
  padding: '9px 10px',
  textAlign: 'left',
  color: theme.tableHeaderText,
  backgroundColor: theme.tableHeaderBackground,
  borderBottom: `1px solid ${theme.tableBorder}`,
  whiteSpace: 'nowrap',
};

export const tableCellStyle: CSSProperties = {
  padding: '9px 10px',
  borderBottom: `1px solid ${theme.tableBorder}`,
  verticalAlign: 'top',
};
