# TASK005 Result — Persistent Flow Settings Storage

## 1. Summary

Moved Flow Settings from browser-only `localStorage` into Flow-owned budget database storage. The UI still supports autosave, manual save, reset, export JSON, import JSON, compact rows, edit forms, account/category dropdowns, and fallback messaging.

## 2. Files Created

- `packages/loot-core/migrations/1781577600000_add_flow_settings.sql`
- `packages/loot-core/src/server/flow/app.ts`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK005_RESULT.md`
- `AGENT_INSTRUCTIONS/CODEX/reports/task005-db-persistence-smoke.png`

## 3. Files Modified

- `packages/desktop-client/src/flow/planning/storage.ts`
- `packages/desktop-client/src/flow/FlowSettingsPage.tsx`
- `packages/loot-core/src/server/main.ts`
- `packages/loot-core/src/types/handlers.ts`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK004B_RESULT.md`

## 4. Database Tables Added

- `flow_settings`
  - one global row with `id = 'default'`
  - `version`
  - `data` JSON string containing the normalized `FlowSettings`
  - `created_at`
  - `updated_at`
- `flow_transaction_metadata`
  - future-facing table for Flow-only transaction metadata
  - no UI or handlers added in this task
  - indexed by `actual_transaction_id`

The task suggested `NOT NULL` columns, but the migration uses nullable/defaulted non-ID columns. Actual's synced `db.insert` applies new rows as column messages, so strict `NOT NULL` columns would fail on the first column insert before the rest of the row is applied.

## 5. Migration Strategy

Load order is now:

1. Read `flow_settings` from the budget database.
2. If no DB row exists, read old `localStorage` key `flow.settings.v1`.
3. If old local settings exist, save them into `flow_settings` and keep localStorage as a backup.
4. If neither exists, load typed defaults and wait for save/autosave before creating the DB row.

LocalStorage is not deleted automatically.

## 6. Backend / IPC Handlers Added

- `flow/settings-get`
- `flow/settings-save`

The handlers live in `packages/loot-core/src/server/flow/app.ts`, are registered in `server/main.ts`, and are included in the shared `Handlers` type.

## 7. Frontend Storage Changes

- `planning/storage.ts` now calls the typed backend handlers via `send`.
- Save/autosave/reset/import write to the budget database.
- Database read/write failure falls back to `flow.settings.v1` as an emergency local backup and returns an explicit warning mode.
- Export JSON uses the current UI/database state, not stale localStorage.

## 8. LocalStorage Migration Behavior

Tested migration from a seeded `flow.settings.v1` key into a fresh demo budget. After migration, clearing `localStorage` and reloading still loaded the migrated settings from the database.

## 9. Sync / Durability Findings

- Writes through `db.insert` and `db.update` generate normal CRDT/change messages.
- New table names are emitted through the existing sync applied event path.
- Direct IPC handlers do not require AQL schema registration because the UI does not query these tables through AQL/live queries yet.
- SQL migration files are auto-discovered by the existing migration runner.
- Cross-device sync was not proven in this task. A remote client without the new migration/table would likely hit Actual's existing `invalid-schema` sync failure until updated.

## 10. UI Copy Changes

- Replaced local-only storage copy with: `Flow Settings are saved in this budget database. Cross-device sync support will be verified in a later task.`
- Database fallback warning: `Database storage failed. Flow Settings are temporarily using browser local backup.`
- Save indicator now says `Saved to budget database at ...` or `Autosaved to budget database at ...`.
- JSON tools copy now explains database storage remains the source of truth when saves succeed.

## 11. Commands Run

- `node_modules\.bin\oxfmt.cmd --write packages\desktop-client\src\flow\FlowSettingsPage.tsx packages\desktop-client\src\flow\planning\storage.ts packages\loot-core\src\server\flow\app.ts packages\loot-core\src\server\main.ts packages\loot-core\src\types\handlers.ts`
- `node_modules\.bin\oxlint.cmd --type-aware packages\desktop-client\src\flow\FlowSettingsPage.tsx packages\desktop-client\src\flow\planning\storage.ts packages\loot-core\src\server\flow\app.ts packages\loot-core\src\server\main.ts packages\loot-core\src\types\handlers.ts`
- `node scripts\flow\check-flow-layout.mjs`
- `node .yarn\releases\yarn-4.13.0.cjs flow:check-layout`
- `node .yarn\releases\yarn-4.13.0.cjs typecheck`
- `node .yarn\releases\yarn-4.13.0.cjs workspace @actual-app/web build`
- `node_modules\.bin\vite.cmd build --config packages\loot-core\vite.config.mts --mode development`
- `git diff --check`
- Browser smoke tests with Playwright using local Chrome.

## 12. Command Results

- Targeted format passed.
- Targeted oxlint had 0 errors and 1 existing warning in `server/main.ts` for the pre-existing handler bootstrap assertion.
- Flow layout checks passed.
- Full typecheck passed.
- Web build passed with existing Vite warnings about `vm` browser externalization, large chunks, and plugin timing.
- Development browser worker rebuild passed.
- `git diff --check` passed; Git printed the normal CRLF warning for the edited markdown report.

## 13. Browser Smoke Test

Tested `http://localhost:3001/flow-settings` on a demo budget with local Chrome.

- Page loaded without FatalError.
- Reset settings to defaults and saved to DB.
- Added a household member.
- Added an income plan.
- Confirmed autosave/manual save showed budget database status.
- Exported JSON and confirmed it included the new rows.
- Cleared `localStorage.flow.settings.v1`.
- Reloaded and confirmed the rows still loaded from the DB.
- Reset to defaults.
- Imported the exported JSON.
- Reloaded and confirmed imported rows persisted from the DB.
- Scrolled to the bottom and confirmed the sticky header remained pinned.
- Separately seeded old localStorage before opening a fresh demo budget and confirmed one-time migration into the DB.

Screenshot artifact:

- `AGENT_INSTRUCTIONS/CODEX/reports/task005-db-persistence-smoke.png`

Bundled Playwright Chromium was not installed, so the smoke test used the local Chrome channel. I did not restart the existing dev server to avoid disrupting the active user session; persistence was verified across page reloads and fresh browser contexts.

## 14. What Worked

- Existing Flow Settings UI behavior survived the storage refactor.
- Database save, autosave, reset, import, and reload persistence worked.
- Clearing localStorage did not remove DB-backed settings.
- Old localStorage settings migrated safely when no DB row existed.

## 15. What Did Not Work

- Strict `NOT NULL` columns are not compatible with Actual's column-message insert path for synced tables.
- The bundled Playwright browser was missing, so local Chrome was used.
- Cross-device sync was not exercised.

## 16. Risks / Concerns

- `flow_settings.data` is still a JSON blob. That is intentional for now, but future high-query features may need normalized tables.
- `flow_transaction_metadata` is schema-only preparation and has no handlers yet.
- LocalStorage backup can become stale after a successful migration because this task preserves it but does not keep it synced.
- Remote sync requires all clients to have the Flow migration before custom table messages are safe.

## 17. Items To Finish Later

- Verify cross-device sync with two updated clients.
- Add cleanup for old `flow.settings.v1` after confidence.
- Add AQL/live-query schema only if future Flow screens query these tables reactively.
- Add UI/handlers for `flow_transaction_metadata` when Quick Entry or Flow Transactions metadata is implemented.

## 18. Recommended Next Task

TASK006 — Build Flow Scenario Builder and Parameterization Foundation.
