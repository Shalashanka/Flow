# TASK006 Result — Flow Transaction Metadata API and Storage

## 1. Summary

Added the durable Flow transaction metadata foundation. Flow can now save, read, batch-read, and clear metadata linked to Actual transaction IDs without modifying Actual transaction rows or budget calculations.

No Transactions page UI, Settlement UI, Quick Entry, Cashflow Forecast, or Scenario Builder work was added.

## 2. Files Created

- `packages/loot-core/src/shared/flow-transaction-metadata.ts`
- `packages/loot-core/migrations/1782172800000_add_flow_transaction_metadata_tombstone.sql`
- `packages/desktop-client/src/flow/transaction-metadata/types.ts`
- `packages/desktop-client/src/flow/transaction-metadata/normalize.ts`
- `packages/desktop-client/src/flow/transaction-metadata/storage.ts`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK006_RESULT.md`

## 3. Files Modified

- `packages/loot-core/src/server/flow/app.ts`

## 4. Existing Table Inspection

TASK005 already created:

```sql
flow_transaction_metadata (
  id TEXT PRIMARY KEY,
  actual_transaction_id TEXT,
  data TEXT DEFAULT '{}',
  created_at TEXT,
  updated_at TEXT
)
```

This matched the preferred TASK006 storage shape, so the implementation uses it with:

```text
id = actualTransactionId
actual_transaction_id = actualTransactionId
data = JSON string of normalized metadata
```

I added one small Flow-owned migration:

```sql
ALTER TABLE flow_transaction_metadata ADD COLUMN tombstone INTEGER DEFAULT 0;
```

Reason: Actual's durable/synced write path works through column messages. A tombstone lets clear/delete behavior use `db.update` and normal change messages instead of a hard SQL delete that would not sync cleanly.

## 5. Metadata Models Added

Added shared Flow metadata types:

- `FlowSharedStatus`
- `FlowSplitMethod`
- `FlowSettlementStatus`
- `FlowSplitParticipant`
- `FlowSplitData`
- `FlowTransactionMetadataData`
- `FlowTransactionMetadataRecord`

The desktop-client `transaction-metadata/types.ts` re-exports these models for Flow UI/API code.

## 6. Normalization / Validation Behavior

Added `normalizeFlowTransactionMetadataData`.

Behavior:

- unknown or missing version returns version 1 defaults
- invalid shared status falls back to `personal`
- invalid split method falls back to `none`
- invalid settlement status falls back to `not-needed`
- invalid split participants are ignored
- empty/invalid participant arrays produce no `splitData`
- non-string notes are ignored
- non-boolean `cashflowIncluded` falls back to `true`
- `fixedAmount` is accepted only as an integer
- settlement month is accepted only as `YYYY-MM`

Backend save normalizes before writing. Backend read normalizes raw DB JSON before returning. Frontend read normalizes again at the API boundary.

## 7. Backend Handlers Added

Added to `packages/loot-core/src/server/flow/app.ts`:

- `flow/transaction-metadata-get`
- `flow/transaction-metadata-get-many`
- `flow/transaction-metadata-save`
- `flow/transaction-metadata-delete`

`get-many` deduplicates input IDs and reads existing rows in one `IN (...)` query. Missing rows are not created by the backend.

`delete` clears Flow metadata with a soft tombstone. It does not delete or modify the Actual transaction.

## 8. Frontend API Added

Added `packages/desktop-client/src/flow/transaction-metadata/storage.ts`:

- `getFlowTransactionMetadata`
- `getFlowTransactionMetadataMany`
- `saveFlowTransactionMetadata`
- `deleteFlowTransactionMetadata`

Frontend `get` and `get-many` return computed defaults for missing DB rows. Save/delete do not use localStorage fallback.

## 9. Default Metadata Behavior

Missing metadata returns `exists: false` and does not create a row.

Defaults come from Flow Settings transaction rules when available:

- `defaultPaidByMemberId`
- `defaultEnteredByMemberId`
- `defaultCashflowIncluded`
- `defaultSplitMethod`

Mapping from Flow Settings split method:

- `shared-50-50` -> shared, equal split
- `only-member` -> personal, no split
- `custom` -> shared, custom split

If Flow Settings are unavailable, safe defaults are used.

## 10. Database Write Path / Sync Findings

- Save uses `db.insert` or `db.update`, which generate normal Actual change/CRDT messages.
- Clear/delete uses `db.update` with `tombstone = 1`, also generating normal change messages.
- No CRDT or sync logic was changed.
- No AQL schema registration was needed because this task uses typed IPC handlers, not AQL/live queries.
- Updated Flow clients with the migration should be able to sync metadata messages through the existing generic sync path.
- Remote clients without the new migration/table/column may hit Actual's existing invalid-schema sync failure.
- Cross-device sync was not directly tested, so it is not claimed as fully proven.

## 11. Commands Run

- `node_modules\.bin\oxfmt.cmd --write packages\loot-core\src\shared\flow-transaction-metadata.ts packages\loot-core\src\server\flow\app.ts packages\desktop-client\src\flow\transaction-metadata\types.ts packages\desktop-client\src\flow\transaction-metadata\normalize.ts packages\desktop-client\src\flow\transaction-metadata\storage.ts`
- `node_modules\.bin\oxlint.cmd --type-aware packages\loot-core\src\shared\flow-transaction-metadata.ts packages\loot-core\src\server\flow\app.ts packages\desktop-client\src\flow\transaction-metadata\types.ts packages\desktop-client\src\flow\transaction-metadata\normalize.ts packages\desktop-client\src\flow\transaction-metadata\storage.ts`
- `node scripts\flow\check-flow-layout.mjs`
- `node .yarn\releases\yarn-4.13.0.cjs flow:check-layout`
- `node .yarn\releases\yarn-4.13.0.cjs typecheck`
- `node .yarn\releases\yarn-4.13.0.cjs workspace @actual-app/web build`
- `node_modules\.bin\vite.cmd build --config packages\loot-core\vite.config.mts --mode development`
- `git diff --check`
- Browser smoke test through local Chrome and the new frontend metadata API.

## 12. Command Results

- Targeted format passed.
- Targeted oxlint passed with 0 warnings and 0 errors after import-style fixes.
- Flow layout checks passed.
- Full typecheck initially found missing literal-union type guards; after adding guards, full typecheck passed.
- Web build passed with existing Vite warnings about `vm` browser externalization, large chunks, and plugin timing.
- Development browser worker rebuild passed.
- `git diff --check` passed.

## 13. Smoke Test

Used a demo budget in local Chrome against `http://localhost:3001`.

Smoke path:

1. Opened/created a demo budget.
2. Loaded one existing Actual transaction.
3. Cleared Flow metadata for that transaction.
4. Read metadata and confirmed `exists: false` defaults.
5. Saved metadata with:
   - paid by first household member
   - entered by first household member
   - shared status `shared`
   - split method `equal`
   - settlement status `open`
   - cashflow included `true`
   - Flow notes
6. Read metadata back and confirmed saved values.
7. Called `getFlowTransactionMetadataMany` with a duplicate real ID plus a missing ID.
8. Updated `cashflowIncluded` and Flow notes.
9. Read again and confirmed update.
10. Deleted/cleared metadata.
11. Read again and confirmed `exists: false`.
12. Re-read the Actual transaction and confirmed id, date, amount, account, category, and payee were unchanged.
13. Confirmed no FatalError rendered.

Result: passed.

## 14. What Worked

- The existing Flow-owned table was usable.
- The new tombstone column allowed sync-friendly clear/delete behavior.
- Frontend defaults are computed without creating metadata rows.
- Batch read returns existing metadata plus frontend defaults for missing IDs.
- Metadata save/update/delete did not mutate the Actual transaction.

## 15. What Did Not Work

- The first typecheck failed until explicit type guards were added for shared status, split method, and settlement status.
- There is no visible UI yet, so smoke testing used direct frontend module calls in the browser.

## 16. Risks / Concerns

- `data` is still a JSON blob. This is appropriate for the early model, but heavily queried metadata may later need more indexed columns.
- `get-many` uses a single `IN` query. If TASK007 calls it with very large lists, batching may be needed.
- Soft-deleted rows remain in the table with `tombstone = 1`.
- AQL schema registration may be needed later if Flow metadata becomes part of live queries.

## 17. Items To Finish Later

- Add optional Flow metadata columns to the Transactions page.
- Add edit UI for metadata.
- Add import/export tooling for `{ actualTransactionId, data }` records.
- Verify two-client sync with both clients on the new migration.
- Consider batch limits for very large transaction lists.

## 18. Recommended Next Task

TASK007 — Add optional Flow metadata columns to the Transactions page.
