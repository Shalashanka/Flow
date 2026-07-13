# TASK012 Result — Monthly Cashflow Planner

## 1. Summary

Replaced the read-only `/cashflow` prototype with a database-backed Monthly Cashflow Planner.

The planner combines selected Actual account transactions, Flow transaction metadata, Flow Settings income/fixed/variable plans, confirmed subscriptions, active debt plans, manual or derived starting cash, and an optional one-off test purchase. It produces deterministic daily rows, running balances, Safe/Warning/Danger status, summary totals, and saved monthly snapshots.

No Actual transaction, schedule, account, category, import, budget, or sync schema is modified.

## 2. Files Created

- `packages/loot-core/migrations/1785193200000_add_flow_cashflow_runs.sql`
- `packages/loot-core/src/shared/flow-cashflow.ts`
- `packages/desktop-client/src/flow/cashflow/types.ts`
- `packages/desktop-client/src/flow/cashflow/storage.ts`
- `packages/desktop-client/src/flow/cashflow/calculate.ts`
- `packages/desktop-client/src/flow/cashflow/calculate.test.ts`
- `packages/desktop-client/src/flow/cashflow/styles.ts`
- `packages/desktop-client/src/flow/cashflow/CashflowTable.tsx`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK012_RESULT.md`
- Browser evidence under `AGENT_INSTRUCTIONS/CODEX/reports/task012-*.png`

## 3. Files Modified

- `packages/loot-core/src/server/flow/app.ts`
- `packages/desktop-client/src/flow/actual-adapter/index.ts`
- `packages/desktop-client/src/flow/CashflowPage.tsx`

## 4. TASK011 Preflight Result

Installed local Chrome opened `/subscriptions` without page errors. Confirmed records were readable. A quick note-only edit assertion did not find the note after reload, but the page and save action completed without errors; TASK011's stronger prior smoke had already verified name, amount, recurrence, notes, confirm, cancel, and reload persistence. The ambiguity is recorded rather than treated as a new Subscriptions defect.

## 5. Database Tables Added

- `flow_cashflow_runs`: month, configuration, selected accounts, thresholds, one-off test, status, summary balances, failure date, and timestamps.
- `flow_cashflow_rows`: dated generated rows, type, Actual references, inflow/outflow, running balance, source, state, and notes.

Non-ID columns are nullable/defaulted for Actual's column-message path. Runs and rows use soft tombstones. Indexes cover month, generated timestamp, run ID, and row date.

## 6. Cashflow Models Added

Added strict shared models and validators for:

- row types from `starting-cash` through `one-off` and `adjustment`
- run statuses `draft`, `generated`, `saved`, `warning`, and `danger`
- starting sources `manual` and `actual-accounts`
- `FlowCashflowRun`
- `FlowCashflowRow`
- `FlowCashflowSummary`
- `FlowCashflowCalculation`

All money values remain integer Actual amounts.

## 7. Backend Handlers Added

- `flow/cashflow-runs-get`
- `flow/cashflow-run-save`
- `flow/cashflow-run-delete`
- `flow/cashflow-rows-get`

Save normalizes and upserts the run, tombstones prior rows, and inserts the current snapshot in one batched sync-safe operation. Delete tombstones the run and all rows. No handler writes to Actual-owned tables.

## 8. Frontend Storage/API Added

Added typed APIs to list runs by month, save one run and its rows, load rows, and delete a run. Cashflow snapshots have no localStorage fallback.

The existing TASK005 Flow Settings loader can still use its pre-existing browser backup mode if database settings fail; TASK012 does not add or use localStorage for runs or generated rows and warns when settings came from backup.

## 9. Cashflow Page Implementation

The page now provides:

- top Safe/Warning/Danger answer
- projected end and lowest balance
- first failure and next income dates
- month picker using Actual `DateSelect`
- manual or Actual-account starting cash
- selectable included accounts
- safe minimum and warning levels
- optional one-off test name, amount, and date
- Generate, Save run, Load saved, and Delete saved actions
- nine summary metrics
- collapsible warnings
- full row-by-row projection table
- Actual account/category names, source, and Actual/Planned state
- field help tooltips

## 10. Data Sources Used

- Actual transactions for the complete selected month
- Actual account balances for optional derived starting cash
- Actual accounts and categories for references/display
- Flow transaction metadata for `cashflowIncluded`
- Flow Settings income plans
- Flow Settings fixed bills
- Flow Settings variable spending rules
- confirmed Flow subscriptions
- active Flow debts

Identifiable transfers are excluded by the Actual adapter. Actual schedules are intentionally not projected in TASK012 and a visible calculation warning documents this.

## 11. Calculation Rules Used

Rows sort by date, starting cash first, Actual rows before plans, income before outflow, then stable name/ID ordering.

Running cash uses:

`balanceAfter = previous balance + inflow - outflow`

The engine tracks end balance, lowest balance, first breach, and next future income. Danger occurs below zero or the safe minimum. Warning occurs below the warning level without a danger breach. Otherwise the result is Safe/generated.

Only future planned rows are included for the current month. All planned rows are included for a future month; historical months do not invent future plan rows.

## 12. Variable Spending Forecast

TASK012 uses user-controlled active Flow Settings variable rules rather than silently forecasting every category.

For each linked rule:

1. Read `monthlyBudget`.
2. Sum included Actual outflows already posted in that category for the month.
3. Calculate `remaining = max(0, monthlyBudget - actual spent)`.
4. Spread remaining integer money over future daily rows, weekly rows, or one final reserve according to `forecastMethod`.

Rules without categories warn and are excluded. With no active rules, the planner warns rather than inventing spending.

## 13. Subscriptions/Debts/Settings Integration

- Confirmed subscriptions only; ignored, cancelled, paused, and candidates are excluded.
- Expected subscription dates advance using the saved recurrence. Unknown/irregular subscriptions require a date in the selected month or warn.
- Active debts use planned payment, falling back to minimum payment.
- Debt due days are clamped to the selected month. Missing due days use the last day and warn.
- Flow Settings active income and fixed bill plans respect day-of-month, active state, start date, and end date.
- Metadata with `cashflowIncluded = false` excludes the Actual row and increments an exclusion warning.

## 14. Save/Load Behavior

V1 uses one deterministic run ID per month: `flow-cashflow-run:YYYY-MM`. Saving the same month replaces that snapshot only after the user clicks Save run.

Loading restores configuration and saved rows without recalculating source data. A warning identifies the view as a saved snapshot. Recalculate/Generate refreshes current sources. Delete removes the saved run and rows through tombstones.

## 15. UI Theme / Actual Design Compliance

The page uses Actual `Page`, `View`, `Text`, `Button`, `Input`, `Select`, `DateSelect`, `FinancialInput`, `FinancialText`, `Tooltip`, shared icons, theme tokens, table styles, date format, currency format, and spacing patterns.

No fixed colors, fixed currency symbol, or separate Flow design system was introduced. The title and snapshot actions share the first top panel, with secondary details below.

## 16. Tests Added

Seven unit tests cover:

1. starting cash plus actual income/expense
2. lowest balance and first danger date
3. debt payment placement
4. confirmed subscription placement
5. variable forecast minus actual spending
6. one-off cost causing danger
7. loaded snapshots not reporting a past income as the next income

All seven pass.

## 17. Commands Run

- repository branch/status/remote checks
- `yarn start:browser`
- local-Chrome Playwright preflight and planner workflows
- targeted `oxfmt --write` and `oxfmt --check`
- targeted `oxlint --type-aware`
- `yarn workspace @actual-app/web test src/flow/cashflow/calculate.test.ts`
- `node scripts/flow/check-flow-layout.mjs`
- `node .yarn/releases/yarn-4.13.0.cjs flow:check-layout`
- `yarn typecheck`
- `yarn workspace @actual-app/web typecheck`
- `yarn workspace @actual-app/web build`
- `yarn lint`
- `git diff --check`

## 18. Command Results

- Branch: `flow-product`.
- Targeted formatting: passed.
- Targeted type-aware lint: 0 warnings and 0 errors.
- Cashflow tests: 1 file, 7 tests passed.
- Full monorepo typecheck: passed.
- Strict web typecheck after final UI fix: passed, 705 strict files.
- Production web build: passed.
- Both layout checks: passed.
- `git diff --check`: passed.
- Full `yarn lint`: stopped on 457 pre-existing repository formatting issues outside the TASK012 changed-source set. Targeted TASK012 formatting and lint pass.
- Build emitted existing non-blocking browser-externalized `vm`, chunk-size, and plugin-timing warnings.
- Vitest completed successfully but reported the existing Vite watcher close timeout after results.

## 19. Browser Smoke Test

Used a fresh demo budget with local Chrome.

- `/cashflow` loaded without `FatalError` or console/page errors.
- Manual starting cash was set to 5,000.00.
- Projection generated with rows, end balance, and lowest balance.
- A 100,000.00 one-off test triggered Danger and appeared in the table/summary.
- Snapshot saved to the Flow database.
- Reload exposed Load saved.
- Loading restored the one-off and generated rows.
- Delete saved removed the snapshot and disabled Load saved.
- Actual transactions were only read; browser actions called Flow run handlers only.

Evidence:

- `task012-cashflow-initial.png`
- `task012-cashflow-saved-run.png`

## 20. What Worked

- Existing Flow handler/migration patterns extended cleanly.
- All required sources can fail independently while calculation continues with warnings.
- Integer row splitting preserves exact variable forecast totals.
- Demo data exercised real Actual income/expense rows and the complete snapshot lifecycle.
- Visual inspection showed a clear top answer, compact controls, readable metrics, and detailed table.

## 21. What Did Not Work

- The old long-running dev process entered `BackendInitFailure` after backend worker/migration HMR. A clean restart fixed it; the migration itself then opened fresh demo budgets and persisted snapshots successfully.
- The first browser scripts targeted only inputs with an explicit `type=text` attribute. Actual `FinancialInput` exposes text behavior without always emitting that attribute, so the smoke selector was corrected to use input order after stable labels/controls.
- Full repository lint remains blocked by unrelated format drift.

## 22. Risks / Concerns

- Actual-account starting cash is exact only when its derivation assumptions hold. For the current month it uses current selected balances minus included posted month net activity. For other months it uses current balances and warns that this is not an exact historical opening balance.
- Actual schedules are not integrated yet. Flow Settings and confirmed Flow records provide v1 future rows.
- Fixed plans and subscriptions are included only when future-dated, reducing obvious double counting but not proving that every planned item has a matching Actual transaction.
- One run per month is intentionally simple; named/multiple scenarios are deferred.
- Saved snapshots preserve row data but do not automatically refresh when source data changes.

## 23. Items To Finish Later

- Safe read-only Actual schedule projection and schedule-to-Flow deduplication.
- Exact historical opening balances for selected accounts.
- Optional matching between posted transactions and planned fixed/subscription/debt rows.
- Multiple named runs/scenarios per month.
- System Check consumption of cashflow warnings and stale snapshot timestamps.
- Scenario Builder, Runway, and Time to Broke remain intentionally out of scope.

## 24. Recommended Next Task

`TASK013 — Affordability Calculator`

TASK012 is stable enough to proceed based on strict typechecks, production build, seven unit tests, and the complete browser persistence smoke.
