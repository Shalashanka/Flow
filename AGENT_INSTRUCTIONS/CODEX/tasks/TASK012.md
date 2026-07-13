# TASK012 — Monthly Cashflow Planner

## Role

You are the implementation AI working inside the Flow repository.

TASK005 added database-backed Flow Settings.
TASK006 added durable Flow transaction metadata.
TASK007 added Flow metadata columns to the Transactions page.
TASK008 added Settlement calculation and snapshots.
TASK009 added Settlement payment linking and monthly close/reopen state.
TASK010 added the Debts metadata page.
TASK011 added the Subscription Detector and Subscription page.

TASK012 builds the first real Monthly Cashflow Planner.

This is not a clone of Actual’s Balance Forecast report.
This is a Flow decision page that answers:

```text
Can we reach the next salary without going negative?
```

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
AGENT_INSTRUCTIONS/CODEX/reports/TASK012_RESULT.md
```

Do not create reports outside:

```text
AGENT_INSTRUCTIONS/CODEX/reports/
```

---

# 2. Global UI/theme requirement

All UI must follow Actual Budget’s existing design standards.

Use Actual’s existing:

* components
* active theme tokens
* spacing patterns
* typography patterns
* button variants
* inputs
* selects
* date pickers
* tables
* cards
* tooltips
* icons
* menu/popover patterns
* empty states
* warning/error styles

Do not create a separate Flow design system.

Do not hard-code colors unless there is no existing theme token and the reason is documented.

Changing the active Actual theme must also affect Flow pages.

Flow pages should feel native inside Actual, not like a separate pasted-on app.

---

# 3. TASK011 preflight

Before starting major Cashflow work, do a quick sanity check if the app can run:

1. Open `/subscriptions`.
2. Confirm the Subscriptions page loads.
3. Confirm confirmed subscription records are readable.
4. If possible, confirm one subscription can be edited and still persists.

Do not spend excessive time here.
If the dev browser cannot run, document why and continue only if typecheck/build are healthy.

---

# 4. Goal

Create a Monthly Cashflow Planner page that combines:

* actual transactions already posted this month
* manual or Actual-derived starting cash
* future expected income
* fixed bills
* confirmed subscriptions
* planned debt payments
* variable spending forecast
* optional one-off test cost
* safe minimum and warning balance

The page should generate a row-by-row monthly projection and show:

```text
Starting cash
+ income
- fixed bills
- subscriptions
- debt payments
- variable spending forecast
- one-off test cost
= projected running cash balance
```

The page must clearly show:

* projected end balance
* lowest projected balance
* first date the month fails, if any
* next income date
* whether the month is safe, warning, or danger

---

# 5. Product principle

Actual remains the source of truth for real financial data:

* accounts
* transactions
* categories
* payees
* schedules
* budgets
* transfers

Flow adds decision planning:

* manual starting cash confirmation
* variable spending forecast
* debt payment planning
* subscription planning
* one-off purchase test
* row-by-row risk view
* saved cashflow run snapshots

Do not modify Actual’s Balance Forecast report.

Do not change Actual budget calculations.

Do not create or edit Actual transactions in this task.

---

# 6. Non-negotiable constraints

Do not modify Actual core budget calculations.

Do not modify Actual transaction schema.

Do not modify Actual account/category/payee/schedule schemas.

Do not change Actual import behavior.

Do not change bank sync behavior.

Do not change CRDT/sync logic blindly.

Do not create Actual transactions.

Do not edit Actual transactions.

Do not create Actual schedules.

Do not implement Scenario Builder in this task.

Do not implement Runway / Time to Broke in this task.

Do not implement FI/Monte Carlo in this task.

Do not store cashflow data in localStorage.

Do not build a second generic reports system.

---

# 7. Route and navigation

Use the existing route if already present:

```text
/cashflow
```

If `/cashflow` currently renders the earlier TASK003 prototype, replace it with the real Monthly Cashflow Planner.

Navigation label should be:

```text
Cashflow
```

Page title should be:

```text
Monthly Cashflow Planner
```

Subtitle:

```text
Project this month’s money movement and see whether you can reach the next income date safely.
```

---

# 8. Database tables

Add Flow-owned tables for saved cashflow runs.

Recommended migration:

```sql
CREATE TABLE IF NOT EXISTS flow_cashflow_runs (
  id TEXT PRIMARY KEY,
  month TEXT,
  run_name TEXT,
  starting_cash INTEGER DEFAULT 0,
  starting_cash_source TEXT DEFAULT 'manual',
  selected_account_ids TEXT,
  safe_minimum_balance INTEGER DEFAULT 0,
  warning_balance INTEGER DEFAULT 0,
  one_off_name TEXT,
  one_off_amount INTEGER DEFAULT 0,
  one_off_date TEXT,
  status TEXT DEFAULT 'draft',
  lowest_balance INTEGER DEFAULT 0,
  projected_end_balance INTEGER DEFAULT 0,
  first_failure_date TEXT,
  generated_at TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS flow_cashflow_rows (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  row_date TEXT,
  row_type TEXT,
  name TEXT,
  account_id TEXT,
  category_id TEXT,
  inflow INTEGER DEFAULT 0,
  outflow INTEGER DEFAULT 0,
  balance_after INTEGER DEFAULT 0,
  confirmed INTEGER DEFAULT 0,
  source TEXT,
  source_id TEXT,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
```

Use nullable/defaulted non-ID columns where needed to remain compatible with Actual’s column-message insert/update path.

Avoid strict `NOT NULL` columns except for `id`.

---

# 9. TypeScript models

Add shared models if useful.

Suggested shared file:

```text
packages/loot-core/src/shared/flow-cashflow.ts
```

Suggested frontend files:

```text
packages/desktop-client/src/flow/cashflow/types.ts
packages/desktop-client/src/flow/cashflow/storage.ts
packages/desktop-client/src/flow/cashflow/calculate.ts
packages/desktop-client/src/flow/CashflowPage.tsx
```

Required model concepts:

```ts
export type FlowCashflowRowType =
  | 'starting-cash'
  | 'actual-income'
  | 'actual-expense'
  | 'planned-income'
  | 'fixed-bill'
  | 'subscription'
  | 'debt-payment'
  | 'variable-forecast'
  | 'one-off'
  | 'adjustment';

export type FlowCashflowRunStatus =
  | 'draft'
  | 'generated'
  | 'saved'
  | 'warning'
  | 'danger';

export type FlowCashflowStartingCashSource =
  | 'manual'
  | 'actual-accounts';

export type FlowCashflowRow = {
  id: string;
  runId?: string;
  date: string;
  rowType: FlowCashflowRowType;
  name: string;
  accountId?: string;
  categoryId?: string;
  inflow: number;
  outflow: number;
  balanceAfter: number;
  confirmed: boolean;
  source: string;
  sourceId?: string;
  notes?: string;
};

export type FlowCashflowRun = {
  id: string;
  month: string;
  runName?: string;
  startingCash: number;
  startingCashSource: FlowCashflowStartingCashSource;
  selectedAccountIds: string[];
  safeMinimumBalance: number;
  warningBalance: number;
  oneOffName?: string;
  oneOffAmount?: number;
  oneOffDate?: string;
  status: FlowCashflowRunStatus;
  lowestBalance: number;
  projectedEndBalance: number;
  firstFailureDate?: string;
  generatedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FlowCashflowCalculation = {
  run: FlowCashflowRun;
  rows: FlowCashflowRow[];
  warnings: string[];
  nextIncomeDate?: string;
  summary: {
    actualIncome: number;
    actualExpenses: number;
    plannedIncome: number;
    plannedOutflows: number;
    projectedEndBalance: number;
    lowestBalance: number;
    firstFailureDate?: string;
  };
};
```

Use integer money values consistent with Actual.

Do not use floating point money math.

---

# 10. Backend handlers

Add typed backend handlers for saved cashflow runs.

Suggested handlers:

```text
flow/cashflow-runs-get
flow/cashflow-run-save
flow/cashflow-run-delete
flow/cashflow-rows-get
```

Minimum behavior:

## flow/cashflow-runs-get

Input:

```ts
{
  month?: string;
}
```

Returns non-tombstoned cashflow runs, optionally filtered by month.

## flow/cashflow-run-save

Input:

```ts
{
  run: FlowCashflowRun;
  rows: FlowCashflowRow[];
}
```

Behavior:

* upsert run
* tombstone old rows for that run
* save current generated rows
* use sync-safe DB insert/update path
* do not touch Actual transactions

## flow/cashflow-run-delete

Input:

```ts
{
  runId: string;
}
```

Behavior:

* tombstone run and its rows
* do not touch Actual transactions

## flow/cashflow-rows-get

Input:

```ts
{
  runId: string;
}
```

Returns saved rows for the run.

---

# 11. Frontend storage/API

Add frontend functions:

```ts
getFlowCashflowRuns(month?: string): Promise<FlowCashflowRun[]>;

saveFlowCashflowRun(
  run: FlowCashflowRun,
  rows: FlowCashflowRow[],
): Promise<{ saved: boolean; runId: string }>;

deleteFlowCashflowRun(
  runId: string,
): Promise<{ deleted: boolean }>;

getFlowCashflowRows(
  runId: string,
): Promise<FlowCashflowRow[]>;
```

No localStorage fallback.

If read/write fails, show local error on the page.

---

# 12. Data sources

The Monthly Cashflow Planner should read from the existing Flow/Actual data sources.

## Actual data

Use safe read paths/adapters for:

* accounts
* transactions
* categories
* schedules if available
* payees if needed

## Flow data

Use:

* Flow Settings
* confirmed Flow subscriptions from TASK011
* Flow debts from TASK010
* Flow transaction metadata from TASK006/TASK007 where needed for cashflow inclusion/exclusion
* settlement data only if useful and safe

Do not over-integrate settlement in v1.
Settlement payment linking can be handled later if needed.

---

# 13. Selected month

The page should have a month selector using Actual’s date/month picker pattern.

Default selected month:

```text
current calendar month
```

Generated rows should cover:

```text
first day of selected month
through
last day of selected month
```

---

# 14. Starting cash

Allow two modes:

## Manual

User enters starting cash for the first day of the month.

This is important because the user may want to use the exact real bank total from the beginning of the month.

## Actual accounts

User selects included accounts, and Flow calculates the starting cash using Actual account balances and/or transaction history if safe.

If exact historical starting balance is hard in v1, show a warning and allow manual entry.

Preferred v1:

* manual starting cash is primary
* selected accounts are still used for filtering and future integration

Fields:

* starting cash
* starting cash source
* selected accounts
* safe minimum balance
* warning balance

Defaults should come from Flow Settings cashflow parameters where available.

---

# 15. Actual transactions already posted this month

For the selected month, load posted Actual transactions up to today or up to the selected month’s current known data.

Include:

* actual income rows
* actual expense rows

Exclude:

* transfers if identifiable
* tombstoned/deleted transactions
* transactions whose Flow metadata says `cashflowIncluded = false`

If Flow metadata is missing, use its default behavior from TASK006.

Use Actual amount convention:

* income/inflow positive
* expense/outflow negative

Display expenses as positive outflow values.

Document the exact convention used.

---

# 16. Planned income

Use these sources in priority order:

1. Actual schedules for income if safely readable and identifiable.
2. Flow Settings income plans if they exist.
3. Manual planned income rows if added in this page, optional v1.

Minimum v1 acceptable:

* use Flow Settings income plans
* document Actual schedules integration as future work if too large

Rows should include:

* date
* name
* amount as inflow
* source = `flow-income-plan` or `actual-schedule`

Only include future planned income for the selected month.

---

# 17. Fixed bills

Use these sources in priority order:

1. Actual schedules for bills if safely readable and identifiable.
2. Flow Settings fixed bills if they exist.
3. Confirmed subscriptions from TASK011.
4. Flow Debts planned payments from TASK010.

Do not build a second recurrence engine.

For v1, it is acceptable to include:

* confirmed Flow subscriptions
* active Flow debt planned payments
* Flow Settings fixed bills if still present
* Actual schedules only if safe and straightforward

Document any source not implemented.

---

# 18. Confirmed subscriptions

Use confirmed subscriptions from TASK011.

For each confirmed subscription:

* include if expected date falls in selected month
* if next expected date is missing, estimate from recurrence and last seen date
* use subscription amount as outflow
* source = `flow-subscription`
* sourceId = subscription ID

Cancelled, ignored, and paused subscriptions should not be included by default.

Unknown/irregular recurrence should warn and be excluded unless a next expected date is set.

---

# 19. Debt payments

Use active debts from TASK010.

For each active debt:

* use planned payment if > 0
* otherwise use minimum payment if > 0
* use due day to place the row in the selected month
* source = `flow-debt`
* sourceId = debt ID

If no due day exists:

* place on last day of month or warn
* choose one behavior and document it

---

# 20. Variable spending forecast

This is critical.

For variable categories, estimate remaining monthly spending using historical Actual transactions.

Recommended v1 logic:

1. Identify variable categories.
2. For each variable category, read the last 3 full months of spending.
3. Exclude transfers.
4. Exclude income/inflows.
5. Exclude categories marked non-cashflow if such metadata exists.
6. Use median by default.
7. Average can be optional later.
8. Subtract actual spending already posted this month.
9. Remaining forecast = max(0, median forecast - actual spent this month).
10. Spread remaining amount over future weekly rows or one reserve row.

If variable category configuration exists in Flow Settings, use it.

If not, v1 may use a manual “variable forecast total” field on the Cashflow page and document the limitation.

Preferred v1:

* use Flow Settings variable spending rules if present
* each rule links to an Actual category
* monthlyBudget is used as the monthly forecast amount
* subtract actual spending in that category for the selected month
* remaining is spread weekly or as one reserve row depending on forecast method

Do not silently invent forecasts for all categories without user control.

---

# 21. One-off test cost

Add a simple “test purchase” or “one-off cost” area.

Fields:

* name
* amount
* date
* enabled

If enabled, add one cashflow row:

```text
rowType = one-off
source = manual-one-off
```

This lets the user test:

```text
Can I buy this phone/car/flight this month?
```

The one-off cost does not create an Actual transaction.

---

# 22. Row sorting and running balance

Combine all rows:

1. starting cash row
2. actual rows by date
3. planned rows by date
4. one-off row by date

Sort by:

```text
date ascending
actual rows before planned rows on same date
income before outflow on same date if needed
stable deterministic order
```

Calculate:

```text
balanceAfter = previousBalance + inflow - outflow
```

Track:

* projected end balance
* lowest balance
* first date balance goes below 0
* first date balance goes below warning balance
* first date balance goes below safe minimum balance
* next income date

---

# 23. Status logic

Set run status:

## danger

If projected balance goes below 0 or below safe minimum.

## warning

If projected balance goes below warning balance.

## generated

If no risk is detected.

Use simple clear copy:

```text
Safe
Warning
Danger
```

Examples:

```text
Danger: balance goes below zero on 2026-07-18.
Warning: lowest balance is below your warning level.
Safe: projected balance stays above the configured safety levels.
```

---

# 24. Page UI

Create or replace `/cashflow`.

The page should include:

## Top answer section

Show the main result immediately:

* Safe / Warning / Danger
* projected end balance
* lowest balance
* first failure date if any
* next income date

## Controls

* selected month
* starting cash source
* manual starting cash
* selected accounts
* safe minimum balance
* warning balance
* one-off test cost fields
* generate/recalculate
* save run
* load saved run
* delete saved run

## Summary cards

* actual income
* actual expenses
* planned income
* planned outflows
* variable forecast
* debt payments
* subscriptions
* one-off
* projected end balance

## Cashflow table

Columns:

* date
* type
* name
* account
* category
* inflow
* outflow
* balance after
* source
* confirmed/planned

Use Actual-themed table or cards.

## Warnings panel

Show warnings for:

* missing starting cash
* no selected accounts
* no income source
* no fixed bill source
* variable forecast missing
* confirmed subscriptions with no expected date
* debt with no due day
* unknown recurrence
* cashflow excluded transactions
* calculation limitations

Collapse secondary details if needed to keep the page readable.

---

# 25. Save/load behavior

The user should be able to save a generated cashflow run.

Save should persist:

* run configuration
* generated rows
* calculated summary values

Loading a saved run should show the saved snapshot.

Recalculating should generate a new preview.

Do not silently overwrite a saved run unless user clicks save.

Minimum v1:

* one saved run per month can be replaced by saving again
* if multiple runs are implemented, allow selecting them

Document behavior.

---

# 26. Interaction with subscriptions/debts/settings

Use existing storage APIs:

* confirmed subscriptions from TASK011
* active debts from TASK010
* Flow Settings cashflow parameters/income/fixed/variable rules from TASK005
* Flow metadata defaults from TASK006 where needed

Do not duplicate their storage.

If any source fails to load:

* show warning
* continue with available sources where safe

---

# 27. Tests

Add unit tests for cashflow calculation if feasible.

Suggested tests:

1. starting cash + income + expense produces expected ending balance
2. lowest balance and first failure date detected
3. debt payment row included
4. subscription row included
5. variable forecast subtracts actual month-to-date spending
6. one-off cost creates danger when too large

Do not block the task if test infrastructure is difficult, but add tests if consistent with TASK011’s test pattern.

---

# 28. Browser smoke test

Use demo or test budget.

Test:

1. Open `/cashflow`.
2. Confirm page loads without FatalError.
3. Enter manual starting cash.
4. Choose selected month.
5. Generate cashflow.
6. Confirm rows render.
7. Confirm projected end balance and lowest balance render.
8. Add one-off cost large enough to trigger warning/danger.
9. Confirm status changes.
10. Save run.
11. Reload page.
12. Confirm saved run can be loaded.
13. Delete saved run.
14. Confirm Actual transactions were not edited.

If demo data lacks Flow settings/debts/subscriptions, use existing pages/APIs to create minimal test data and document setup.

---

# 29. Validation commands

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

# 30. Result report

Create:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK012_RESULT.md
```

The report must include:

```markdown
# TASK012 Result — Monthly Cashflow Planner

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. TASK011 Preflight Result

## 5. Database Tables Added

## 6. Cashflow Models Added

## 7. Backend Handlers Added

## 8. Frontend Storage/API Added

## 9. Cashflow Page Implementation

## 10. Data Sources Used

## 11. Calculation Rules Used

## 12. Variable Spending Forecast

## 13. Subscriptions/Debts/Settings Integration

## 14. Save/Load Behavior

## 15. UI Theme / Actual Design Compliance

## 16. Tests Added

## 17. Commands Run

## 18. Command Results

## 19. Browser Smoke Test

## 20. What Worked

## 21. What Did Not Work

## 22. Risks / Concerns

## 23. Items To Finish Later

## 24. Recommended Next Task
```

Recommended next task should likely be:

```text
TASK013 — Affordability Calculator
```

unless TASK012 discovers that Cashflow needs stabilization first.

---

# 31. Definition of done

TASK012 is complete only when:

* `/cashflow` is a real Monthly Cashflow Planner
* user can select month
* user can enter manual starting cash
* user can generate row-by-row monthly projection
* actual current-month transactions are included
* confirmed subscriptions can be included
* active debts can be included
* Flow Settings income/fixed/variable rules are used where available
* one-off test cost works
* projected end balance renders
* lowest balance renders
* warning/danger status works
* user can save/load/delete a cashflow run
* saved cashflow data is DB-backed
* no Actual transaction/account/category/schema data is modified
* no localStorage is used for cashflow
* UI uses Actual components and active theme tokens
* changing the Actual theme would affect Cashflow page
* validation commands are run or attempted
* report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK012_RESULT.md`

---

# 32. Final instruction

Be conservative.

Build the first useful Monthly Cashflow Planner.

Do not build Scenario Builder.

Do not build Runway / Time to Broke.

Do not build Affordability yet.

Make the month projection real, explainable, saved, and native to Actual’s UI/theme.
