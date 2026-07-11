# TASK009 Result — Monthly Settlement Close and Payment Linking

## 1. Summary

Implemented a Flow-owned monthly settlement close workflow. Saved settlement summaries can now link to real Actual transactions, show amount match status, be unlinked/relinked, and be protected by a month-level close/reopen state.

Actual transactions remain read-only in this workflow. Flow does not create transfers and does not edit Actual transaction amount, date, payee, account, category, notes, cleared, or reconciled fields.

## 2. Files Created

- `packages/loot-core/migrations/1783380000000_add_flow_settlement_close.sql`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK009_RESULT.md`

## 3. Files Modified

- `packages/loot-core/src/shared/flow-settlement.ts`
- `packages/loot-core/src/server/flow/app.ts`
- `packages/desktop-client/src/flow/settlement/types.ts`
- `packages/desktop-client/src/flow/settlement/storage.ts`
- `packages/desktop-client/src/flow/actual-adapter/index.ts`
- `packages/desktop-client/src/flow/SettlementPage.tsx`

## 4. Database Tables Added or Reused

Reused:

- `flow_settlements`
- `flow_settlement_items`
- `flow_settlements.payment_transaction_id`

Added:

- `flow_settlement_payment_links`
- `flow_settlement_month_closures`

The new tables use nullable/defaulted non-ID columns to stay compatible with Actual's insert/update patterns.

## 5. Settlement Payment Link Models

Added shared model support for:

- `FlowSettlementPaymentLink`
- `FlowSettlementPaymentLinkStatus`
- statuses: `linked`, `unlinked`, `ignored`

The v1 design supports one active linked Actual transaction per net settlement summary. Partial payments and payment history are left for a later task.

## 6. Month Close Models

Added shared model support for:

- `FlowSettlementMonthClosure`
- `FlowSettlementMonthStatus`
- statuses: `open`, `calculated`, `payment-linked`, `closed`, `reopened`

The page derives `calculated` and `payment-linked` when no closure row exists yet, and persists explicit close/reopen state through the backend.

## 7. Backend Handlers Added

Added:

- `flow/settlement-payment-links-get`
- `flow/settlement-payment-link-save`
- `flow/settlement-payment-link-delete`
- `flow/settlement-month-close-get`
- `flow/settlement-month-close-save`
- `flow/settlement-month-reopen`

Backend behavior:

- linking updates Flow payment-link rows and `flow_settlements.payment_transaction_id`
- linking marks the settlement summary `paid`
- unlinking tombstones the Flow payment-link row and resets the summary to `open`
- closing marks the month closure `closed` and saved summary rows `closed`
- reopening marks the month closure `reopened` and returns summary rows to `paid` or `open`
- save/clear/link/unlink are blocked server-side for closed months

## 8. Frontend Storage/API Changes

Added storage helpers:

- `getSettlementPaymentLinks`
- `saveSettlementPaymentLink`
- `deleteSettlementPaymentLink`
- `getSettlementMonthClose`
- `closeSettlementMonth`
- `reopenSettlementMonth`
- `getSettlementId`

No localStorage was added.

## 9. Settlement Page UI Changes

Updated `/settlement` with:

- month close status in the Settlement details area
- linked payment count
- close/reopen buttons in the page header
- save/clear/link/unlink disabled while closed
- closed-month recalculation shown as preview only
- saved snapshot readout with status, summary count, linked payment count, linked transaction IDs, closed date, and reopened date
- payment cards with linked payment details, match status, link/change/unlink controls, and candidate selector

## 10. Payment Transaction Selection

Added read-only Actual transaction queries for payment candidates:

- selected-month candidate list includes normal transactions and transfers
- linked transaction lookup includes transfers
- selector shows date, account, payee/notes, and absolute amount
- search filters by date, account, payee, category, notes, and amount
- sort prioritizes amount closeness, "settlement" text, and member-name text

## 11. Payment Match Logic

Implemented integer-money matching:

- exact: absolute transaction amount equals settlement amount
- close: difference is less than or equal to 100 cents
- mismatch: any larger amount difference
- missing linked transaction is shown as a warning
- linked transaction outside the selected settlement month is included in close warnings

Direction inference is intentionally not overclaimed in v1.

## 12. Month Close / Reopen Behavior

Closing:

- requires a saved settlement snapshot
- asks for confirmation when links are missing, linked transactions are missing, amounts mismatch, or linked payment month differs
- persists month status `closed`
- marks saved summary rows `closed`
- marks source Flow transaction metadata rows `settled`
- shows an alert reminding the user that Actual transfer transactions must exist

Reopening:

- asks for confirmation
- persists month status `reopened`
- keeps linked payments
- does not automatically revert source Flow transaction metadata

## 13. Interaction With Source Metadata

Linking a payment transaction does not mark source transactions settled.

Closing the month marks the source Flow metadata rows as `settled` using the existing TASK008-safe metadata path. This updates Flow metadata only. It does not mutate Actual transaction core fields.

Reopening does not revert source metadata automatically.

## 14. Commands Run

- `node scripts/flow/check-flow-layout.mjs`
- `node .yarn/releases/yarn-4.13.0.cjs flow:check-layout`
- `node .yarn/releases/yarn-4.13.0.cjs typecheck`
- `node .yarn/releases/yarn-4.13.0.cjs workspace @actual-app/web build`
- `node .yarn/releases/yarn-4.13.0.cjs oxfmt --write ...`
- `node .yarn/releases/yarn-4.13.0.cjs oxlint ...`
- `git diff --check`
- attempted `node .yarn/releases/yarn-4.13.0.cjs start:browser`

## 15. Command Results

- Flow layout script: passed.
- Yarn Flow layout script: passed.
- Full typecheck: passed.
- Targeted `oxfmt`: completed.
- Targeted `oxlint`: passed after fixing hook dependency and translation findings.
- Web build: passed. Vite reported existing chunk-size and browser externalization warnings.
- `git diff --check`: passed.
- Browser dev start attempt: timed out before readiness output; watcher processes were stopped afterward.

## 16. Browser Smoke Test

Full interactive browser smoke test was not completed. I attempted to start the browser dev stack with `start:browser`, but it timed out before producing a usable readiness signal in the tool session.

What was verified instead:

- TypeScript and web build both passed.
- The settlement route compiles with the new API imports and UI.
- The dev watcher processes from the timed-out attempt were cleaned up.

Manual follow-up should verify:

1. save a settlement snapshot
2. link a real Actual transaction
3. confirm match/mismatch text
4. close the month
5. reload and confirm closed state and linked transaction persist
6. reopen, unlink, and confirm editing is re-enabled

## 17. What Worked

- Existing `flow_settlements.payment_transaction_id` could be reused for summary display.
- Adding a separate payment-link table made unlink/relink safer.
- The existing TASK008 settlement calculation already produces simplified net payments, so payment linking works at the summary level.
- Existing Flow transaction metadata save APIs were enough for close-time source metadata updates.

## 18. What Did Not Work

- The interactive browser smoke test could not be completed in the tool session because `start:browser` timed out before readiness output.
- Partial payment support was intentionally not implemented.

## 19. Risks / Concerns

- The payment selector is intentionally broad in v1 and may show many transactions in busy months.
- Direction inference is not implemented beyond amount and month checks.
- Reopening does not revert source metadata marked `settled`; this is deliberate, but users need to understand it.
- Closing with mismatches is allowed after confirmation, so the warning copy matters.

## 20. Items To Finish Later

- Partial/multiple payments per settlement summary.
- Stronger direction inference once account ownership is modeled.
- Better candidate filtering using account ownership and transfer metadata.
- Optional close audit/history beyond the current active link/closure rows.
- Full Playwright coverage for link, close, reload, reopen, and unlink.

## 21. Recommended Next Task

TASK010 — Debt Metadata Page.

## Follow-up Fixes

Implemented post-TASK009 UI fixes requested after the initial task:

- Flow metadata controls in the Transactions table now use Actual's shared `baseInputStyle` and active theme tokens.
- Unsaved/default Flow metadata for transfer transactions now defaults to personal, no split, settlement not needed, and cashflow excluded. Explicitly saved metadata is not overwritten.
- Settlement payment linking now has a separate Actual `DateSelect` month picker for finding payment transactions in a different month than the settlement month.
- Settlement payment candidates now render as a compact transaction-style table with Date, Account, Payee, Notes, Amount, Match, and Action columns.
- Payment candidate results are capped to the first 25 sorted matches to avoid flooding the card.
- The More sidebar group no longer auto-opens for active More child pages and collapses immediately after choosing a child item.
- Removed the standalone Settlement page title/header.
- Moved Save snapshot, Reload saved, Mark all settled, Close/Reopen month, and Clear saved into the Settlement details card top-right action area.
- Updated those card action buttons to use Actual's built-in active-theme button variants instead of custom hard-coded colors.

Validation for follow-up:

- Targeted `oxfmt` passed.
- Targeted `oxlint` passed.
- Full `typecheck` passed.
- `workspace @actual-app/web build` passed with existing Vite chunk/externalization warnings.
- `git diff --check` passed.
