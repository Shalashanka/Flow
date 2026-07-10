# TASK008 — Build Settlement Calculator and Settlement Page

## Role

You are the implementation AI working inside the Flow repository.

TASK005 added database-backed Flow Settings.
TASK006 added durable Flow transaction metadata storage and API.
TASK007 added Flow metadata columns and editing to the Transactions page.

TASK008 builds the first Settlement feature.

This feature calculates shared household expenses using Actual transactions plus Flow transaction metadata, then shows who owes whom for a selected month.

This task must not implement Quick Entry yet.
This task must not implement Monthly Cashflow Planner yet.
This task must not implement Scenario Builder yet.

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
AGENT_INSTRUCTIONS/CODEX/reports/TASK008_RESULT.md
```

Do not create reports outside:

```text
AGENT_INSTRUCTIONS/CODEX/reports/
```

---

# 2. Goal

Create a Flow Settlement page that answers:

```text
For this month, who owes whom, and how much?
```

The page should use:

* Actual transactions as the financial source of truth
* Flow transaction metadata for paid-by/shared/split/settlement meaning
* Flow Settings household members for person names
* Flow-owned settlement tables for saved/closed settlement results

Example:

```text
Transaction:
- Lidl
- €80 expense
- paid by Alba
- shared
- equal split

Result:
- Alba paid €80
- Griseld owes Alba €40
```

The page should aggregate all shared expenses for the month and calculate a net settlement.

---

# 3. Product principle

Actual remains the source of truth for real money movement.

Flow only adds household interpretation:

```text
Actual:
- transaction date
- amount
- account
- payee
- category

Flow:
- paid by
- shared/personal
- split method
- settlement status
- settlement month
- owed calculation
```

Do not duplicate Actual’s transaction system.

---

# 4. Non-negotiable constraints

Do not modify Actual core budget calculations.

Do not modify Actual transaction schema.

Do not modify Actual account/category/payee schemas.

Do not change Actual import behavior.

Do not change bank sync behavior.

Do not change CRDT/sync logic blindly.

Do not implement Quick Entry in this task.

Do not implement Monthly Cashflow Planner in this task.

Do not implement Scenario Builder in this task.

Do not create settlement payment transactions automatically.

Do not mark Actual transactions as reconciled/cleared/changed.

Do not edit Actual transaction notes/categories/payees/amounts.

Do not silently create metadata for transactions.

---

# 5. Route and navigation

Use the existing Flow route if already present:

```text
/settlement
```

If the route exists as a placeholder, replace the placeholder with the real Settlement page.

Navigation label:

```text
Settlement
```

Keep it under the existing Flow/More navigation structure unless already placed elsewhere.

---

# 6. Settlement data model

TASK006 already created transaction metadata. TASK008 needs durable settlement records.

Add Flow-owned tables if they do not already exist.

Recommended migration:

```sql
CREATE TABLE IF NOT EXISTS flow_settlements (
  id TEXT PRIMARY KEY,
  month TEXT,
  from_member_id TEXT,
  to_member_id TEXT,
  amount INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  payment_transaction_id TEXT,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS flow_settlement_items (
  id TEXT PRIMARY KEY,
  settlement_id TEXT,
  actual_transaction_id TEXT,
  owed_by_member_id TEXT,
  owed_to_member_id TEXT,
  amount INTEGER DEFAULT 0,
  source_amount INTEGER DEFAULT 0,
  split_method TEXT,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
```

Use nullable/defaulted non-ID columns where necessary, following the sync/column-message findings from TASK005 and TASK006.

Do not add strict `NOT NULL` columns if they conflict with Actual’s column-message insert path.

---

# 7. Required TypeScript models

Create Flow-isolated settlement models.

Suggested location:

```text
packages/desktop-client/src/flow/settlement/
```

or shared if server/client sharing is needed:

```text
packages/loot-core/src/shared/flow-settlement.ts
```

Required concepts:

```ts
export type FlowSettlementStatus =
  | 'open'
  | 'paid'
  | 'closed'
  | 'adjusted'
  | 'ignored';

export type FlowSettlementItem = {
  id: string;
  actualTransactionId: string;
  owedByMemberId: string;
  owedToMemberId: string;
  amount: number;
  sourceAmount: number;
  splitMethod: string;
  notes?: string;
};

export type FlowSettlementSummary = {
  month: string;
  fromMemberId: string;
  toMemberId: string;
  amount: number;
  itemCount: number;
  status: FlowSettlementStatus;
};

export type FlowSettlementCalculation = {
  month: string;
  generatedAt: string;
  members: Array<{
    id: string;
    name: string;
  }>;
  items: FlowSettlementItem[];
  summaries: FlowSettlementSummary[];
  warnings: string[];
};
```

Use integer money values consistent with Actual.

Do not use JS floating point for money math.

---

# 8. Backend handlers

Add typed backend handlers for saved settlement records.

Suggested handlers:

```text
flow/settlements-get
flow/settlements-save
flow/settlements-delete
flow/settlement-items-get
```

Possible behavior:

## flow/settlements-get

Input:

```ts
{
  month: string;
}
```

Output:

```ts
{
  settlements: FlowSettlementSummary[];
  items: FlowSettlementItem[];
}
```

Reads saved settlement records for a month.

## flow/settlements-save

Input:

```ts
{
  month: string;
  settlements: FlowSettlementSummary[];
  items: FlowSettlementItem[];
}
```

Behavior:

* soft-delete or tombstone old settlement rows for that month
* save current calculated settlement summaries
* save current settlement items
* use sync-safe DB insert/update path

Output:

```ts
{
  saved: boolean;
}
```

## flow/settlements-delete

Input:

```ts
{
  month: string;
}
```

Behavior:

* tombstone settlement summaries/items for that month
* do not touch Actual transactions
* do not touch Flow transaction metadata

Output:

```ts
{
  deleted: boolean;
}
```

Keep the backend simple.

Do not calculate settlement in the backend unless that fits the existing repo better. It is acceptable for the first version to calculate in the frontend using Actual transactions + Flow metadata, then save the result.

---

# 9. Frontend page behavior

Create a Settlement page.

Suggested file:

```text
packages/desktop-client/src/flow/SettlementPage.tsx
```

Helper files:

```text
packages/desktop-client/src/flow/settlement/calculate.ts
packages/desktop-client/src/flow/settlement/storage.ts
packages/desktop-client/src/flow/settlement/types.ts
```

The page should show:

## Header

```text
Settlement
```

Subtitle:

```text
Calculate who owes whom from shared transactions and Flow metadata.
```

## Controls

* month selector
* calculate/recalculate button
* save settlement snapshot button
* clear saved settlement button
* optional reload saved button

## Summary cards

Show:

* selected month
* number of shared transactions found
* total shared expenses
* number of settlement items
* net amount owed
* status/warnings

## Net settlement result

Example:

```text
Griseld owes Alba €123.45
```

If there are multiple members, show multiple net rows.

If no one owes anything:

```text
No settlement needed for this month.
```

## Transaction/item table

Show settlement item details:

* date
* payee
* amount
* paid by
* owed by
* owed to
* owed amount
* split method
* settlement status
* source transaction

The source transaction display can be simple text for now.

---

# 10. Settlement calculation rules

Use Actual transactions for the selected month.

Use Flow metadata from TASK006/TASK007.

Include a transaction only if:

* it belongs to selected month
* it has Flow metadata or defaults that mark it as shared
* `sharedStatus = 'shared'`
* `settlementStatus` is not `ignored`, `settled`, or `reimbursed`
* `paidByMemberId` exists
* amount is an expense/outflow

Exclude:

* income/inflows for v1
* transfers if identifiable
* deleted/tombstoned transactions
* ignored metadata
* personal transactions
* already settled/reimbursed/ignored settlement statuses

If the app’s amount convention is negative for expenses, use absolute value for the expense amount.

Document the actual convention used.

---

# 11. Split method rules

Implement at least:

## Equal split

If `splitMethod = 'equal'`:

* participants are active household members
* if splitData participants exist, use those participants
* otherwise use all active household members
* each participant owes equal share
* the payer does not owe themselves
* each non-payer participant owes payer their share

Example:

```text
Alba paid €80.
Participants: Alba + Griseld.
Each share: €40.
Griseld owes Alba €40.
```

## None / personal

If `splitMethod = 'none'` or `sharedStatus != 'shared'`:

* no settlement item

## Custom / percentage / fixed amount

For TASK008, handle safely:

* if splitData contains valid participants and percentages/fixed amounts, use them
* otherwise skip the transaction and add a warning

Minimum acceptable behavior:

* support equal split fully
* warn for unsupported custom split data
* do not crash

---

# 12. Netting logic

The page should net bidirectional obligations.

Example:

```text
Transaction A:
Griseld owes Alba €40

Transaction B:
Alba owes Griseld €15

Net:
Griseld owes Alba €25
```

For more than two members, calculate pairwise net results.

Do not overcomplicate group settlement optimization in v1. Pairwise netting is enough.

---

# 13. Saved settlement snapshot

The page should allow saving the current calculated result.

Purpose:

* monthly settlement close
* historical settlement review
* later settlement payment linking

Save should persist:

* settlement summary rows
* settlement item rows
* selected month
* timestamps

Do not create payment transactions automatically.

Do not mark metadata rows as settled automatically in TASK008 unless explicitly simple and safe.

Preferred:

* save snapshot only
* status remains open

Settlement payment linking can come later.

---

# 14. Warnings

Show warnings for transactions that look relevant but cannot be calculated.

Examples:

* shared transaction missing paid-by member
* shared transaction with unsupported split data
* shared transaction with no active household members
* amount is zero
* no household members configured
* Flow settings could not load
* metadata could not load

Warnings should not crash the page.

---

# 15. Performance

Use batch metadata loading.

Do not call metadata get once per transaction if avoidable.

Use the same TASK006 batch API:

```ts
getFlowTransactionMetadataMany(transactionIds)
```

The selected month normally has manageable transaction volume, but still batch.

---

# 16. Integration with Flow Settings

Use household members from Flow Settings.

If there are no active household members:

* show a helpful message
* do not calculate settlement
* instruct user to configure Flow Settings first

If member IDs in metadata no longer exist:

* show warning
* skip or display as “Unknown member”
* do not crash

---

# 17. Import/export

Do not build full settlement export/import UI in this task.

Saved settlement DB rows are enough.

JSON export can be added later if needed.

---

# 18. Browser smoke test

Use demo or test budget.

Test at least:

1. open Flow Settings
2. ensure at least two household members exist
3. open Transactions page
4. edit two transactions:

   * transaction 1: paid by member A, shared, equal, settlement open
   * transaction 2: paid by member B, shared, equal, settlement open
5. open `/settlement`
6. select the month containing those transactions
7. calculate settlement
8. confirm both transactions appear as settlement items
9. confirm net settlement amount is correct
10. save settlement snapshot
11. reload page
12. confirm saved settlement loads or recalculates consistently
13. clear saved settlement
14. confirm Actual transaction fields are unchanged
15. confirm no FatalError/backend error

If the demo budget does not allow easy transaction editing, use any existing transactions from the demo budget and document the exact setup.

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
AGENT_INSTRUCTIONS/CODEX/reports/TASK008_RESULT.md
```

The report must include:

```markdown
# TASK008 Result — Settlement Calculator and Settlement Page

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. Database Tables Added

## 5. Settlement Models Added

## 6. Backend Handlers Added

## 7. Settlement Page Implementation

## 8. Calculation Rules Used

## 9. Split Method Support

## 10. Save / Clear Snapshot Behavior

## 11. Warnings / Edge Cases

## 12. Commands Run

## 13. Command Results

## 14. Browser Smoke Test

## 15. What Worked

## 16. What Did Not Work

## 17. Risks / Concerns

## 18. Items To Finish Later

## 19. Recommended Next Task
```

Recommended next task should likely be:

```text
TASK009 — Monthly Settlement Close and Payment Linking.
```

Unless TASK008 discovers that metadata or Transactions-page editing needs stabilization first.

---

# 21. Definition of done

TASK008 is complete only when:

* `/settlement` exists as a real page
* it can select a month
* it can calculate shared expense settlement from Actual transactions + Flow metadata
* equal split works
* unsupported split methods warn safely
* pairwise netting works
* saved settlement snapshots are DB-backed
* clear saved settlement works
* no Actual transactions are modified by settlement save/clear
* no Actual core budget calculations are modified
* validation commands are run or attempted
* smoke test is documented
* result report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK008_RESULT.md`

---

# 22. Final instruction

Be conservative.

Build the first useful Settlement page.

Do not build payment linking yet.

Do not build Quick Entry yet.

Do not build Monthly Cashflow Planner yet.

Make shared expense settlement work safely and visibly.
