# TASK011 Result — Subscription Detector and Subscription Page

## 1. Summary

Implemented the first database-backed Flow Subscriptions feature at `/subscriptions`.

The page reads Actual transactions, accounts, categories, and payees; detects conservative recurring-payment candidates; stores only Flow subscription metadata and transaction links; and supports confirm, ignore, cancel, pause through editing, edit, archive, search, filtering, and match review.

Actual transactions, rules, payees, schedules, account schemas, category schemas, import behavior, and budget calculations are not modified.

## 2. Files Created

- `packages/loot-core/migrations/1784584800000_add_flow_subscriptions.sql`
- `packages/loot-core/src/shared/flow-subscription.ts`
- `packages/desktop-client/src/flow/SubscriptionsPage.tsx`
- `packages/desktop-client/src/flow/subscriptions/types.ts`
- `packages/desktop-client/src/flow/subscriptions/storage.ts`
- `packages/desktop-client/src/flow/subscriptions/detect.ts`
- `packages/desktop-client/src/flow/subscriptions/calculate.ts`
- `packages/desktop-client/src/flow/subscriptions/styles.ts`
- `packages/desktop-client/src/flow/subscriptions/SubscriptionForm.tsx`
- `packages/desktop-client/src/flow/subscriptions/SubscriptionCard.tsx`
- `packages/desktop-client/src/flow/subscriptions/detect.test.ts`
- `packages/desktop-client/src/flow/subscriptions/calculate.test.ts`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK011_RESULT.md`
- Browser evidence under `AGENT_INSTRUCTIONS/CODEX/reports/task011-*.png`

## 3. Files Modified

- `packages/loot-core/src/server/flow/app.ts`
- `packages/desktop-client/src/flow/actual-adapter/index.ts`
- `packages/desktop-client/src/components/FinancesApp.tsx`
- `packages/desktop-client/package.json`

## 4. TASK010 Browser/Validation Preflight

The preflight used installed local Chrome at `C:\Program Files\Google\Chrome\Application\chrome.exe`, avoiding the missing bundled Playwright Chromium.

A fresh demo budget opened `/debts` successfully. The Debt overview, summary, controls, and empty state rendered without `FatalError`, page errors, or console errors. The preflight was intentionally limited to render sanity because TASK011 instructed not to spend excessive time on test infrastructure; add/save/reload/archive was not repeated for TASK010.

Evidence: `task011-debts-preflight.png`.

## 5. Database Tables Added

- `flow_subscription_merchants`: future canonical merchant and matching metadata.
- `flow_subscriptions`: subscription lifecycle, recurrence, expected amount/date, Actual references, confidence, notes, and timestamps.
- `flow_subscription_matches`: links Flow subscriptions to source Actual transaction IDs.

All non-ID columns are nullable or defaulted for compatibility with Actual's column-message insert/update path. All deletes are soft tombstones. Indexes cover status, payee, merchant pattern, subscription match lookup, and transaction match lookup.

## 6. Subscription Models Added

Added strict shared types and validators for:

- statuses: `candidate`, `confirmed`, `ignored`, `cancelled`, `paused`
- recurrences: `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`, `irregular`, `unknown`
- match types: `payee-pattern`, `recurrence`, `manual`
- `FlowSubscription`
- `FlowSubscriptionMatch`

Frontend-only computed, candidate, summary, and reusable warning-code models were also added.

## 7. Backend Handlers Added

- `flow/subscriptions-get`
- `flow/subscription-save`
- `flow/subscription-delete`
- `flow/subscription-matches-get`
- `flow/subscription-matches-save`

Handlers validate names, statuses, recurrences, dates, confidence, integer amounts, and match types. IDs and timestamps are generated when needed. Match replacement and subscription deletion use batched sync-safe writes. No handler writes to an Actual-owned table.

## 8. Frontend Storage/API Added

Added typed frontend functions for reading, saving, and tombstoning subscriptions, plus reading and replacing transaction match rows. There is no localStorage fallback. IPC/database errors surface as local page errors.

## 9. Detection Algorithm

The frontend scanner reads the selected 6, 12, or 24 month range and:

1. Excludes inflows, zero amounts, missing-payee rows, and identifiable transfers.
2. Groups by Actual payee ID, with normalized payee name as a fallback.
3. Requires at least two outflows in different calendar months.
4. Requires a recognized recurring interval: weekly, biweekly, monthly, quarterly, or yearly.
5. Scores repeated payee, amount stability, spacing stability, category consistency, and account consistency from 0 to 100.
6. Saves detected records only as `candidate` unless a prior reviewed status exists.
7. Uses deterministic candidate IDs so re-scans update candidates instead of duplicating them.
8. Preserves reviewed status, notes, manually reviewed amount/recurrence, schedule reference, and custom name.

## 10. Actual Data Integration

`getFlowSubscriptionTransactions` uses AQL to read historical Actual transactions with grouped splits and excludes transfer payees. Existing Actual hooks provide accounts, categories, and payees. Flow stores Actual IDs rather than names as durable references.

TASK011 does not create or edit Actual schedules. A linked schedule ID is displayed when present; otherwise the page displays `Link schedule later`.

## 11. Subscriptions Page Implementation

The native-themed page includes:

- subscription overview and description
- 6/12/24 month scan selector
- scan/re-scan and manual-add controls
- confirmed, candidate, ignored/cancelled, monthly total, yearly total, and price-warning summaries
- search, status filter, and recurrence filter
- responsive subscription cards
- confirm, ignore, cancel, edit, archive, and match-expansion actions
- editable name, status, recurrence, amount, payee, account, category, next date, and notes
- confidence and Actual schedule state
- expandable compact Actual transaction table for matches
- local success and error messages

## 12. Price Change Detection

For confirmed subscriptions and candidates with confidence of at least 70, the latest matched amount is compared with the median of prior matched amounts. A warning appears when the difference exceeds 10 percent:

`Price changed from about X to Y.`

The comparison uses integer money values.

## 13. Monthly/Yearly Total Calculation

Only confirmed subscriptions count toward totals.

- weekly: amount x 52 / 12 monthly, amount x 52 yearly
- biweekly: amount x 26 / 12 monthly, amount x 26 yearly
- monthly: amount monthly, amount x 12 yearly
- quarterly: amount / 3 monthly, amount x 4 yearly
- yearly: amount / 12 monthly, amount yearly
- irregular/unknown: excluded from totals and warned

Division rounds once to the nearest integer money unit. UI values use Actual's active currency/number formatter and `FinancialText`.

## 14. UI Theme / Actual Design Compliance

The page uses Actual `Page`, `View`, `Text`, `Button`, `Input`, `Select`, `DateSelect`, `FinancialInput`, `FinancialText`, `Tooltip`, shared icons, theme tokens, input styles, table borders, warning colors, and spacing conventions.

No separate Flow color system was added. No fixed UI colors or fixed currency symbol were introduced. Dates use Actual's configured date format and date picker.

## 15. Warnings / Edge Cases

Reusable warning codes cover:

- low-confidence candidate
- stale confirmed or paused subscription
- passed expected date
- price change
- missing account/category/payee reference
- duplicate subscriptions for one payee
- unknown or irregular recurrence

Re-scans preserve reviewed records. Archived deterministic candidates may be detected again by a later scan because archive is a tombstone rather than a permanent merchant ignore rule; use `Ignored` when the user never wants a detected candidate included in normal review.

## 16. Commands Run

- `git status --short`
- `git branch --show-current`
- `git remote -v`
- `yarn start:browser`
- local-Chrome Playwright scripts for `/debts` and `/subscriptions`
- `yarn exec oxfmt --write <changed files>`
- `yarn exec oxlint --type-aware <changed source files>`
- `yarn workspace @actual-app/web test src/flow/subscriptions/detect.test.ts src/flow/subscriptions/calculate.test.ts`
- `node scripts/flow/check-flow-layout.mjs`
- `node .yarn/releases/yarn-4.13.0.cjs flow:check-layout`
- `yarn typecheck`
- `yarn workspace @actual-app/web build`
- `yarn lint`
- `git diff --check`

## 17. Command Results

- Branch: `flow-product`.
- Remotes: `origin` is Griseld's fork; `upstream` is Actual Budget.
- Targeted formatting: passed.
- Targeted type-aware lint: passed with 0 warnings and 0 errors.
- Detector/calculation tests: 2 files, 5 tests passed.
- Direct and Yarn layout checks: passed.
- Full monorepo typecheck: passed.
- Web production build: passed.
- `git diff --check`: passed, with the existing package.json LF-to-CRLF warning.
- Full `yarn lint`: failed during repository-wide format checking because 456 pre-existing files outside TASK011 are not formatted according to current `oxfmt`; it did not reach a TASK011 source failure. Changed source files pass targeted checks.
- Build emitted existing non-blocking warnings for browser-externalized `vm`, large chunks, and plugin timing.
- Vitest reported a post-success close timeout caused by an existing Vite watcher, but all five tests completed and passed.

## 18. Browser Smoke Test

Used a fresh demo budget with installed local Chrome.

- `/subscriptions` loaded without `FatalError`.
- Empty state rendered before scan.
- A 12-month scan produced conservative candidates.
- Candidate details and summary counts rendered.
- Confirm persisted after reload.
- Edited name, amount, yearly recurrence, and notes persisted after reload.
- Cancelled status persisted after reload.
- Summary totals updated.
- No browser page errors or console errors occurred.
- Expanded transaction matches were implemented and backed by persisted match IDs.
- Browser actions exercised only Flow handlers; no code path edits Actual transactions.

Evidence:

- `task011-subscriptions-scan.png`
- `task011-subscriptions-persistence.png`

## 19. What Worked

- Existing Flow migration and handler patterns extended cleanly.
- Local Chrome provided browser automation despite missing bundled Chromium.
- Demo data contained recurring outflows and exercised real candidate creation.
- Database persistence, re-scan updates, status changes, edits, and summary recalculation worked.
- Actual theme components produced a native-looking desktop layout.

## 20. What Did Not Work

- The first preflight navigation waited for `networkidle` and timed out because the development app keeps background connections open. Re-running with `domcontentloaded` plus an explicit render wait succeeded.
- The first subscriptions smoke attempt found the dev server had stopped after build activity. Restarting `yarn start:browser` resolved it.
- Repository-wide `yarn lint` remains blocked by unrelated existing formatting drift.

## 21. Risks / Concerns

- Detection intentionally favors false negatives over false positives. Merchants with changing payee IDs or nonstandard billing intervals may require manual entry.
- A two-transaction yearly candidate can be valid but has less evidence than a multi-month candidate; confidence still reflects account/category/amount consistency.
- Match details display transactions only when they remain inside the selected scan period. Persisted link counts remain accurate outside that range.
- Actual schedule linking/creation is intentionally deferred; TASK011 does not create a competing recurrence engine.
- Merchant normalization table exists for future rules but has no management UI or handler yet because v1 groups primarily by Actual payee ID.

## 22. Items To Finish Later

- User-confirmed Actual schedule linking and optional schedule creation.
- Merchant alias/pattern management using `flow_subscription_merchants`.
- System Check consumption of reusable subscription warning codes.
- Optional permanent archive suppression distinct from the existing `Ignored` lifecycle state.
- Broader E2E coverage in the repository test suite once browser binaries are consistently provisioned.

## 23. Recommended Next Task

`TASK012 — Monthly Cashflow Planner.`

TASK011 does not require stabilization before TASK012 based on the successful typecheck, build, targeted tests, and browser persistence smoke.
