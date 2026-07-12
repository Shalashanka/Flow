# TASK010 — Debt Metadata Page

## Role

You are the implementation AI working inside the Flow repository.

TASK005 added database-backed Flow Settings.
TASK006 added durable Flow transaction metadata.
TASK007 added Flow metadata columns to the Transactions page.
TASK008 added Settlement calculation and snapshots.
TASK009 added Settlement payment linking and monthly close/reopen state.

TASK010 builds the first Flow Debts feature.

This task creates a Flow-owned debt metadata page that links to Actual accounts, categories, and transactions without duplicating Actual’s budgeting or transaction system.

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

Create the result report:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK010_RESULT.md
```

Do not create reports outside:

```text
AGENT_INSTRUCTIONS/CODEX/reports/
```

---

# 2. Preflight check from TASK009

Before starting new Debt work, perform a quick manual or browser smoke check if the dev server can run.

Verify at least:

1. Open `/settlement`.
2. Load or calculate a saved settlement.
3. Link a real Actual transaction as payment.
4. Confirm match/mismatch text appears.
5. Close the month.
6. Reload and confirm closed state persists.
7. Reopen.
8. Unlink payment.
9. Confirm editing is enabled again.

Document this in `TASK010_RESULT.md`.

If the dev server cannot run, document why and continue only if typecheck/build are healthy.

---

# 3. Goal

Create a Debts page that answers:

```text
What debts do we have, how much is left, what is planned this month, and when are we expected to be debt-free?
```

The page should use Actual as the source of truth for real money movement, while Flow stores extra debt metadata.

Actual should still handle:

* real debt accounts if the debt is tracked as an account
* payment transactions
* categories
* schedules
* budget templates/goals where used

Flow should store:

* debt name
* lender
* linked Actual account
* linked Actual category
* original amount
* manual balance override if no Actual account exists
* minimum payment
* planned payment
* due day
* interest rate
* priority
* active/closed status
* notes

---

# 4. Product principle

Flow Debts is not a second transaction engine.

Correct model:

```text
Actual transaction/account/category = financial source of truth
Flow debt metadata = planning and display layer
```

Do not create fake debt payments.

Do not alter Actual transactions.

Do not rebuild Actual’s envelope budgeting or goal-template system.

---

# 5. Non-negotiable constraints

Do not modify Actual core budget calculations.

Do not modify Actual transaction schema.

Do not modify Actual account/category/payee schemas.

Do not change Actual import behavior.

Do not change bank sync behavior.

Do not change CRDT/sync logic blindly.

Do not create Actual debt payment transactions automatically.

Do not edit Actual transaction amount/date/payee/category/account/notes.

Do not implement Cashflow Planner in this task.

Do not implement Subscription Detector in this task.

Do not implement Scenario Builder in this task.

Do not implement FI/Runway in this task.

Do not store Debt data in localStorage.

---

# 6. Route and navigation

Use the existing route if already present:

```text
/debts
```

If `/debts` currently renders a placeholder, replace it with the real Debts page.

Navigation label:

```text
Debts
```

Keep it under the existing Flow/More navigation structure unless it is already elsewhere.

---

# 7. Database table

Add a Flow-owned migration for debt metadata.

Recommended table:

```sql
CREATE TABLE IF NOT EXISTS flow_debts (
  id TEXT PRIMARY KEY,
  name TEXT,
  lender TEXT,
  actual_account_id TEXT,
  actual_category_id TEXT,
  original_amount INTEGER DEFAULT 0,
  current_balance_override INTEGER,
  minimum_payment INTEGER DEFAULT 0,
  planned_payment INTEGER DEFAULT 0,
  due_day INTEGER,
  interest_rate_bps INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'active',
  active INTEGER DEFAULT 1,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
```

Use nullable/defaulted non-ID columns where needed to remain compatible with Actual’s column-message insert/update path.

Avoid strict `NOT NULL` columns except for `id`.

Do not add payment tables yet unless clearly necessary. V1 should use Actual transactions for payments.

---

# 8. TypeScript models

Add shared models if useful.

Suggested shared file:

```text
packages/loot-core/src/shared/flow-debt.ts
```

Suggested frontend files:

```text
packages/desktop-client/src/flow/debts/types.ts
packages/desktop-client/src/flow/debts/storage.ts
packages/desktop-client/src/flow/debts/calculate.ts
packages/desktop-client/src/flow/DebtsPage.tsx
```

Required model concepts:

```ts
export type FlowDebtPriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent';

export type FlowDebtStatus =
  | 'active'
  | 'paused'
  | 'paid-off'
  | 'closed'
  | 'ignored';

export type FlowDebt = {
  id: string;
  name: string;
  lender?: string;
  actualAccountId?: string;
  actualCategoryId?: string;
  originalAmount: number;
  currentBalanceOverride?: number;
  minimumPayment: number;
  plannedPayment: number;
  dueDay?: number;
  interestRateBps: number;
  priority: FlowDebtPriority;
  status: FlowDebtStatus;
  active: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FlowDebtComputed = {
  debt: FlowDebt;
  currentBalance: number;
  currentBalanceSource: 'actual-account' | 'manual-override' | 'original-amount' | 'unknown';
  paidThisMonth: number;
  plannedPayment: number;
  remainingAfterPlannedPayment: number;
  estimatedMonthsToPayoff?: number;
  estimatedPayoffDate?: string;
  warnings: string[];
};
```

Use integer money values consistent with Actual.

Do not use floating point money math.

For interest rate, store basis points:

```text
5.25% = 525 bps
```

---

# 9. Backend handlers

Add typed backend handlers.

Suggested handler names:

```text
flow/debts-get
flow/debt-save
flow/debt-delete
```

Optional if needed:

```text
flow/debts-get-one
```

Behavior:

## flow/debts-get

Returns all non-tombstoned Flow debt rows.

## flow/debt-save

Upserts one debt metadata row.

Requirements:

* normalize/validate fields
* generate ID if missing
* update timestamps
* use sync-safe DB insert/update path
* do not touch Actual accounts/categories/transactions

## flow/debt-delete

Soft-delete/tombstone one Flow debt row.

Requirements:

* do not delete Actual account
* do not delete Actual category
* do not delete Actual transactions

---

# 10. Frontend storage/API

Add frontend functions:

```ts
getFlowDebts(): Promise<FlowDebt[]>;

saveFlowDebt(debt: FlowDebt): Promise<FlowDebt>;

deleteFlowDebt(id: string): Promise<{ deleted: boolean }>;
```

No localStorage fallback.

If read/write fails, show a local error on the page.

---

# 11. Actual data integration

The Debts page should read Actual accounts and categories for dropdowns.

Use existing safe hooks or adapters.

Debt row fields:

* linked Actual account
* linked Actual payment category

The page should store Actual IDs, not names.

Display names should come from current Actual account/category names.

If an account/category ID no longer exists:

* keep the stored ID
* show `Missing account` or `Missing category`
* warn, but do not crash

---

# 12. Balance calculation

For each debt:

## Current balance source priority

1. If `actualAccountId` exists and the Actual account can provide a balance, use Actual account balance.
2. Else if `currentBalanceOverride` exists, use manual override.
3. Else if `originalAmount` exists, use original amount.
4. Else unknown/zero with warning.

Document the Actual amount sign convention used.

For liability/debt accounts, if Actual stores debt as negative balance, display the owed amount as a positive debt number.

Example:

```text
Actual account balance: -3000
Displayed debt remaining: €3,000
```

## Paid this month

If `actualCategoryId` is linked:

* sum current-month Actual expenses/payments in that category
* use absolute value for outflows
* exclude transfers if identifiable
* document limitations

If no category is linked:

* show `Not linked`
* paid-this-month can be zero/unknown

## Estimated payoff

Simple v1 formula:

```text
estimatedMonthsToPayoff = currentBalance / plannedPayment
```

Use ceiling division.

If planned payment is zero:

* no payoff estimate
* warning: `No planned payment`

Do not build compound interest amortization in v1. Interest can be displayed but not deeply modeled yet.

---

# 13. Debts page UI

Create or replace `/debts`.

Page should show:

## Header

```text
Debts
```

Subtitle:

```text
Track debt metadata around Actual accounts, categories, and payments.
```

## Top summary cards

Show:

* total debt remaining
* total planned monthly payment
* total minimum monthly payment
* paid this month
* active debts count
* estimated debt-free date if calculable

## Debt list

Use compact rows/cards similar to Flow Settings.

Each debt should show:

* name
* lender
* current balance
* current balance source
* minimum payment
* planned payment
* due day
* interest rate
* priority
* status
* linked Actual account
* linked Actual category
* paid this month
* payoff estimate
* warnings

## Add/edit form

Fields:

* name
* lender
* Actual account
* Actual category
* original amount
* current balance override
* minimum payment
* planned payment
* due day
* interest rate
* priority
* status
* active
* notes

Actions:

* Add debt
* Edit
* Save
* Cancel
* Delete/archive

Prefer soft delete wording like:

```text
Archive debt
```

rather than destructive delete.

---

# 14. Warnings / system check preparation

Show warnings on the Debts page for:

* active debt with no linked Actual account and no manual balance
* active debt with no linked payment category
* planned payment below minimum payment
* planned payment zero
* current balance negative/invalid after normalization
* paid-off debt still marked active
* missing linked Actual account/category

Do not build the full System Check page yet.

But keep warning logic reusable later.

---

# 15. Cashflow preparation

Do not build Monthly Cashflow Planner yet.

But make sure the debt model can later feed cashflow:

```text
planned debt payment
minimum debt payment
due day
linked category/account
active flag
```

The future Cashflow Planner should be able to include active debt planned payments as scheduled outflows.

---

# 16. Settlement interaction

Do not integrate Debts with Settlement in this task.

But ensure no conflict with Flow transaction metadata or settlement tables.

Debt payments are normal Actual transactions. They may optionally have Flow metadata later, but not required now.

---

# 17. Import/export

Do not build full import/export UI for debts in this task.

DB persistence is enough.

Future backup/export can include:

```text
flow_debts
```

---

# 18. Browser smoke test

Use demo or test budget.

Test:

1. Open `/debts`.
2. Confirm page loads without FatalError.
3. Add a debt with:

   * name
   * lender
   * original amount
   * current balance override
   * minimum payment
   * planned payment
   * due day
   * interest rate
4. Save.
5. Reload page.
6. Confirm debt persists.
7. Edit the debt.
8. Link an Actual account if available.
9. Link an Actual category if available.
10. Confirm summary cards update.
11. Archive/delete the debt.
12. Reload and confirm archived debt is hidden or marked archived.
13. Confirm no Actual account/category/transaction was modified.

Also, if feasible, create or use a transaction in the linked category during the current month and confirm `paid this month` changes.

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
AGENT_INSTRUCTIONS/CODEX/reports/TASK010_RESULT.md
```

The report must include:

```markdown
# TASK010 Result — Debt Metadata Page

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. TASK009 Preflight Result

## 5. Database Tables Added

## 6. Debt Models Added

## 7. Backend Handlers Added

## 8. Frontend Storage/API Added

## 9. Debts Page Implementation

## 10. Actual Account/Category Integration

## 11. Balance and Paid-This-Month Calculation

## 12. Warnings / Edge Cases

## 13. Commands Run

## 14. Command Results

## 15. Browser Smoke Test

## 16. What Worked

## 17. What Did Not Work

## 18. Risks / Concerns

## 19. Items To Finish Later

## 20. Recommended Next Task
```

Recommended next task should likely be:

```text
TASK011 — Subscription Detector and Subscription Page.
```

Unless TASK010 discovers a blocking issue.

---

# 21. Definition of done

TASK010 is complete only when:

* `/debts` exists as a real page
* Flow debt metadata is DB-backed
* user can add/edit/archive debts
* debt rows can link to Actual account IDs
* debt rows can link to Actual category IDs
* current balance can be computed from linked Actual account or manual override
* paid-this-month can be computed from linked Actual category where possible
* summary cards render
* payoff estimate renders when planned payment is valid
* warnings render safely
* no Actual transaction/account/category schema is changed
* no Actual transaction/account/category data is edited by debt save/archive
* no Actual budget calculations are changed
* no localStorage is used for debts
* validation commands are run or attempted
* report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK010_RESULT.md`

---

# 22. Final instruction

Be conservative.

Build the first useful Debt metadata page.

Do not create payment transactions.

Do not duplicate Actual budgeting.

Do not build Cashflow yet.

Make debts visible, persistent, linked to Actual, and ready to feed Cashflow later.
