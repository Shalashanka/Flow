# TASK010 Result — Debt Metadata Page

## 1. Summary

Built the first real `/debts` page. Debt records are stored in a Flow-owned `flow_debts` table, can be added/edited/archived, link to Actual account/category IDs, and render summary cards, payoff estimates, paid-this-month totals, and warnings.

## 2. Files Created

- `packages/loot-core/migrations/1783980000000_add_flow_debts.sql`
- `packages/loot-core/src/shared/flow-debt.ts`
- `packages/desktop-client/src/flow/DebtsPage.tsx`
- `packages/desktop-client/src/flow/debts/types.ts`
- `packages/desktop-client/src/flow/debts/storage.ts`
- `packages/desktop-client/src/flow/debts/calculate.ts`

## 3. Files Modified

- `packages/loot-core/src/server/flow/app.ts`
- `packages/desktop-client/src/components/FinancesApp.tsx`
- `packages/desktop-client/src/flow/actual-adapter/index.ts`
- `packages/desktop-client/package.json`

## 4. TASK009 Preflight Result

Attempted the requested TASK009 browser preflight before starting TASK010. `yarn start:browser` successfully started Vite on `http://localhost:3001/`, but Playwright automation could not open `/settlement` because Chromium is not installed at the expected Playwright path. Logs were saved in `AGENT_INSTRUCTIONS/CODEX/reports/task010-preflight-start.out.log` and `.err.log`.

## 5. Database Tables Added

Added `flow_debts` with nullable/defaulted columns for sync-safe inserts/updates. Indexes were added for `actual_account_id`, `actual_category_id`, and `status`.

## 6. Debt Models Added

Added shared Flow debt types, priorities, statuses, computed row shape, summary shape, and validators in `flow-debt.ts`. Money values are integer cents; interest is basis points.

## 7. Backend Handlers Added

Added:

- `flow/debts-get`
- `flow/debt-save`
- `flow/debt-delete`

Save normalizes fields, generates IDs, updates timestamps, and does not touch Actual accounts/categories/transactions. Delete soft-tombstones the Flow debt row only.

## 8. Frontend Storage/API Added

Added `getFlowDebts`, `saveFlowDebt`, and `deleteFlowDebt`. There is no localStorage fallback.

## 9. Debts Page Implementation

`/debts` now renders a real page instead of the placeholder. The page includes overview cards, a payment-month picker, Add/Edit form, themed Actual inputs/selects, debt cards, warning panels, and archive actions.

## 10. Actual Account/Category Integration

The page reads Actual accounts and categories for dropdowns and stores only their IDs in Flow debt metadata. Missing linked IDs are handled as warnings instead of crashes.

## 11. Balance and Paid-This-Month Calculation

Balance priority is linked Actual account balance, then manual override, then original amount, then unknown/zero. Actual negative liability balances are displayed as positive owed amounts. Paid-this-month sums linked category outflows for the selected month, uses split-inline category behavior, uses absolute expense values, and excludes identifiable transfers.

## 12. Warnings / Edge Cases

Warnings cover missing account/manual balance, missing category, missing linked Actual records, planned payment below minimum, planned payment zero, unknown balance, paid-off-but-active, and paid-off-with-balance cases.

## 13. Commands Run

- `yarn start:browser` preflight attempt
- `yarn exec oxfmt --write ...`
- `yarn exec oxfmt --check ...`
- `yarn exec oxlint --type-aware ...`
- `yarn flow:check-layout`
- `yarn typecheck`
- `yarn workspace @actual-app/web build`
- `git diff --check`
- `yarn lint`

## 14. Command Results

Targeted formatting/lint passed. `yarn flow:check-layout`, `yarn typecheck`, `yarn workspace @actual-app/web build`, and `git diff --check` passed. Full `yarn lint` did not complete because repo-wide pre-existing formatting drift was reported across many unrelated files before oxlint ran.

## 15. Browser Smoke Test

Full browser smoke was not completed because Playwright Chromium is missing. The app can start and the production web build succeeds, but add/save/reload/archive was not browser-verified in this run.

## 16. What Worked

The backend Flow debt storage compiles cleanly, the route is wired, the page builds, and all changed files pass targeted lint/type checks.

## 17. What Did Not Work

Automated browser validation could not run without installing the Playwright browser binary.

## 18. Risks / Concerns

Paid-this-month depends on category-linked Actual payment transactions and excludes transfers. If the user records debt payments as pure transfers without a linked category outflow, this V1 page will not count them as category payments.

## 19. Items To Finish Later

- Browser smoke after Playwright Chromium is installed.
- Better debt payment discovery if users track debt payments as transfers only.
- Later System Check integration using the reusable warning logic.
- Later Cashflow integration using planned/minimum payments and due days.

## 20. Recommended Next Task

TASK011 — Subscription Detector and Subscription Page.

## Follow-up Update — Due Day Date Picker and Field Help

Updated the Debts add/edit form so `Due day` uses Actual's shared `DateSelect` instead of a numeric text input. Flow still stores only the day of month in `flow_debts.due_day`; the date picker displays that day in the currently selected payment month.

Added hover info icons beside every debt form parameter: name, lender, linked account, linked category, original amount, manual current balance, minimum payment, planned payment, due day, interest rate, priority, status, active, and notes. These use the shared `Tooltip` and `SvgInformationCircle` components so the behavior and styling match Actual's UI.

Validation after this follow-up:

- `yarn exec oxfmt --write packages/desktop-client/src/flow/DebtsPage.tsx` passed.
- `yarn exec oxlint --type-aware packages/desktop-client/src/flow/DebtsPage.tsx` passed.
- `yarn typecheck` passed.
- `yarn workspace @actual-app/web build` passed with the same non-blocking Vite bundle warnings.
- `git diff --check` passed with only the existing line-ending warning for `packages/desktop-client/package.json`.
