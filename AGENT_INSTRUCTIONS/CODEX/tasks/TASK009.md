# TASK009 — Monthly Settlement Close and Payment Linking

## Role

You are the implementation AI working inside the Flow repository.

TASK005 added database-backed Flow Settings.
TASK006 added durable Flow transaction metadata storage and API.
TASK007 added Flow metadata columns and editing to the Transactions page.
TASK008 added the Settlement calculator and Settlement page.

TASK009 adds the next layer: linking real Actual payment/transfer transactions to saved Flow settlements and closing monthly settlement safely.

This task must not create bank transactions automatically.
This task must not modify Actual transaction amounts, payees, accounts, categories, dates, or notes.
This task must not implement Quick Entry, Cashflow Planner, Debts, Subscriptions, or Scenario Builder.

---

# 1. Repository and reporting rules

Repository root:

```text
C:\dev\Flow
```

Task/report system:

```text
AGENT_INSTRUCTIONS/CODEX/
  tasks/
  reports/
  notes/
```

You must create the result report:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK009_RESULT.md
```

Do not create reports outside:

```text
AGENT_INSTRUCTIONS/CODEX/reports/
```

---

# 2. Goal

Build a safe monthly settlement close workflow.

The current Settlement page can calculate:

```text
Griseld owes Alba €X
```

TASK009 should let the user:

1. see saved settlement results for a month
2. link a real Actual transaction as the payment/transfer for a settlement
3. check whether the linked payment amount matches the settlement amount
4. mark settlement rows as paid/closed
5. reopen/unlink if a mistake was made
6. see month-level settlement close status
7. avoid double-closing or accidentally settling the wrong month

Flow should become able to answer:

```text
For July 2026, settlement was calculated, Griseld owed Alba €123.45, payment transaction X was linked, and the month is closed.
```

---

# 3. Product principle

Actual remains the source of truth for real money movement.

Flow should not invent a fake payment.

The user must still create or import the real settlement transfer/payment in Actual.

Flow then links that real Actual transaction to the Flow settlement.

Correct flow:

```text
1. Flow calculates settlement.
2. User makes/records real transfer in Actual.
3. User links the Actual transaction to the Flow settlement.
4. Flow marks the settlement paid/closed.
```

Incorrect flow:

```text
Flow silently creates payment transaction.
```

Do not do that in this task.

---

# 4. Non-negotiable constraints

Do not modify Actual core budget calculations.

Do not modify Actual transaction schema.

Do not modify Actual account/category/payee schemas.

Do not change Actual import behavior.

Do not change bank sync behavior.

Do not change CRDT/sync logic blindly.

Do not automatically create Actual transactions.

Do not edit Actual transaction amount/date/payee/category/account/notes.

Do not mark Actual transactions reconciled/cleared.

Do not implement Quick Entry.

Do not implement Monthly Cashflow Planner.

Do not implement Scenario Builder.

Do not implement Debt page.

Do not implement Subscription detector.

Do not remove existing TASK008 Settlement behavior.

---

# 5. Existing foundation to use

TASK008 added:

```text
flow_settlements
flow_settlement_items
```

and backend handlers:

```text
flow/settlements-get
flow/settlements-save
flow/settlements-delete
flow/settlement-items-get
```

TASK008 also added a Settlement page:

```text
/settlement
```

Use and extend this foundation. Do not duplicate it.

TASK008 already has summary status fields and `payment_transaction_id` on settlement summary rows. Inspect the actual migration and models before deciding whether a new table is needed.

---

# 6. Required design decision

Before coding, inspect existing TASK008 settlement schema.

If existing `flow_settlements.payment_transaction_id` is enough for v1, use it.

If partial payments, multiple payment transactions, or audit history would be hard with only that field, add a Flow-owned table:

```sql
CREATE TABLE IF NOT EXISTS flow_settlement_payment_links (
  id TEXT PRIMARY KEY,
  settlement_id TEXT,
  month TEXT,
  payment_transaction_id TEXT,
  amount INTEGER DEFAULT 0,
  link_status TEXT DEFAULT 'linked',
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
```

Use nullable/defaulted non-ID columns where needed to remain compatible with Actual’s column-message insert path.

Do not add strict `NOT NULL` columns if they conflict with Actual’s sync/write path.

Preferred v1:

* one payment transaction per settlement summary is enough
* support unlink/relink
* support status changes
* document partial payments as future work

---

# 7. Month close state

Add a month-level settlement close concept.

Recommended table:

```sql
CREATE TABLE IF NOT EXISTS flow_settlement_month_closures (
  id TEXT PRIMARY KEY,
  month TEXT,
  status TEXT DEFAULT 'open',
  closed_at TEXT,
  reopened_at TEXT,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
```

Allowed statuses:

```text
open
calculated
payment-linked
closed
reopened
```

Meaning:

## open

No saved settlement or month is not ready.

## calculated

Settlement was calculated and saved.

## payment-linked

At least one settlement summary has a linked Actual payment transaction.

## closed

User confirmed the month’s settlement is done.

## reopened

Month was previously closed but user reopened it.

Do not overcomplicate v1 with permissions/users.

---

# 8. Required TypeScript models

Create or extend shared settlement models.

Suggested file:

```text
packages/loot-core/src/shared/flow-settlement.ts
```

Add concepts similar to:

```ts
export type FlowSettlementMonthStatus =
  | 'open'
  | 'calculated'
  | 'payment-linked'
  | 'closed'
  | 'reopened';

export type FlowSettlementPaymentLink = {
  id: string;
  settlementId: string;
  month: string;
  paymentTransactionId: string;
  amount: number;
  linkStatus: 'linked' | 'unlinked' | 'ignored';
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FlowSettlementMonthClosure = {
  month: string;
  status: FlowSettlementMonthStatus;
  closedAt?: string;
  reopenedAt?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};
```

Adapt names to existing style.

Use integer money values consistent with Actual.

Do not use floating point money math.

---

# 9. Backend handlers

Add typed backend handlers for settlement payment linking and monthly close.

Suggested handlers:

```text
flow/settlement-payment-link-save
flow/settlement-payment-link-delete
flow/settlement-month-close-get
flow/settlement-month-close-save
flow/settlement-month-reopen
```

Possible shapes:

## flow/settlement-payment-link-save

Input:

```ts
{
  settlementId: string;
  month: string;
  paymentTransactionId: string;
  amount: number;
  notes?: string;
}
```

Behavior:

* link an Actual transaction ID to a Flow settlement summary
* update settlement summary `payment_transaction_id`
* set summary status to `paid` or keep it `open` with payment link depending on existing model
* use sync-safe DB insert/update
* do not modify the Actual transaction

Output:

```ts
{
  saved: boolean;
}
```

## flow/settlement-payment-link-delete

Input:

```ts
{
  settlementId: string;
  month: string;
}
```

Behavior:

* remove/tombstone the payment link
* clear or ignore `payment_transaction_id` on settlement summary
* optionally return summary status to `open`
* do not modify Actual transaction

Output:

```ts
{
  deleted: boolean;
}
```

## flow/settlement-month-close-get

Input:

```ts
{
  month: string;
}
```

Output:

```ts
FlowSettlementMonthClosure | null
```

## flow/settlement-month-close-save

Input:

```ts
{
  month: string;
  status: 'closed';
  notes?: string;
}
```

Behavior:

* create/update the month close row
* set status to `closed`
* set `closed_at`
* optionally set all saved settlement summaries for that month to `closed`
* optionally update source Flow transaction metadata to `settled` if this is already implemented safely from TASK008
* do not create Actual transactions
* do not edit Actual transactions

## flow/settlement-month-reopen

Input:

```ts
{
  month: string;
  notes?: string;
}
```

Behavior:

* set month status to `reopened`
* set `reopened_at`
* optionally set saved settlement summary status back to `open` or `adjusted`
* do not erase old payment links unless user explicitly unlinks them
* do not edit Actual transactions

---

# 10. Frontend storage/API

Add or extend settlement storage layer.

Suggested file:

```text
packages/desktop-client/src/flow/settlement/storage.ts
```

Expose functions such as:

```ts
saveSettlementPaymentLink(...)
deleteSettlementPaymentLink(...)
getSettlementMonthClose(...)
closeSettlementMonth(...)
reopenSettlementMonth(...)
```

Use typed backend handlers.

Do not use localStorage.

---

# 11. Actual payment transaction selection

The user needs a way to select the real Actual transaction that represents settlement payment.

On the Settlement page, for each net settlement summary, add:

```text
Link payment transaction
```

This should open a simple selector or popover.

Minimum acceptable selector:

* list candidate Actual transactions from selected month
* show date, account, payee, notes, amount
* allow choosing one
* show search/filter if easy

Candidate filter should prioritize likely payment transactions:

* transactions in selected month
* transfers if identifiable
* amounts matching or close to settlement amount
* transactions between household accounts if account ownership is known later
* notes/payee containing member name or “settlement” if available

Do not require perfect filtering in v1.

If candidate filtering is hard, show recent transactions for the selected month and allow manual selection.

---

# 12. Payment matching logic

When a payment transaction is selected, compare its absolute amount with settlement amount.

Show one of:

## Exact match

```text
Payment amount matches settlement.
```

## Close but not exact

```text
Payment differs by €X. Check before closing.
```

## Wrong direction / suspicious

If direction can be inferred and seems wrong, show:

```text
This payment may not match the expected direction. Check before closing.
```

Direction inference may be limited. Do not overclaim.

## No amount match

```text
Selected payment does not match settlement amount.
```

Do not block linking if user confirms, but show warning.

---

# 13. Settlement page UI updates

Update `/settlement`.

Keep the current useful top answer section from TASK008.

Add:

## Month close status near top

Example:

```text
July 2026 settlement: Calculated / Payment linked / Closed / Reopened
```

## For each payment card

Show:

* who pays
* who receives
* amount
* linked payment transaction, if any
* payment match status
* button: Link payment
* button: Unlink payment
* button: Mark this settlement paid/closed if safe

## Month-level actions

Add buttons:

```text
Close settlement month
Reopen month
```

Behavior:

* Close should ask for confirmation if not all summaries have linked payments.
* Close should warn if payment amount mismatches exist.
* Reopen should ask for confirmation and preserve saved data.

Use existing UI patterns. Do not over-polish.

---

# 14. Prevent double-closing

If month status is `closed`:

* show clear closed status
* disable normal save/recalculate close actions or require explicit reopen
* do not silently overwrite closed settlement snapshot
* allow user to reopen first

If the user recalculates a closed month:

* show warning that recalculation is preview only until reopened
* do not overwrite saved closed data unless reopened

Minimum acceptable v1:

* disable save/close buttons when closed
* show Reopen button

---

# 15. Interaction with source transaction metadata

TASK008 already supports marking source Flow transaction metadata as `settled`.

For TASK009, decide carefully:

Preferred v1 behavior:

* Linking a payment transaction does not automatically mark source items settled.
* Closing the month marks source Flow metadata rows as `settled` if this was already safely implemented in TASK008.
* Reopening the month does not automatically revert source metadata unless implemented carefully.

Document exact behavior.

Do not mutate Actual transactions.

---

# 16. Settlement history

Add a small saved history/readout for the selected month.

At minimum show:

* saved snapshot exists or not
* saved summary rows
* linked payment transaction IDs
* month close status
* closed date if closed
* reopened date if reopened

Do not build a full multi-month history page yet.

---

# 17. Warnings and edge cases

Show warnings for:

* no saved settlement snapshot
* trying to close without linked payment
* payment amount mismatch
* payment transaction not found
* linked transaction outside selected month
* month already closed
* source transaction metadata changed since snapshot, if easy to detect
* missing household members
* database save failure

Warnings should not crash the page.

---

# 18. Browser smoke test

Use demo or test budget.

Test at least:

1. open Flow Settings and ensure at least two household members exist
2. mark at least two transactions as shared/open if needed
3. open `/settlement`
4. select the relevant month
5. calculate settlement
6. save settlement snapshot
7. choose/link a real Actual transaction as payment
8. verify payment match/mismatch message appears
9. close the settlement month
10. reload page
11. confirm month remains closed
12. confirm linked payment is still shown
13. confirm close status persists
14. reopen the month
15. confirm status changes to reopened/open
16. unlink payment
17. confirm settlement can be edited/saved again
18. confirm Actual transaction amount/date/payee/account/category/notes were not changed
19. confirm no FatalError/backend init failure

If demo data lacks a perfect matching payment transaction, use a mismatching transaction and document that the warning displayed.

---

# 19. Validation commands

Run:

```bash
node scripts/flow/check-flow-layout.mjs
```

If feasible:

```bash
node .yarn/releases/yarn-4.13.0.cjs flow:check-layout
node .yarn/releases/yarn-4.13.0.cjs typecheck
node .yarn/releases/yarn-4.13.0.cjs workspace @actual-app/web build
git diff --check
```

Run targeted formatting/lint checks on changed files.

If full repo lint fails because of pre-existing formatting issues, document it but do not block this task if changed files pass targeted checks.

---

# 20. Result report

Create:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK009_RESULT.md
```

The report must include:

```markdown
# TASK009 Result — Monthly Settlement Close and Payment Linking

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. Database Tables Added or Reused

## 5. Settlement Payment Link Models

## 6. Month Close Models

## 7. Backend Handlers Added

## 8. Frontend Storage/API Changes

## 9. Settlement Page UI Changes

## 10. Payment Transaction Selection

## 11. Payment Match Logic

## 12. Month Close / Reopen Behavior

## 13. Interaction With Source Metadata

## 14. Commands Run

## 15. Command Results

## 16. Browser Smoke Test

## 17. What Worked

## 18. What Did Not Work

## 19. Risks / Concerns

## 20. Items To Finish Later

## 21. Recommended Next Task
```

Recommended next task should likely be:

```text
TASK010 — Debt Metadata Page
```

unless TASK009 discovers that Settlement needs another stabilization task.

---

# 21. Definition of done

TASK009 is complete only when:

* user can link a real Actual payment transaction to a Flow settlement
* linked payment persists in DB
* payment amount match/mismatch is shown
* user can unlink payment
* month-level settlement status exists
* user can close a settlement month
* user can reopen a closed settlement month
* closed month state persists after reload
* no Actual transaction fields are modified
* no Actual transaction is automatically created
* no Actual budget calculations are changed
* no sync/CRDT logic is changed blindly
* validation commands are run or attempted
* result report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK009_RESULT.md`

---

# 22. Final instruction

Be conservative.

This task connects Flow settlement to real Actual payment transactions without creating or modifying those transactions.

Do not build Quick Entry yet.

Do not build Cashflow Planner yet.

Do not build Debt page yet.

Make settlement closing safe, explicit, and reversible.
