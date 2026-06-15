# TASK003 Result — Read-Only Flow Adapter and Cashflow Prototype

## 1. Summary

TASK003 is complete. The `/cashflow` route now renders a read-only Cashflow prototype instead of the generic Flow placeholder. The page reads accounts and transactions through a small Flow adapter layer, calculates a current-month summary, shows summary cards, shows a recent transaction preview, and handles empty/error states locally.

No Actual budget calculations, database schemas, migrations, sync logic, CRDT logic, or write paths were changed.

## 2. Files Created

- `packages/desktop-client/src/flow/actual-adapter/index.ts`
- `packages/desktop-client/src/flow/CashflowPage.tsx`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK003_RESULT.md`

## 3. Files Modified

- `.gitignore`
- `packages/desktop-client/package.json`
- `packages/desktop-client/src/components/FinancesApp.tsx`

## 4. Adapter Implementation

Created `packages/desktop-client/src/flow/actual-adapter/index.ts` as the Flow read layer for the web app.

The adapter exports:

- `FlowDateRange`
- `FlowAccount`
- `FlowTransaction`
- `FlowCashflowSummary`
- `FlowCashflowData`
- `getCurrentMonthDateRange()`
- `getFlowAccounts()`
- `getFlowTransactions(range)`
- `getCurrentMonthCashflowSummary()`
- `getCurrentMonthCashflowData()`
- `calculateCashflowSummary(...)`

The adapter is intentionally read-only. It does not call any mutation IPC, persistence API, migrations, or sync write path.

## 5. Cashflow Page Implementation

Created `packages/desktop-client/src/flow/CashflowPage.tsx`.

The page shows:

- Header: `Cashflow`
- Subtitle: `Read-only prototype using existing Flow transaction data.`
- Summary cards for current month, income, expenses, net cashflow, transactions counted, and accounts found
- Recent current-month transaction preview with date, account, payee/notes, category, and amount
- Empty state when no current-month transactions exist
- Local error panel if adapter reads fail

`packages/desktop-client/src/components/FinancesApp.tsx` now renders `CashflowPage` only when the Flow page id is `cashflow`; all other Flow pages still use `FlowPlaceholderPage`.

## 6. Data Access Path Used

Accounts are read through the existing typed client IPC path:

- `send('accounts-get')`

Transactions are read through the existing desktop-client AQL helper:

- `aqlQuery(...)`
- `q('transactions')`

The transaction query selects transaction fields plus related account, category, and payee names. It uses the existing grouped-splits option and follows the existing Actual cash-flow report convention of excluding off-budget account transactions and transfers.

I used `packages/desktop-client/src/flow/actual-adapter/` instead of `packages/flow` because the current web app already imports Flow UI through desktop-client import aliases. Pulling `packages/flow` into the Vite/TypeScript path would be a larger package-boundary task and was not needed for the first read-only prototype.

## 7. Calculation Rules Used

The current month is derived from the real local calendar date using `monthUtils.monthFromDate(new Date())`.

For June 15, 2026, the page uses:

- Month key: `2026-06`
- Start date: `2026-06-01`
- End date: `2026-06-30`

Amount handling follows Actual's existing integer amount convention and uses `useFormat()` plus `FinancialText` for display.

Prototype calculations:

- `income`: sum of positive transaction amounts
- `expenses`: absolute sum of negative transaction amounts
- `net`: `income - expenses`
- `transactionCount`: count of included transactions
- `accountCount`: count of non-tombstoned accounts returned by `accounts-get`

Transfers are excluded with the AQL filter:

- `'payee.transfer_acct': null`

Off-budget account transactions are excluded with:

- `'account.offbudget': false`

## 8. Known Limitations

- This is not a forecast. It only summarizes actual current-month transactions.
- The transaction preview is limited to 8 recent current-month transactions.
- Split transactions are queried with `splits: 'grouped'`; the preview does not expand split details.
- Account count includes all non-tombstoned accounts returned by `accounts-get`, including off-budget accounts, while transaction totals are on-budget and non-transfer only.
- No recurring schedules, planned income, goals, debts, subscriptions, deadlines, investments, or monthly-close data are included yet.
- No Flow persistence exists yet.
- Error handling is local to the page and intentionally simple.

## 9. Commands Run

```bash
node_modules/.bin/oxfmt.cmd --write packages/desktop-client/src/flow/actual-adapter/index.ts packages/desktop-client/src/flow/CashflowPage.tsx packages/desktop-client/src/components/FinancesApp.tsx packages/desktop-client/package.json
node_modules/.bin/oxlint.cmd --type-aware packages/desktop-client/src/flow/actual-adapter/index.ts packages/desktop-client/src/flow/CashflowPage.tsx packages/desktop-client/src/components/FinancesApp.tsx
node scripts/flow/check-flow-layout.mjs
node .yarn/releases/yarn-4.13.0.cjs flow:check-layout
node_modules/.bin/oxfmt.cmd --check .gitignore packages/desktop-client/package.json packages/desktop-client/src/components/FinancesApp.tsx packages/desktop-client/src/flow/CashflowPage.tsx packages/desktop-client/src/flow/actual-adapter/index.ts
git diff --check
node .yarn/releases/yarn-4.13.0.cjs typecheck
node .yarn/releases/yarn-4.13.0.cjs workspace @actual-app/web build
node .yarn/releases/yarn-4.13.0.cjs start
```

Browser smoke tests were run with Playwright using the installed system Chrome executable because Playwright's bundled Chromium was not installed locally.

## 10. Command Results

- `node scripts/flow/check-flow-layout.mjs`: passed.
- `node .yarn/releases/yarn-4.13.0.cjs flow:check-layout`: passed.
- Targeted `oxfmt --check`: passed.
- Targeted `oxlint --type-aware`: initially failed on import type style in `CashflowPage.tsx`; fixed by splitting type imports into `import type`; rerun passed with 0 warnings and 0 errors.
- `git diff --check`: passed. Git printed CRLF warnings for `.gitignore` and `packages/desktop-client/package.json`, but no whitespace errors.
- `node .yarn/releases/yarn-4.13.0.cjs typecheck`: initially failed with `TS2322` because table header alignment widened to `string`; fixed with an explicit `'left' | 'right'` type; rerun passed.
- `node .yarn/releases/yarn-4.13.0.cjs workspace @actual-app/web build`: passed. Vite printed existing-style warnings about `vm` being externalized for browser compatibility, large chunks, and plugin timing.

## 11. Browser Smoke Test

Dev server was started on:

```text
http://localhost:3001
```

Smoke test 1: demo budget

- Opened `http://localhost:3001`.
- Selected `Don't use a server`.
- Selected `View demo`.
- Confirmed demo budget loaded at `/budget`.
- Opened `/cashflow` through the sidebar.
- Confirmed header, subtitle, summary cards, and transaction preview render.
- Confirmed no `FatalError`, `app-init-failure`, or `BackendInitFailure`.
- Confirmed no page errors or console errors were captured.

Observed demo output included:

- Current month: `2026-06`
- Income this month: `2,816.03`
- Expenses this month: `2,643.52`
- Net cashflow this month: `+172.51`
- Transactions counted: `66`
- Accounts found: `8`

Smoke test 2: empty budget

- Opened a fresh temporary browser context.
- Selected `Don't use a server`.
- Selected `Start fresh`.
- Opened `/cashflow`.
- Confirmed the page rendered with zero totals and the empty state:
  `No current-month transactions found yet. Create or import transactions in Flow, then return here.`
- Confirmed no fatal error and no page errors.

## 12. What Worked

- Existing Actual IPC and AQL paths were enough for a read-only Flow page.
- Existing Actual formatting hooks handled integer money amounts correctly.
- The page remained stable with both demo data and an empty fresh budget.
- The route integration stayed narrow: only `/cashflow` changed from placeholder to prototype.

## 13. What Did Not Work

- The first adapter directory was ignored by git because root `.gitignore` contains `Actual-*`, and Windows matches that pattern case-insensitively against `actual-adapter`. I added a narrow unignore for `packages/desktop-client/src/flow/actual-adapter/`.
- Playwright's bundled Chromium was missing, so the browser smoke test used installed system Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`.
- The first targeted lint/typecheck passes found small local issues, both fixed before final validation.

## 14. Risks / Concerns

- The adapter currently lives inside `desktop-client`. That is practical for this first web prototype, but a later task should decide whether `packages/flow` becomes a real shared package.
- The AQL transaction query follows the existing cash-flow report filter rules, but future Flow planning may need configurable inclusion/exclusion for off-budget accounts and transfers.
- The page refreshes on sync events for account, transaction, category mapping, and payee mapping changes. More granular invalidation can come later.
- The current prototype reads real data, so future forecasting work must remain careful about not writing Actual source-of-truth entities unless explicitly designed.

## 15. Items To Finish Later

- Add planned recurring data from schedules.
- Add scenario structure for future cashflow projections.
- Decide whether Flow read adapters should move to `packages/flow` once package boundaries are intentionally wired.
- Add focused unit tests around `calculateCashflowSummary`.
- Add an E2E smoke test for `/cashflow` once Flow pages become part of the normal test plan.
- Decide whether account count should show all accounts or only the on-budget accounts used by the cashflow query.

## 16. Recommended Next Task

TASK004 — Expand Cashflow with planned recurring data and scenario structure.
