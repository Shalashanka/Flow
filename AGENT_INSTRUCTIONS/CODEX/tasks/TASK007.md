# TASK007 — Add Optional Flow Metadata Columns to Transactions Page

## Role

You are the implementation AI working inside the Flow repository.

TASK005 added database-backed Flow Settings.
TASK006 added durable Flow transaction metadata storage and API.

TASK007 integrates Flow metadata into the existing Transactions page by adding optional Flow-specific columns and a small edit UI.

This task must not implement Settlement calculations yet.
This task must not implement Quick Entry yet.
This task must not implement Cashflow Forecast yet.

---

# 1. Repository and reporting rules

Repository root:

```text id="ckmyzd"
C:\dev\Flow
```

Task/report system:

```text id="4vfd0m"
AGENT_INSTRUCTIONS/CODEX/
  tasks/
  reports/
  notes/
```

You must create the result report:

```text id="wf25ai"
AGENT_INSTRUCTIONS/CODEX/reports/TASK007_RESULT.md
```

Do not create reports outside:

```text id="9hco3i"
AGENT_INSTRUCTIONS/CODEX/reports/
```

---

# 2. Goal

Show and edit Flow transaction metadata directly from the Transactions page.

Flow metadata should appear as extra optional columns next to Actual’s normal transaction data.

Actual remains the source of truth for:

* date
* account
* payee
* category
* notes
* amount
* transfer status
* cleared/reconciled state

Flow adds extra household/decision metadata:

* Paid by
* Entered by
* Shared / Personal / Ignored
* Split method
* Settlement status
* Cashflow included
* Flow notes

This makes the Transactions page ready for future:

* shared expense settlement
* reimbursement handling
* cashflow inclusion/exclusion
* system check
* monthly settlement close
* mobile Quick Entry metadata review

---

# 3. Non-negotiable constraints

Do not modify Actual core transaction schema.

Do not modify Actual budget calculations.

Do not modify Actual import behavior.

Do not modify bank sync behavior.

Do not change CRDT/sync logic.

Do not implement Settlement calculation in this task.

Do not implement Quick Entry in this task.

Do not implement Cashflow Forecast in this task.

Do not implement Scenario Builder in this task.

Do not create Flow metadata rows just because transactions are displayed.

Only save Flow metadata when the user explicitly edits/saves metadata.

Do not store Flow transaction metadata in localStorage.

---

# 4. Existing foundation to use

TASK006 created:

```text id="vps8be"
packages/desktop-client/src/flow/transaction-metadata/storage.ts
```

with functions similar to:

```ts id="c4ljsb"
getFlowTransactionMetadata(...)
getFlowTransactionMetadataMany(...)
saveFlowTransactionMetadata(...)
deleteFlowTransactionMetadata(...)
```

TASK006 also added backend handlers:

```text id="dq54qg"
flow/transaction-metadata-get
flow/transaction-metadata-get-many
flow/transaction-metadata-save
flow/transaction-metadata-delete
```

Use these. Do not duplicate metadata persistence logic.

TASK005 added DB-backed Flow Settings. Use Flow Settings household members and transaction rules where needed.

---

# 5. Page integration

Find the existing Actual Transactions page/table implementation.

Add Flow columns in a Flow-isolated way.

Prefer small Flow-specific components/helpers instead of deeply rewriting Actual core components.

Suggested possible files:

```text id="jfa2xl"
packages/desktop-client/src/flow/transaction-metadata/FlowTransactionColumns.tsx
packages/desktop-client/src/flow/transaction-metadata/FlowTransactionMetadataEditor.tsx
packages/desktop-client/src/flow/transaction-metadata/useFlowTransactionMetadata.ts
```

Adapt to existing repo patterns.

---

# 6. Required visible columns

Add optional Flow columns to the Transactions page.

Minimum columns:

```text id="6g6x85"
Paid by
Shared?
Split
Settlement
Cashflow
Flow notes
```

Optional if easy:

```text id="jurhqv"
Entered by
```

Column behavior:

## Paid by

Display the household member name from Flow Settings.

If no explicit metadata row exists, show default value subtly, for example:

```text id="dz57a9"
Default: Griseld
```

or simply show the name with muted styling.

Do not save default value unless the user edits/saves.

## Shared?

Display one of:

```text id="72a8zi"
Personal
Shared
Ignored
```

## Split

Display one of:

```text id="jd8o6u"
None
Equal
Percentage
Fixed amount
Custom
```

## Settlement

Display one of:

```text id="ee8nvl"
Not needed
Open
Settled
Reimbursed
Ignored
```

Do not calculate settlement amounts yet.

## Cashflow

Display:

```text id="t4wg0w"
Included
Excluded
```

This will later feed Monthly Cashflow Planner.

## Flow notes

Display a short preview.

If notes are long, truncate.

---

# 7. Editing behavior

Add a small edit action for Flow metadata.

Acceptable UI patterns:

1. small button/icon in one Flow column
2. clickable metadata cell opening popover/modal
3. right-side drawer if existing app has one

Preferred simple version:

```text id="x00q54"
Edit Flow
```

opens a compact modal/popover with fields:

* Paid by
* Entered by
* Shared status
* Split method
* Settlement status
* Settlement month
* Cashflow included
* Flow notes
* Save
* Clear Flow metadata
* Cancel

Use household members from Flow Settings for member dropdowns.

If there are no household members, show a friendly message and allow editing non-member fields.

---

# 8. Save behavior

When user clicks Save:

* normalize metadata
* call `saveFlowTransactionMetadata`
* refresh that transaction’s metadata in the table
* do not modify Actual transaction row
* do not modify Actual notes/category/payee/account/amount

When user clicks Clear Flow metadata:

* call `deleteFlowTransactionMetadata`
* table should return to computed defaults
* no Actual transaction row should change

If save/delete fails:

* show a local error message
* do not crash the page

---

# 9. Defaults behavior

Transactions without explicit Flow metadata must still display useful defaults.

Use TASK006 behavior:

* `exists: false` means no DB row exists
* default metadata comes from Flow Settings transaction rules
* safe defaults if Flow Settings unavailable

Important:

Do not create DB rows when defaults are displayed.

Only explicit user edits create rows.

---

# 10. Performance requirements

The Transactions page can show many rows.

Do not call `getFlowTransactionMetadata` once per row if avoidable.

Use batch loading:

```ts id="q1x5fi"
getFlowTransactionMetadataMany(transactionIds)
```

for visible/loaded transaction IDs.

If the page virtualizes rows or paginates, load metadata for the visible/current transaction list.

If the first implementation cannot perfectly detect visible rows, batch load the transaction IDs available to the table data model, but document limitations.

If the list can be very large, add simple batching, for example chunks of 250 or 500 IDs.

---

# 11. Column visibility

If Actual has an existing column visibility system, integrate Flow columns into it.

If not easy, show the Flow columns by default for now, but keep the implementation isolated so visibility can be added later.

Preferred:

* Flow columns can be hidden/shown.
* Default visibility can be true in the private fork.

Do not block the task if column visibility integration is too complex. Document it.

---

# 12. Styling

Use existing Actual/Flow table styles.

Flow metadata columns should look native, not like a separate pasted-on table.

Use muted text for default/non-explicit values if easy.

Use simple badges/pills only if consistent with existing UI.

Do not introduce a new design system.

---

# 13. System Check preparation

Do not build System Check yet.

But make sure the metadata model can later support checks like:

* shared transaction missing paid by
* shared transaction missing split method
* open settlement older than one month
* cashflow excluded transactions
* ignored transactions

No extra work required beyond keeping metadata clean and typed.

---

# 14. Testing requirements

Smoke test with a demo/test budget.

Test:

1. open Transactions page
2. confirm normal Actual columns still work
3. confirm Flow columns render
4. pick one transaction
5. open Flow metadata editor
6. set:

   * paid by household member
   * shared status = shared
   * split method = equal
   * settlement status = open
   * cashflow included = true
   * Flow notes
7. save
8. confirm table row updates
9. reload page
10. confirm saved metadata persists
11. clear Flow metadata
12. confirm table row returns to defaults
13. confirm Actual transaction amount/payee/category/account/date did not change
14. confirm no FatalError/backend error

If there are no existing transactions in a fresh budget, use demo budget or create a test transaction through existing Actual UI.

---

# 15. Validation commands

Run:

```bash id="nn4c55"
node scripts/flow/check-flow-layout.mjs
```

If feasible:

```bash id="f2v1oo"
node .yarn/releases/yarn-4.13.0.cjs flow:check-layout
node .yarn/releases/yarn-4.13.0.cjs typecheck
node .yarn/releases/yarn-4.13.0.cjs workspace @actual-app/web build
git diff --check
```

Run targeted formatting/lint checks on changed files.

If full repo lint fails because of pre-existing formatting issues, document it but do not block this task if changed files pass targeted checks.

---

# 16. Result report

Create:

```text id="qji6fu"
AGENT_INSTRUCTIONS/CODEX/reports/TASK007_RESULT.md
```

The report must include:

```markdown id="ha6v4m"
# TASK007 Result — Flow Metadata Columns in Transactions Page

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. Transactions Page Integration

## 5. Flow Columns Added

## 6. Metadata Editor Behavior

## 7. Save / Clear Behavior

## 8. Defaults and Missing Metadata Behavior

## 9. Performance / Batch Loading

## 10. Commands Run

## 11. Command Results

## 12. Browser Smoke Test

## 13. What Worked

## 14. What Did Not Work

## 15. Risks / Concerns

## 16. Items To Finish Later

## 17. Recommended Next Task
```

Recommended next task should be:

```text id="d5qiet"
TASK008 — Build Settlement Calculator and Settlement Page.
```

Unless TASK007 discovers that additional metadata plumbing is needed first.

---

# 17. Definition of done

TASK007 is complete only when:

* Transactions page shows Flow metadata columns
* Flow metadata columns read from `flow_transaction_metadata`
* missing metadata displays defaults without creating DB rows
* user can edit metadata for a transaction
* user can clear metadata for a transaction
* save/clear persists through the database API from TASK006
* metadata changes survive page reload
* Actual transaction rows are not modified
* batch metadata loading is used or limitations are documented
* no Actual budget calculations changed
* no Actual transaction schema changed
* no sync/CRDT behavior changed
* result report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK007_RESULT.md`

---

# 18. Final instruction

Be conservative.

This task makes Flow metadata visible and editable in Transactions.

Do not build settlement logic yet.

Do not build quick entry yet.

Do not build cashflow yet.

Make the Transactions page Flow-aware, but keep Actual core clean.
