import { useCallback, useEffect, useMemo, useState } from 'react';

import { getFlowSettings } from '#flow/planning/storage';
import type { FlowSettings } from '#flow/planning/types';

import {
  getFlowTransactionMetadata,
  getFlowTransactionMetadataMany,
} from './storage';
import type { FlowTransactionMetadataRecord } from './types';

const FLOW_METADATA_BATCH_SIZE = 250;

type UseFlowTransactionMetadataResult = {
  metadataByTransactionId: Map<string, FlowTransactionMetadataRecord>;
  settings: FlowSettings | null;
  hasLoadError: boolean;
  setMetadataRecord: (record: FlowTransactionMetadataRecord) => void;
  refreshMetadataRecord: (
    transactionId: string,
  ) => Promise<FlowTransactionMetadataRecord>;
};

export function useFlowTransactionMetadata(
  transactionIds: readonly string[],
): UseFlowTransactionMetadataResult {
  const transactionIdsKey = useMemo(
    () => transactionIds.join('\u0000'),
    [transactionIds],
  );
  const [metadataByTransactionId, setMetadataByTransactionId] = useState(
    () => new Map<string, FlowTransactionMetadataRecord>(),
  );
  const [settings, setSettings] = useState<FlowSettings | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);

  useEffect(() => {
    let isActive = true;

    async function loadSettings() {
      try {
        const loadedSettings = await getFlowSettings();

        if (isActive) {
          setSettings(loadedSettings);
        }
      } catch {
        if (isActive) {
          setSettings(null);
        }
      }
    }

    void loadSettings();

    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    let isActive = true;
    const ids = transactionIdsKey ? transactionIdsKey.split('\u0000') : [];

    async function loadMetadata() {
      if (ids.length === 0) {
        setMetadataByTransactionId(new Map());
        return;
      }

      try {
        const records: FlowTransactionMetadataRecord[] = [];

        for (
          let index = 0;
          index < ids.length;
          index += FLOW_METADATA_BATCH_SIZE
        ) {
          const batch = ids.slice(index, index + FLOW_METADATA_BATCH_SIZE);
          records.push(...(await getFlowTransactionMetadataMany(batch)));
        }

        if (isActive) {
          setHasLoadError(false);
          setMetadataByTransactionId(
            new Map(
              records.map(record => [record.actualTransactionId, record]),
            ),
          );
        }
      } catch {
        if (isActive) {
          setHasLoadError(true);
        }
      }
    }

    void loadMetadata();

    return () => {
      isActive = false;
    };
  }, [transactionIdsKey]);

  const setMetadataRecord = useCallback(
    (record: FlowTransactionMetadataRecord) => {
      setMetadataByTransactionId(current => {
        const next = new Map(current);
        next.set(record.actualTransactionId, record);
        return next;
      });
    },
    [],
  );

  const refreshMetadataRecord = useCallback(
    async (transactionId: string) => {
      const record = await getFlowTransactionMetadata(transactionId);
      setMetadataRecord(record);
      return record;
    },
    [setMetadataRecord],
  );

  return {
    metadataByTransactionId,
    settings,
    hasLoadError,
    setMetadataRecord,
    refreshMetadataRecord,
  };
}
