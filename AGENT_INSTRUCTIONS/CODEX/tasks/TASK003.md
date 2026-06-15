# TASK003 — Build Read-Only Flow Data Adapter and Cashflow Prototype

## Role

You are the implementation AI working inside the Flow repository.

TASK001 created the Flow scaffold.
TASK002 rebranded visible UI to Flow and added integrated placeholder navigation.

TASK003 is the first real Flow module task.

The planner wants a conservative, read-only prototype that proves Flow can read Actual data safely and display useful planning information without modifying Actual core logic.

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
AGENT_INSTRUCTIONS/CODEX/reports/TASK003_RESULT.md
```

Do not create reports outside `AGENT_INSTRUCTIONS/CODEX/reports`.

---

# 2. Goal of TASK003

Build the first real Flow read layer and a basic Cashflow prototype page.

This task should prove that Flow can:

1. read accounts from Actual
2. read transactions from Actual
3. calculate a simple current-month cashflow summary
4. display the result on the existing `/cashflow` page
5. do all of this without writing to Actual data
6. do all of this without modifying Actual database schemas or budget calculations

This is a read-only prototype.

---

# 3. Non-negotiable constraints

Do not modify Actual core budget calculations.

Do not modify Actual database table structures.

Do not create migrations.

Do not create Flow persistence tables yet.

Do not write transactions.

Do not write account changes.

Do not write categories.

Do not write budgets.

Do not change sync behavior.

Do not touch CRDT logic.

Do not implement full cashflow forecasting yet.

Do not implement goals, debts, settlement, subscriptions, deadlines, investments, or monthly close logic yet.

---

# 4. Product principle

Actual/Flow core remains the source of truth for real financial data:

* accounts
* transactions
* categories
* payees
* budgets
* transfers
* schedules
* reports
* sync behavior

Flow adds its own interpretation layer.

For TASK003, Flow should only read existing data and calculate a simple current-month cashflow summary.

---

# 5. Adapter requirement

Create or extend a Flow adapter layer.

The goal is to avoid every Flow page directly importing random Actual internals.

Prefer a structure like one of these, depending on what works best with the repo after TASK002:

```text
packages/desktop-client/src/flow/actual-adapter/
```

or:

```text
packages/flow/src/actual-adapter/
```

If the already-created `packages/flow` package is hard to import cleanly from the web app, use:

```text
packages/desktop-client/src/flow/actual-adapter/
```

for now, and document why.

The adapter should expose simple read functions for Flow pages.

Suggested interface:

```ts
export type FlowDateRange = {
  start: string;
  end: string;
};

export type FlowAccount = {
  id: string;
  name: string;
  balance?: number;
  offBudget?: boolean;
  closed?: boolean;
};

export type FlowTransaction = {
  id: string;
  date: string;
  accountId: string;
  accountName?: string;
  categoryId?: string;
  categoryName?: string;
  payeeId?: string;
  payeeName?: string;
  amount: number;
  notes?: string;
  cleared?: boolean;
  reconciled?: boolean;
};

export type FlowCashflowSummary = {
  month: string;
  income: number;
  expenses: number;
  net: number;
  accountCount: number;
  transactionCount: number;
};
```

Adapter functions should be something like:

```ts
getFlowAccounts(): Promise<FlowAccount[]>
getFlowTransactions(range: FlowDateRange): Promise<FlowTransaction[]>
getCurrentMonthCashflowSummary(): Promise<FlowCashflowSummary>
```

Use existing Actual data access patterns discovered during the repo study and TASK002 implementation.

Do not directly query SQLite tables from UI code unless that is already the established Actual UI pattern.

Prefer existing query hooks, IPC `send`, AQL, or existing app data utilities.

---

# 6. Cashflow page requirements

Replace the `/cashflow` placeholder with a read-only prototype.

The page should show:

## Header

```text
Cashflow
```

Subtitle:

```text
Read-only prototype using existing Flow transaction data.
```

## Summary cards

Show at least:

* Current month
* Income this month
* Expenses this month
* Net cashflow this month
* Number of transactions counted
* Number of accounts found

## Transaction preview

Show a small table/list of recent current-month transactions if easily available.

Columns:

* date
* account
* payee or notes
* category
* amount

If transaction preview is too risky for this task, skip it and document why.

## Empty state

If no budget file is loaded, no accounts exist, or no transactions exist, show a friendly empty state rather than crashing.

Example:

```text
No current-month transactions found yet.
Create or import transactions in Flow, then return here.
```

## Error state

If adapter reads fail, show a clear local error message inside the Cashflow page.

Do not crash the entire app.

---

# 7. Calculation rules for prototype

Use the current calendar month based on today.

Example month key:

```text
2026-06
```

Use Actual transaction amounts as stored by Actual.

Important: Actual may store amounts as integer cents or milliunits depending on existing code. Inspect existing Actual formatting/utilities and use the correct conversion/formatting approach.

For the prototype:

```text
income = sum of positive inflow/income-like transaction amounts
expenses = absolute sum of negative/outflow transaction amounts
net = income - expenses
```

If Actual’s sign convention is opposite, follow the repo’s established convention and document it.

Exclude deleted/tombstoned transactions if the existing query pattern exposes them.

If transfers are included and there is an existing reliable way to identify them, document whether they are included or excluded.

If transfer identification is not clear, include them for now and document this as a known limitation.

---

# 8. Formatting

Use existing Actual/Flow money formatting components or utilities where possible.

Do not invent a new currency formatter if the app already has one.

If using raw formatting temporarily, make that clear in code comments and report.

The page should visually fit the existing app style.

It does not need to be beautiful yet, but it should not look broken.

---

# 9. Integration constraints

The Cashflow page should be opened through the existing sidebar route added in TASK002.

Do not add a new Flow home page.

Do not change sidebar structure unless needed to fix a bug.

Do not add new navigation sections in this task.

---

# 10. Validation

Run the most relevant checks.

Required:

```bash
node scripts/flow/check-flow-layout.mjs
```

If available and feasible:

```bash
node .yarn/releases/yarn-4.13.0.cjs flow:check-layout
node .yarn/releases/yarn-4.13.0.cjs typecheck
node .yarn/releases/yarn-4.13.0.cjs workspace @actual-app/web build
git diff --check
```

If full lint fails because of pre-existing repo formatting issues, run targeted formatting/lint checks on changed files and document the exact result.

Do not hide failures.

---

# 11. Manual browser smoke test

If the dev server can run, test:

```text
http://localhost:3001
```

Then:

1. create or open a test budget file
2. navigate to Cashflow
3. verify the page loads
4. verify no fatal backend worker error appears
5. verify the page handles empty data gracefully
6. if possible, create/import a small transaction and verify the summary changes

Document what was tested.

---

# 12. Report requirement

Create:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK003_RESULT.md
```

The report must include:

```markdown
# TASK003 Result — Read-Only Flow Adapter and Cashflow Prototype

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. Adapter Implementation

## 5. Cashflow Page Implementation

## 6. Data Access Path Used

## 7. Calculation Rules Used

## 8. Known Limitations

## 9. Commands Run

## 10. Command Results

## 11. Browser Smoke Test

## 12. What Worked

## 13. What Did Not Work

## 14. Risks / Concerns

## 15. Items To Finish Later

## 16. Recommended Next Task
```

Recommended next task should likely be one of:

```text
TASK004 — Expand Cashflow with planned recurring data and scenario structure.
```

or:

```text
TASK004 — Create Flow persistence design for goals, debts, and cashflow scenarios.
```

Choose based on what TASK003 reveals.

---

# 13. Definition of done

TASK003 is complete only when:

* Cashflow page is no longer just a placeholder
* Cashflow page reads real Actual/Flow data read-only
* Flow adapter/read layer exists
* current-month summary is displayed
* page handles empty/error states
* no Actual core budget calculations were modified
* no database schemas were modified
* no migrations were added
* no sync logic was modified
* no writes to Actual data were added
* relevant checks were run or attempted
* result report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK003_RESULT.md`

---

# 14. Final instruction

Be conservative.

This is the first real module.

The goal is to prove safe read-only integration, not to finish Cashflow.

Do not jump ahead to forecasting, goals, debts, settlements, or persistence unless required for a small helper.

Build the smallest useful read-only Cashflow prototype, report everything, and stop.
