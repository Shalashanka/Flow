import React from 'react';
import { Trans } from 'react-i18next';

import { Button } from '@actual-app/components/button';
import { Text } from '@actual-app/components/text';
import { theme } from '@actual-app/components/theme';
import { View } from '@actual-app/components/view';

import { Page } from '#components/Page';
import { useNavigate } from '#hooks/useNavigate';

import type { FlowPage } from './flowPages';

type FlowPlaceholderPageProps = {
  page: FlowPage;
};

export function FlowPlaceholderPage({ page }: FlowPlaceholderPageProps) {
  const navigate = useNavigate();
  const Icon = page.Icon;

  return (
    <Page header={page.title}>
      <View
        style={{
          maxWidth: 720,
          marginTop: 10,
          gap: 18,
          fontSize: 15,
          lineHeight: 1.5,
        }}
      >
        <View
          style={{
            alignSelf: 'flex-start',
            border: `1px solid ${theme.tableBorder}`,
            borderRadius: 8,
            backgroundColor: theme.tableBackground,
            padding: 20,
            gap: 12,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              color: theme.pageText,
            }}
          >
            <Icon width={22} height={22} />
            <Text style={{ fontSize: 20, fontWeight: 600 }}>{page.title}</Text>
          </View>
          <Text style={{ color: theme.noticeText, fontWeight: 600 }}>
            <Trans>Coming soon.</Trans>
          </Text>
          <Text>{page.description}</Text>
          <Text style={{ color: theme.pageTextSubdued }}>
            <Trans>
              This placeholder is intentionally read-only. It does not query,
              write, migrate, or change budget data yet.
            </Trans>
          </Text>
        </View>
        <Button
          style={{ alignSelf: 'flex-start' }}
          onPress={() => navigate(-1)}
        >
          <Trans>Back</Trans>
        </Button>
      </View>
    </Page>
  );
}
