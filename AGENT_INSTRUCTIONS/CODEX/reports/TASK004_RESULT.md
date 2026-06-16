# TASK004 Result — Flow Planning Setup Foundation

## 1. Summary

TASK004 is complete. I added a global Flow Settings page at `/flow-settings`, placed it under the existing `More` navigation group, and built the typed configuration foundation for household members, transaction rules, cashflow parameters, income plans, fixed bills, variable spending rules, and scenarios.

No Actual budget calculations, database schemas, migrations, sync behavior, CRDT logic, transactions, budgets, accounts, or categories were modified.

## 2. Files Created

- `packages/desktop-client/src/flow/FlowSettingsPage.tsx`
- `packages/desktop-client/src/flow/planning/types.ts`
- `packages/desktop-client/src/flow/planning/defaults.ts`
- `packages/desktop-client/src/flow/planning/storage.ts`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK004_RESULT.md`

## 3. Files Modified

- `packages/desktop-client/package.json`
- `packages/desktop-client/src/components/FinancesApp.tsx`
- `packages/desktop-client/src/flow/flowPages.ts`

## 4. Planning Models Added

Added typed Flow settings models for:

- `FlowHouseholdMember`
- `FlowTransactionRules`
- `FlowCashflowSettings`
- `FlowIncomePlan`
- `FlowFixedBill`
- `FlowVariableSpendingRule`
- `FlowScenario`
- `FlowSettings`

`FlowPlanningSetup` is currently an alias of `FlowSettings` for transition compatibility. Money fields use Actual integer amount units; for example, the default warning balance of `300.00` is stored as `30000`.

## 5. Persistence Strategy Used

TASK004 uses temporary browser local storage with this key:

```text
flow.settings.v1
```

This avoids schema changes and migrations. The page displays a local-only notice:

```text
Flow Settings is currently stored locally on this browser. Shared sync storage will be added in a later task.
```

Important limitation: this local storage key is global to the browser and is not synced or budget-file-specific yet.

## Global Settings vs Cashflow Settings

Global settings implemented:

- household members
- member roles
- member active flags
- member default Actual account IDs
- transaction rule defaults for paid-by, entered-by, split method, and cashflow inclusion

Cashflow/planning settings implemented:

- projection mode
- default scenario
- minimum safe balance
- warning balance
- starting balance mode
- include off-budget accounts
- include transfers
- planned income rows
- fixed bill rows
- variable spending rules
- scenarios

Household members and transaction rules are intentionally global. They are meant to support future Quick Entry, Flow Transactions, Settlement, Cashflow, Monthly Close, and reports without changing Actual's original transaction table.

The storage name reflects global Flow settings (`flow.settings.v1`), so no rename is currently needed. The storage backend itself still needs migration later to synced, budget-aware Flow-owned persistence.

## 6. Planning Setup Page Implementation

Added `FlowSettingsPage` with these sections:

- Household
- Transaction Rules
- Cashflow Parameters
- Income Plan
- Fixed Bills
- Variable Spending
- Scenarios
- JSON Import / Export

The page supports adding, editing, and removing rows for the editable list sections. It uses existing Actual components such as `Button`, `Input`, `Select`, and `FinancialInput`.

## 7. Actual Account/Category Dropdown Integration

The page uses existing safe read hooks:

- `useAccounts()`
- `useCategories()`

Account and category dropdowns store Actual IDs, not names:

- `defaultAccountId`
- `accountId`
- `categoryId`

If account/category dropdown data fails to load, the page shows a warning and remains editable.

## 8. Save/Reset/Import/Export Behavior

Implemented:

- Save to `localStorage`
- Reset to typed defaults
- Export settings JSON to an editable textarea
- Import settings JSON from the textarea
- Basic version/shape validation for imported JSON
- Graceful error status for invalid JSON

Future Cashflow can call:

- `getFlowSettings()`
- `saveFlowSettings(settings)`

## 9. Commands Run

```bash
node_modules/.bin/oxfmt.cmd --write packages/desktop-client/package.json packages/desktop-client/src/components/FinancesApp.tsx packages/desktop-client/src/flow/flowPages.ts packages/desktop-client/src/flow/FlowSettingsPage.tsx packages/desktop-client/src/flow/planning/types.ts packages/desktop-client/src/flow/planning/defaults.ts packages/desktop-client/src/flow/planning/storage.ts
node_modules/.bin/oxlint.cmd --type-aware packages/desktop-client/src/components/FinancesApp.tsx packages/desktop-client/src/flow/flowPages.ts packages/desktop-client/src/flow/FlowSettingsPage.tsx packages/desktop-client/src/flow/planning/types.ts packages/desktop-client/src/flow/planning/defaults.ts packages/desktop-client/src/flow/planning/storage.ts
node .yarn/releases/yarn-4.13.0.cjs typecheck
node scripts/flow/check-flow-layout.mjs
node .yarn/releases/yarn-4.13.0.cjs flow:check-layout
node_modules/.bin/oxfmt.cmd --check packages/desktop-client/package.json packages/desktop-client/src/components/FinancesApp.tsx packages/desktop-client/src/flow/flowPages.ts packages/desktop-client/src/flow/FlowSettingsPage.tsx packages/desktop-client/src/flow/planning/types.ts packages/desktop-client/src/flow/planning/defaults.ts packages/desktop-client/src/flow/planning/storage.ts
git diff --check
node .yarn/releases/yarn-4.13.0.cjs workspace @actual-app/web build
node .yarn/releases/yarn-4.13.0.cjs start
node_modules/.bin/vite.cmd build --config packages/loot-core/vite.config.mts --mode development
```

Browser smoke tests were run with Playwright against installed system Chrome.

## 10. Command Results

- Targeted `oxfmt --write`: passed.
- Targeted `oxlint --type-aware`: initially failed on import ordering, missing switch default, and unknown-error formatting; fixed and rerun passed with 0 warnings and 0 errors.
- `node .yarn/releases/yarn-4.13.0.cjs typecheck`: initially failed on readonly Select tuples and import-result narrowing; fixed and rerun passed.
- `node scripts/flow/check-flow-layout.mjs`: passed.
- `node .yarn/releases/yarn-4.13.0.cjs flow:check-layout`: passed.
- Targeted `oxfmt --check`: passed.
- `git diff --check`: passed. Git printed a CRLF warning for `packages/desktop-client/package.json`, but no whitespace errors.
- `node .yarn/releases/yarn-4.13.0.cjs workspace @actual-app/web build`: passed. Vite printed existing-style warnings about `vm` browser externalization, large chunks, and plugin timing.
- `node_modules/.bin/vite.cmd build --config packages/loot-core/vite.config.mts --mode development`: passed and restored `kcab.worker.dev.js` after the production web build replaced the dev worker output.

## 11. Browser Smoke Test

Dev server:

```text
http://localhost:3001
```

Tested:

- opened the app
- selected `Don't use a server`
- created/opened a demo budget with `View demo`
- opened `/flow-settings`
- added a household member named `Smoke Member`
- added an income plan named `Smoke Income`
- added a fixed bill named `Smoke Rent`
- added a variable spending rule named `Smoke Groceries`
- saved settings
- reloaded browser and confirmed the input values persisted
- exported JSON and confirmed the JSON contained the smoke data
- reset to defaults and confirmed the smoke values were removed
- imported the exported JSON and confirmed the smoke values returned
- confirmed no `FatalError`, `app-init-failure`, or `BackendInitFailure`
- confirmed no captured page errors or console errors

One smoke-test note: Playwright's coordinate-based clicks were intercepted when it scrolled top-section buttons under the app's absolute titlebar. The final smoke used native button clicks through the button elements while still verifying real React handlers, state, local storage, reload, export, reset, and import behavior.

After the production build, I restored the development backend worker and confirmed a fresh page load reached the setup screen without fatal backend-worker errors.

## 12. What Worked

- The Flow page integrated cleanly into the existing Flow navigation model.
- Local storage was enough for a conservative TASK004 persistence prototype.
- Existing account/category hooks provided safe read-only dropdown data.
- `FinancialInput` kept money editing aligned with Actual integer amount handling.
- Save/reload/export/reset/import all worked in the browser smoke test.

## 13. What Did Not Work

- Synced, budget-aware Flow persistence is not available yet, so TASK004 uses temporary local storage.
- The first targeted lint/typecheck passes found local style/type issues; all were fixed.
- The web production build overwrote the dev worker output in `packages/loot-core/lib-dist/browser`; this was corrected with a development worker build.
- Playwright's normal click coordinates hit the titlebar overlay in the first section during automation. The UI still functioned through the button handlers, but this is worth keeping in mind for future E2E tests.

## 14. Risks / Concerns

- `flow.settings.v1` is local to one browser and not synced.
- `flow.settings.v1` is not budget-file-specific yet.
- Import validation is intentionally basic; it normalizes version 1 settings and falls back optional fields, but it is not a schema validator.
- The page is broad and practical, but not final UX. Some sections may need denser table controls or dedicated editors later.
- Future Flow transaction metadata must remain separate from Actual transaction storage.

## 15. Items To Finish Later

- Replace temporary local storage with synced, budget-aware Flow-owned persistence.
- Add focused tests for storage parsing/normalization.
- Add a proper E2E test once the titlebar/scroll automation issue is handled.
- Add transaction metadata storage linked by Actual transaction ID.
- Add Goals/Debts/Subscription/Deadline defaults only when those modules are ready.
- Let Cashflow read `FlowSettings` and generate projected rows.

## 16. Recommended Next Task

TASK005 — Use Planning Setup data to generate projected monthly Cashflow rows with running balance, minimum balance warning, and scenario support.
