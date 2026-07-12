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

export const summaryGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
};

export const summaryCardStyle: CSSProperties = {
  border: `1px solid ${theme.tableBorder}`,
  borderRadius: 8,
  backgroundColor: theme.pageBackground,
  padding: 14,
  gap: 8,
};

export const formGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
  gap: 14,
};

export const detailGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))',
  gap: 14,
};

export const fullWidthInputStyle: CSSProperties = {
  width: '100%',
};

export const selectStyle: CSSProperties = {
  ...baseInputStyle,
  width: '100%',
  justifyContent: 'space-between',
};

export const textareaStyle: CSSProperties = {
  ...baseInputStyle,
  width: '100%',
  minHeight: 76,
  resize: 'vertical',
};
