# TASK013 Result — Affordability Calculator

## 1. Summary

Replaced the `/affordability` placeholder with a database-backed Affordability Calculator.

The calculator uses a saved TASK012 cashflow snapshot when selected and available, otherwise it generates a fresh TASK012 projection from current Actual and Flow sources. It injects one test-only purchase outflow, recalculates running balances, checks the selected Actual account's ledger balance, and returns an explainable `OK`, `WAIT`, `DANGER`, or `CHECK` decision.

Saved checks contain only Flow-owned planning metadata. No Actual transaction, schedule, account, category, budget, import, bank-sync, or CRDT schema is created or modified by the feature.

All visible date fields and result dates use `DD/MM/YYYY` through Actual's `DateSelect` and date formatting utilities.

## 2. Files Created

- `packages/loot-core/migrations/1785798000000_add_flow_affordability_checks.sql`
- `packages/loot-core/src/shared/flow-affordability.ts`
- `packages/desktop-client/src/flow/AffordabilityPage.tsx`
- `packages/desktop-client/src/flow/affordability/types.ts`
- `packages/desktop-client/src/flow/affordability/storage.ts`
- `packages/desktop-client/src/flow/affordability/calculate.ts`
- `packages/desktop-client/src/flow/affordability/calculate.test.ts`
- `packages/desktop-client/src/flow/affordability/styles.ts`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK013_RESULT.md`
- Browser evidence under `AGENT_INSTRUCTIONS/CODEX/reports/task013-*.png`

## 3. Files Modified

- `packages/loot-core/src/server/flow/app.ts`
- `packages/desktop-client/src/flow/actual-adapter/index.ts`
- `packages/desktop-client/src/components/FinancesApp.tsx`
- `packages/desktop-client/package.json`

## 4. TASK012 Preflight Result

The final preflight succeeded in a fresh demo budget:

- `/cashflow` loaded without `FatalError`.
- Monthly Cashflow Planner generated a projection.
- No page or console errors occurred.
- `Load saved` was disabled because the fresh demo budget had no saved cashflow run; therefore there was no existing run to read.
- Evidence: `task013-cashflow-preflight.png`.

The first preflight attempt checked the setup buttons too early and reached `/cashflow` without opening a budget. The bounded retry waited for setup/demo completion and succeeded.

## 5. Database Tables Added

Added `flow_affordability_checks` with:

- purchase inputs and household context
- decision, reason, and recommended action
- month and cashflow-run link
- before/after/lowest balances and first failure date
- safety thresholds
- soft tombstone and timestamps

All non-ID columns are nullable or defaulted for compatibility with Actual's column-message write path. Indexes cover `month_checked` and `created_at`.

## 6. Affordability Models Added

Added shared strict models and guards for:

- decisions: `ok`, `wait`, `danger`, `check`
- priorities: `low`, `normal`, `high`, `urgent`
- household states: `personal`, `shared`, `ignored`
- split methods: `none`, `equal`, `percentage`, `fixed-amount`, `custom`
- `FlowAffordabilityCheck`
- `FlowAffordabilityCalculation`
- compact simulated cashflow rows

All money values use integer Actual amounts. The calculator does not use floating point money math.

## 7. Backend Handlers Added

- `flow/affordability-checks-get`
- `flow/affordability-check-save`
- `flow/affordability-check-delete`

The save handler normalizes fields, validates required values, generates an ID when needed, updates timestamps, and inserts/updates through Actual's sync-safe DB layer. Delete writes a soft tombstone. The handlers touch only `flow_affordability_checks`.

## 8. Frontend Storage/API Added

Added typed functions:

- `getFlowAffordabilityChecks(month?)`
- `saveFlowAffordabilityCheck(check)`
- `deleteFlowAffordabilityCheck(id)`

There is no localStorage fallback for affordability checks. Read/write failures render local page errors.

## 9. Affordability Page Implementation

The page provides:

- top answer panel with title, subtitle, decision, reason, action, and Calculate/Save controls
- purchase name, amount, Actual date picker, account, category, payer, household use, split, priority, can-wait, and notes inputs
- saved-snapshot or fresh-projection source selection
- detailed help tooltip for every parameter
- projected before/after, purchase-date cash, lowest balance, thresholds, failure date, and account-impact cards
- gross and estimated personal share cards for shared purchases
- warnings and a compact table around the simulated purchase row
- saved check table with load/edit/delete actions
- no separate page-level title outside the first card

The existing `/affordability` route and sidebar item now render the real page.

## 10. Data Sources Used

- Actual active accounts and expense categories
- Actual account ledger balances through the read-only `account-balance` handler
- Actual month transactions through the Flow adapter
- Flow transaction metadata cashflow inclusion
- Flow Settings and active household members
- Flow income plans, fixed bills, and variable spending rules through TASK012
- confirmed Flow subscriptions through TASK012
- active Flow debts through TASK012
- latest saved Flow cashflow run and rows when selected

The initial browser result exposed that `accounts-get.balance_current` is an optional bank-sync field and is null for local/demo accounts. TASK013 now uses Actual's ledger `account-balance` handler, which produced correct current-account and starting-cash values in the final smoke test.

## 11. Calculation Rules Used

1. Load the selected month's saved cashflow snapshot or build a fresh TASK012 projection.
2. Insert one affordability-only outflow on the planned date.
3. Apply the purchase after other projected rows on the same date.
4. Recalculate every running balance with integer addition/subtraction.
5. Compare projected month end before/after, lowest simulated balance, first safety failure, safe minimum, and warning balance.
6. Separately subtract the gross purchase from the selected account's current Actual ledger balance.

The simulated row is never persisted as an Actual transaction and is not added to a cashflow snapshot.

## 12. Decision Logic

- `DANGER`: selected account goes negative, simulated cash goes below zero, or simulated cash breaks the safe minimum.
- `WAIT`: simulated cash remains above the safe minimum but falls below the warning balance.
- `OK`: simulated cash remains above both safety thresholds and the selected account is not negative.
- `CHECK`: required inputs or a reliable cashflow projection are unavailable.

Reasons and actions are stored with the check. Recommended wait actions use the next projected income date when available and display it as `DD/MM/YYYY`.

## 13. Shared Purchase Behavior

Equal split divides the estimated personal share by the number of active household members using integer rounding. The cashflow and selected-account impact always use the gross amount because the full amount leaves the payer's account now.

Percentage, fixed-amount, and custom methods can be recorded, but v1 cannot infer allocations without allocation inputs and shows a clear warning. No Settlement items are created automatically.

## 14. Save/Delete Behavior

Save persists all inputs, the decision explanation, cashflow link, summary balances, thresholds, and timestamps in `flow_affordability_checks`.

Load/edit restores a saved row into the form. Delete soft-tombstones the row. Browser verification confirmed save, reload persistence, load/edit, and deletion.

## 15. UI Theme / Actual Design Compliance

The page uses Actual `Page`, `View`, `Text`, `Button`, `Input`, `Select`, `DateSelect`, `FinancialInput`, `FinancialText`, `Tooltip`, icons, typography helpers, and theme tokens.

Panels, metrics, table headers/cells, positive/warning/error tones, and input styles use active Actual theme values. No separate Flow design system or hard-coded UI colors were added. Layout uses `minHeight: 'auto'` to avoid the previous Flow page collapse issue.

## 16. Tests Added

Seven unit tests cover:

1. `OK` above warning and safe thresholds.
2. `WAIT` below warning but above safe minimum.
3. `DANGER` below zero.
4. `DANGER` below safe minimum.
5. `CHECK` without a cashflow projection.
6. Shared equal personal share while gross amount affects cashflow.
7. Past planned-date warning.

All seven pass.

## 17. Commands Run

- branch, status, remote, and repository instruction checks
- `yarn start:browser`
- local Chrome Playwright preflight and affordability lifecycle scripts
- `yarn workspace @actual-app/web test src/flow/affordability/calculate.test.ts`
- `yarn workspace @actual-app/core typecheck`
- `yarn workspace @actual-app/web typecheck`
- `node scripts/flow/check-flow-layout.mjs`
- `node .yarn/releases/yarn-4.13.0.cjs flow:check-layout`
- targeted `yarn oxfmt --write` and `yarn oxfmt --check`
- targeted `yarn oxlint --type-aware`
- `node .yarn/releases/yarn-4.13.0.cjs typecheck`
- `node .yarn/releases/yarn-4.13.0.cjs workspace @actual-app/web build`
- `git diff --check`

## 18. Command Results

- Branch: `flow-product`.
- Affordability tests: 1 file, 7 tests passed.
- Strict core typecheck: passed.
- Strict web typecheck: passed, 711 strict files.
- Full monorepo typecheck: passed, 6 successful and 4 cached/skipped workspaces.
- Production web build: passed.
- Both Flow layout checks: passed.
- Targeted formatting check: passed.
- Targeted type-aware lint: 0 warnings and 0 errors.
- `git diff --check`: passed; Git printed only the existing Windows LF/CRLF notice for `packages/desktop-client/package.json`.
- Vitest passed but emitted its existing post-result Vite close-timeout message.
- Production build emitted non-blocking existing `vm` browser-externalization, chunk-size, and plugin-timing warnings.

## 19. Browser Smoke Test

Used fresh demo budgets in installed local Chrome.

- `/affordability` loaded without `FatalError`.
- The planned date displayed as `13/07/2026`.
- Entered `Smoke Test Phone`, selected Bank of America and Food, and calculated a 100.00 purchase.
- The small purchase returned `OK: You can afford this.`.
- Changed the amount to 100,000.00.
- The large purchase returned `DANGER: This breaks the plan.`.
- Current account balance was read from Actual's ledger and the negative after-purchase balance rendered.
- Saved the check, reloaded the page, and confirmed the row persisted.
- Loaded the row for editing and confirmed the form was restored.
- Deleted the row and confirmed it disappeared.
- No page errors or console errors occurred.
- Affordability browser actions call only read-only Actual sources and Flow affordability persistence handlers; no Actual transaction write path exists in the feature.

Evidence:

- `task013-affordability-initial.png`
- `task013-affordability-danger.png`
- `task013-cashflow-preflight.png`

## 20. What Worked

- TASK012 calculation and saved-run contracts were reusable without changing Actual reports or budget math.
- Saved snapshots and fresh projections both feed the same pure affordability simulator.
- Actual's ledger balance handler gives reliable local/demo account impact where bank balance fields do not.
- The complete Flow DB save/reload/load-edit/delete lifecycle worked after a clean backend restart.
- Actual theme tokens produced a native light-theme result, and no fixed palette was required.
- The first small-purchase result and large-purchase Danger result were both explainable and visibly tied to concrete balances.

## 21. What Did Not Work

- The first TASK012 browser preflight raced the initial setup screen and timed out; the corrected bounded preflight waited for demo creation.
- The first unit-test expectation placed the negative failure on the purchase date, but the running balance remained positive until a later bill. The expected date was corrected to the actual first negative row.
- Initial account impact used the optional bank-sync balance field and showed `Unavailable` for the demo account. This was corrected to Actual's ledger `account-balance` handler.
- The first delete smoke assertion expected `Affordability check deleted.` while the UI correctly says `Saved affordability check deleted.`. Row deletion itself succeeded.
- Early relative Playwright screenshot paths resolved under the web workspace; generated evidence was moved to the required root `AGENT_INSTRUCTIONS/CODEX/reports` folder and later scripts used absolute report paths.

## 22. Risks / Concerns

- Future-month fresh projections use current ledger balances as an estimated opening amount and visibly warn about that limitation.
- Saved cashflow snapshots can become stale; snapshots older than seven days warn but are still user-selectable.
- Purchase ordering assumes other projected rows on the same date occur before the purchase. Time-of-day ordering is not available.
- Percentage, fixed, and custom household split allocations need explicit per-member inputs before their personal share can be calculated safely.
- TASK012's existing schedule and plan-deduplication limitations also affect fresh affordability projections.
- Saved checks preserve the decision at save time and do not auto-recalculate when source data changes; loading and calculating again refreshes the answer.

## 23. Items To Finish Later

- Exact historical/future opening balances rather than current-balance estimates.
- Safe read-only Actual schedule projection and stronger posted/planned deduplication in Cashflow.
- Explicit per-member percentage/fixed/custom allocation inputs.
- Optional search for the first safe purchase date across future income events.
- System Check integration for stale affordability checks and unavailable source data.

These are enhancements. The TASK013 page's required calculate, explain, save, load/edit, and delete workflows are complete.

## 24. Recommended Next Task

`TASK014 — Yearly Monthly Overview`

TASK013 is stable enough to proceed based on seven passing unit tests, strict package and monorepo typechecks, production build, layout checks, targeted lint/format checks, and the complete browser persistence lifecycle.
