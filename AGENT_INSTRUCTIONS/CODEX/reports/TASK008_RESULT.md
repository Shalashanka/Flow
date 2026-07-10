# TASK008 Result — Settlement Calculator and Settlement Page

## 1. Summary

Implemented the first real Flow Settlement feature at `/settlement`.

The page calculates monthly shared expense settlement using Actual transactions, Flow transaction metadata, and Flow Settings household members. Equal, percentage, fixed-amount, and custom splits are supported, obligations are globally netted into the fewest practical transfer instructions, and calculated results can be saved or cleared as Flow-owned settlement snapshots.

Follow-up work after user verification fixed the page appearing inert when no rows were generated, replaced manual month text entry with Actual's `DateSelect`, added the settlement money-flow matrix, added the explicit `Update transaction status to settled` action, and expanded the transaction metadata editor so percentage/fixed/custom split data can be entered from the UI.

A later UI follow-up reorganized the Settlement page so the top of the page answers the main question immediately. The page now leads with clear payment cards and per-person cards showing who pays, who receives, how much, and the counterparty. Transaction tables, matrix details, warnings, and saved snapshot information remain below as supporting detail.

Latest follow-up changes added euro prefixes to Flow settlement money values, moved settlement action buttons next to the page title, moved month selection into the top settlement details section, changed the calculated/saved status into a small gold inline text near the top instead of a separate card, collapsed money-flow/warning/item detail sections by default, added per-item settled actions, made receiver amounts light green, fixed settlement-month assignment across months, and made visible Flow transaction columns directly editable in both existing rows and the new transaction row.

The Settlement page content wrapper now explicitly overrides Actual `View`'s default `min-height: 0` with `minHeight: 'auto'`. This fixes the same layout-collapse issue previously seen on Flow Settings, where cards and headings could visually overlap even though their DOM order was correct.

The implementation does not modify Actual transaction rows, Actual transaction schema, budget calculations, import behavior, bank sync, or CRDT logic.

## 2. Files Created

- `packages/loot-core/src/shared/flow-settlement.ts`
- `packages/loot-core/migrations/1782780000000_add_flow_settlements.sql`
- `packages/desktop-client/src/flow/SettlementPage.tsx`
- `packages/desktop-client/src/flow/settlement/types.ts`
- `packages/desktop-client/src/flow/settlement/storage.ts`
- `packages/desktop-client/src/flow/settlement/calculate.ts`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK008_RESULT.md`

## 3. Files Modified

- `packages/loot-core/src/server/flow/app.ts`
- `packages/desktop-client/src/components/FinancesApp.tsx`
- `packages/desktop-client/src/components/transactions/TransactionList.tsx`
- `packages/desktop-client/src/components/transactions/TransactionsTable.tsx`
- `packages/desktop-client/src/flow/actual-adapter/index.ts`
- `packages/desktop-client/src/flow/transaction-metadata/FlowTransactionColumns.tsx`
- `packages/desktop-client/src/flow/transaction-metadata/FlowTransactionMetadataEditor.tsx`
- `packages/desktop-client/src/flow/transaction-metadata/storage.ts`
- `packages/desktop-client/package.json`

## 4. Database Tables Added

Added a Flow-owned migration for settlement snapshots:

- `flow_settlements`
- `flow_settlement_items`

The tables use nullable/defaulted non-ID columns to stay compatible with Actual's column-message insert path.

`flow_settlements` stores month-level net settlement summary rows:

- settlement id
- month
- from member
- to member
- amount
- item count
- status
- optional payment transaction id
- notes
- tombstone
- created and updated timestamps

`flow_settlement_items` stores the calculated source items behind a snapshot:

- item id
- settlement id
- month
- Actual transaction id
- owed-by member
- owed-to member
- amount
- source amount
- split method
- settlement status
- notes
- tombstone
- created and updated timestamps

The `month` column on item rows was added intentionally so saved items can be fetched and cleared by month without relying only on summary joins.

## 5. Settlement Models Added

Added shared settlement models in `packages/loot-core/src/shared/flow-settlement.ts`:

- `FlowSettlementStatus`
- `FlowSettlementItem`
- `FlowSettlementSummary`
- `FlowSettlementCalculation`
- `FlowSettlementSnapshot`
- `isFlowSettlementStatus`

The status model supports:

- `open`
- `paid`
- `closed`
- `adjusted`
- `ignored`

Money values use integer amounts consistent with Actual.

## 6. Backend Handlers Added

Added Flow backend handlers in `packages/loot-core/src/server/flow/app.ts`:

- `flow/settlements-get`
- `flow/settlements-save`
- `flow/settlements-delete`
- `flow/settlement-items-get`
- `flow/transaction-metadata-get-by-settlement-month`

Behavior:

- `flow/settlements-get` returns non-tombstoned summary and item rows for a month.
- `flow/settlements-save` tombstones old rows for the month and saves the current calculated snapshot through the sync-safe DB path.
- `flow/settlements-delete` tombstones settlement summary and item rows for the selected month.
- `flow/settlement-items-get` returns saved item rows for the selected month.
- `flow/transaction-metadata-get-by-settlement-month` returns saved Flow transaction metadata rows explicitly assigned to the requested settlement month.

The save/delete handlers do not touch Actual transactions or Flow transaction metadata.

## 7. Settlement Page Implementation

Added `packages/desktop-client/src/flow/SettlementPage.tsx` and wired it into `FinancesApp`.

The page includes:

- month selection through Actual's `DateSelect` date picker
- calculate/recalculate button
- save settlement snapshot button
- reload saved button
- update transaction status to settled button
- clear saved settlement button
- summary cards
- top payment instruction cards
- per-person pays/receives breakdown cards
- saved snapshot status panel
- globally simplified net settlement result cards
- collapsed settlement money-flow matrix showing positive/negative member movement
- collapsed warning panel
- collapsed transaction/item detail table
- per-item `Mark settled` buttons

The table shows:

- date
- payee
- amount
- paid by
- owed by
- owed to
- owed amount
- split method
- settlement status
- source transaction id
- action

The route uses the existing `/settlement` navigation entry under the current More structure.

## 8. Calculation Rules Used

The calculator lives in `packages/desktop-client/src/flow/settlement/calculate.ts`.

Rules:

- Load Flow Settings household members.
- Load Actual transactions for the selected calendar month.
- Load saved Flow transaction metadata rows explicitly assigned to the selected settlement month.
- Also load Actual transactions for those explicitly assigned metadata rows, even when the transaction date is in a different month.
- Batch-load Flow transaction metadata with `getFlowTransactionMetadataMany`.
- Include transactions in the selected settlement month by `metadata.settlementMonth` when set, otherwise by the transaction's actual calendar month.
- Include only shared expense transactions.
- Exclude income/inflows for v1.
- Exclude personal, ignored, settled, and reimbursed transactions.
- Require a valid paid-by member.
- Require at least two active household participants for equal split.
- Use Actual's amount convention: expenses are negative, income is positive.
- Use `Math.abs(transaction.amount)` for expense source amounts.
- Use integer division and distribute cent remainders deterministically.
- Percentage splits use integer basis points and deterministic remainder distribution.
- Fixed-amount splits use integer Actual money amounts.
- Custom splits can combine fixed participant amounts with percentage distribution of the remaining amount.
- Do not create metadata silently for transactions.
- Calculate final transfer instructions from member net balances, not only pairwise pairs, so multi-person settlement uses fewer payments.

## 9. Split Method Support

Implemented:

- `equal`: fully supported.
- `percentage`: fully supported when included participant percentages total 100%.
- `fixed-amount`: fully supported when participant fixed amounts are non-negative and do not exceed the transaction amount.
- `custom`: fully supported for fixed amounts, percentages, or both. Percentages distribute the amount left after fixed amounts.
- `none`: skipped.
- `sharedStatus != 'shared'`: skipped.

Safe warnings:

- percentage totals that do not equal 100%
- fixed amounts greater than the transaction amount
- missing participant split data
- unknown split methods

The Flow transaction metadata editor now exposes participant rows for percentage, fixed-amount, and custom split data.

## 10. Save / Clear Snapshot Behavior

Saving a snapshot:

- persists current settlement summary rows
- persists current settlement item rows
- keeps status as `open`
- replaces the previous saved snapshot for the same month by tombstoning old rows
- does not create settlement payment transactions
- does not mark source transactions as settled
- does not edit Actual transaction notes/categories/payees/amounts

Updating transaction status to settled:

- saves the current settlement snapshot with summary status `closed`
- updates the source Flow transaction metadata rows to `settlementStatus: 'settled'`
- writes the selected settlement month into each source metadata row
- shows an alert reminding the user to create the real transfer transactions in Actual
- does not create payment transactions automatically
- does not edit Actual transaction notes/categories/payees/amounts

Per-item settling:

- updates the source Flow transaction metadata row to `settlementStatus: 'settled'`
- writes the selected settlement month into the source metadata row
- updates matching settlement item rows in the saved snapshot
- shows an alert reminding the user to create the real transfer transaction in Actual
- does not create payment transactions automatically
- does not edit Actual transaction notes/categories/payees/amounts

Clearing a snapshot:

- tombstones saved settlement rows for the selected month
- leaves Actual transactions unchanged
- leaves Flow transaction metadata unchanged

## 11. Warnings / Edge Cases

Warnings are shown for:

- no active household members
- missing paid-by member
- inactive or unknown paid-by member
- shared inflows
- zero amount transactions
- invalid or missing equal split participants
- invalid percentage split totals
- invalid fixed/custom amounts
- missing split data for percentage/fixed/custom
- unknown settlement status values
- no open shared expense transactions found

The page keeps rendering when warnings occur.

## 12. Commands Run

```bash
node .yarn\releases\yarn-4.13.0.cjs workspace @actual-app/web run typecheck
node .yarn\releases\yarn-4.13.0.cjs workspace @actual-app/core run typecheck
node .yarn\releases\yarn-4.13.0.cjs exec oxlint --type-aware --quiet packages/loot-core/src/shared/flow-settlement.ts packages/loot-core/src/server/flow/app.ts packages/desktop-client/src/flow/SettlementPage.tsx packages/desktop-client/src/flow/settlement/calculate.ts packages/desktop-client/src/flow/settlement/storage.ts packages/desktop-client/src/flow/settlement/types.ts packages/desktop-client/src/components/FinancesApp.tsx packages/desktop-client/package.json
node scripts/flow/check-flow-layout.mjs
node .yarn\releases\yarn-4.13.0.cjs flow:check-layout
git diff --check
node .yarn\releases\yarn-4.13.0.cjs workspace @actual-app/web build
node .yarn\releases\yarn-4.13.0.cjs typecheck
node .yarn\releases\yarn-4.13.0.cjs exec oxlint --type-aware --quiet packages/desktop-client/src/flow/SettlementPage.tsx packages/desktop-client/src/flow/settlement/calculate.ts packages/desktop-client/src/flow/settlement/storage.ts packages/desktop-client/src/flow/transaction-metadata/FlowTransactionMetadataEditor.tsx packages/loot-core/src/server/flow/app.ts packages/loot-core/src/shared/flow-settlement.ts
yarn typecheck
yarn exec oxfmt --check packages/desktop-client/src/components/transactions/TransactionList.tsx packages/desktop-client/src/components/transactions/TransactionsTable.tsx packages/desktop-client/src/flow/SettlementPage.tsx packages/desktop-client/src/flow/actual-adapter/index.ts packages/desktop-client/src/flow/settlement/calculate.ts packages/desktop-client/src/flow/transaction-metadata/FlowTransactionColumns.tsx packages/desktop-client/src/flow/transaction-metadata/storage.ts packages/loot-core/src/server/flow/app.ts
yarn exec oxlint packages/desktop-client/src/components/transactions/TransactionList.tsx packages/desktop-client/src/components/transactions/TransactionsTable.tsx packages/desktop-client/src/flow/SettlementPage.tsx packages/desktop-client/src/flow/actual-adapter/index.ts packages/desktop-client/src/flow/settlement/calculate.ts packages/desktop-client/src/flow/transaction-metadata/FlowTransactionColumns.tsx packages/desktop-client/src/flow/transaction-metadata/storage.ts packages/loot-core/src/server/flow/app.ts
yarn workspace @actual-app/web build
git diff --check
```

Also ran a browser smoke test against the local dev server at `http://localhost:3001`.

## 13. Command Results

Passed:

- web workspace typecheck
- core workspace typecheck
- targeted type-aware oxlint on changed files
- `node scripts/flow/check-flow-layout.mjs`
- `yarn flow:check-layout`
- `git diff --check`
- web production build
- full root `yarn typecheck`
- focused formatter check on the latest touched files
- focused oxlint on the latest touched files

Notes:

- `git diff --check` passed, with a line-ending warning for `packages/desktop-client/package.json`.
- Full `yarn lint` is still blocked by repository-wide pre-existing formatting drift outside this task. Focused formatting and oxlint checks passed for the files changed by this follow-up.
- The web build completed with existing-style Vite warnings about browser externalization for `vm`, large chunks, and plugin timing.

## 14. Browser Smoke Test

Smoke test setup:

- Started the app at `http://localhost:3001`.
- Created a fresh demo budget through the normal no-server demo flow.
- Configured two active Flow Settings household members:
  - `member-person-1`: Person 1
  - `member-person-2`: Person 2
- Selected four real July 2026 demo expense transactions.
- Applied Flow metadata for all supported split methods:
  - transaction A: equal, paid by Person 1
  - transaction B: percentage, paid by Person 2
  - transaction C: fixed amount, paid by Person 1
  - transaction D: custom, paid by Person 2
- Opened `/settlement`.
- Confirmed all four source transaction ids appeared in the settlement item table.
- Confirmed the settlement money-flow matrix rendered.
- Pressed `Update transaction status to settled`.
- Confirmed all four source Flow metadata records changed to `settled`.
- Confirmed the alert reminded the user to create transfer transactions in Actual.
- Ran a visual UI smoke check after the final redesign and verified the top section shows payment cards first, with details below and no browser errors.
- Ran a follow-up browser layout check after the `minHeight: 'auto'` override and confirmed the top answer section, details cards, money-flow table, and item table stack without overlap.

Smoke test result:

```text
Month: 2026-07
Settlement items generated: 4
Settlement summaries generated: 1
Split methods verified: equal, percentage, fixed-amount, custom
Money-flow matrix visible: true
Statuses after update: settled, settled, settled, settled
Settlement month written to metadata: 2026-07
Alert shown: Settlement statuses were updated to settled. Remember to create the transfer transactions in Actual so the real money movement is recorded.
Browser errors: none
FatalError/backend init failure: none
```

The smoke setup used Flow storage APIs for deterministic test setup. This avoided depending on manual transaction editor interactions while still testing the settlement calculation, save, reload, clear, and no-Actual-mutation requirements.

## 15. What Worked

- `/settlement` now renders as a real page.
- The top of the page clearly shows who owes whom before secondary details.
- Per-person cards show whether each person pays, receives, or is balanced.
- Month selection uses Actual's date picker and recalculation works.
- Equal, percentage, fixed-amount, and custom splits produce correct item rows.
- Multi-person obligations are globally simplified into fewer transfer instructions.
- The settlement matrix clearly shows positive/negative money movement per member.
- Settlement money, item, and card values now show `€` prefixes.
- Receiver card amounts use light green text.
- The "Settlement calculated" status is now a gold inline text near the top of the page instead of its own panel.
- Detail-heavy sections are collapsed by default.
- Saved settlement snapshots persist to Flow-owned DB tables.
- Clear snapshot removes saved settlement rows for the month.
- Source Flow metadata rows can be marked settled after settlement.
- Individual settlement item source transactions can be marked settled from the item table.
- A transaction assigned to a different settlement month is calculated in that assigned month, not in the original transaction month.
- Visible Flow transaction columns can be edited directly in existing transaction rows and in the new transaction row.
- New transaction Flow metadata is held locally while the row is temporary and saved to Flow metadata only after Actual creates the real transaction id.
- The settled action reminds the user to create transfer transactions.
- Actual transaction fields stay unchanged during settlement save/clear/status update.
- Validation and browser smoke testing completed successfully.

## 16. What Did Not Work

- Directly loading `/settlement` in a brand-new browser context without first completing the no-server/demo setup redirects to `/config-server`. This is existing app bootstrapping behavior; in-app navigation to Settlement works after a budget is loaded.
- Saved item rows persist source ids and calculated member/amount data, but not all display-only transaction details such as payee/category names. Recalculation provides the full display context.

## 17. Risks / Concerns

- Payment transactions are still not created automatically. The UI now warns the user to create them manually after marking metadata settled.
- Saved snapshot rows are month-based. If member names change after saving, the page displays current member names for those ids.
- Percentage split validation requires totals to equal 100%. Invalid totals warn and skip rather than guessing.
- Fixed/custom amounts cannot exceed the source transaction amount.
- Direct inline Flow columns cover the visible Flow table fields. Settlement month and split participant details still use the `Edit Flow` popover because those fields are not visible transaction-table columns.

## 18. Items To Finish Later

- Add monthly close behavior.
- Add settlement payment linking.
- Add richer saved snapshot review with persisted display labels.
- Add focused automated tests for settlement calculation and storage handlers.

## 19. Recommended Next Task

TASK009 — Monthly Settlement Close and Payment Linking.
