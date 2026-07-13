# TASK013 — Affordability Calculator

## Role

You are the implementation AI working inside the Flow repository.

TASK005 added database-backed Flow Settings.
TASK006 added durable Flow transaction metadata.
TASK007 added Flow metadata columns to the Transactions page.
TASK008 added Settlement calculation and snapshots.
TASK009 added Settlement payment linking and monthly close/reopen state.
TASK010 added the Debts metadata page.
TASK011 added the Subscription Detector and Subscription page.
TASK012 added the Monthly Cashflow Planner.

TASK013 builds the first Flow Affordability Calculator.

This feature answers:

```text
Can I afford this purchase without breaking this month’s cashflow, safety balance, debt plan, savings plan, or household settlement logic?
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
AGENT_INSTRUCTIONS/CODEX/reports/TASK013_RESULT.md
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

# 3. TASK012 preflight

Before starting major Affordability work, do a quick sanity check if the app can run:

1. Open `/cashflow`.
2. Confirm the Monthly Cashflow Planner loads.
3. Generate a projection if possible.
4. Confirm saved cashflow runs can be read if one exists.
5. Document whether the browser check succeeded.

Do not spend excessive time here.

If browser automation cannot run, document why and continue only if typecheck/build are healthy.

---

# 4. Goal

Create an Affordability Calculator page that helps the user decide whether a planned purchase is safe.

The page should answer:

```text
Can I buy this now?
Can I buy this on a specific date?
Will this make the month go negative?
Will this break the safe minimum balance?
Should I wait?
What is the reason?
```

Example use cases:

```text
Can I buy a phone for €1,200 this month?
Can we book flights for €700 on the 10th?
Can I buy a motorcycle part now or should I wait until salary?
Can Alba pay this and split it with me?
```

---

# 5. Product principle

Actual remains the source of truth for real money movement.

Flow adds decision support.

The Affordability Calculator must not create Actual transactions.
It only simulates the purchase and saves the affordability check result as Flow-owned metadata.

Correct model:

```text
Actual data = real financial state
Flow Cashflow = projected month state
Flow Affordability = simulated purchase decision
```

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

Do not build Scenario Builder in this task.

Do not build Runway / Time to Broke in this task.

Do not build FI/Monte Carlo in this task.

Do not store affordability data in localStorage.

Do not build a second generic reports system.

---

# 7. Route and navigation

Use the existing route if already present:

```text
/affordability
```

If `/affordability` currently renders a placeholder, replace it with the real page.

Navigation label:

```text
Affordability
```

Page title:

```text
Affordability Calculator
```

Subtitle:

```text
Test a planned purchase against your cashflow, safety balance, and household rules.
```

---

# 8. Database table

Add a Flow-owned table for saved affordability checks.

Recommended migration:

```sql
CREATE TABLE IF NOT EXISTS flow_affordability_checks (
  id TEXT PRIMARY KEY,
  purchase_name TEXT,
  amount INTEGER DEFAULT 0,
  planned_date TEXT,
  account_id TEXT,
  category_id TEXT,
  paid_by_member_id TEXT,
  shared_status TEXT DEFAULT 'personal',
  split_method TEXT DEFAULT 'none',
  priority TEXT DEFAULT 'normal',
  can_wait INTEGER DEFAULT 1,
  notes TEXT,
  decision TEXT DEFAULT 'check',
  reason TEXT,
  recommended_action TEXT,
  month_checked TEXT,
  cashflow_run_id TEXT,
  balance_before INTEGER DEFAULT 0,
  balance_after INTEGER DEFAULT 0,
  lowest_balance_after INTEGER DEFAULT 0,
  first_failure_date TEXT,
  safe_minimum_balance INTEGER DEFAULT 0,
  warning_balance INTEGER DEFAULT 0,
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
packages/loot-core/src/shared/flow-affordability.ts
```

Suggested frontend files:

```text
packages/desktop-client/src/flow/affordability/types.ts
packages/desktop-client/src/flow/affordability/storage.ts
packages/desktop-client/src/flow/affordability/calculate.ts
packages/desktop-client/src/flow/AffordabilityPage.tsx
```

Required model concepts:

```ts
export type FlowAffordabilityDecision =
  | 'ok'
  | 'wait'
  | 'danger'
  | 'check';

export type FlowAffordabilityPriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent';

export type FlowAffordabilityCheck = {
  id: string;
  purchaseName: string;
  amount: number;
  plannedDate: string;
  accountId?: string;
  categoryId?: string;
  paidByMemberId?: string;
  sharedStatus: 'personal' | 'shared' | 'ignored';
  splitMethod: 'none' | 'equal' | 'percentage' | 'fixed-amount' | 'custom';
  priority: FlowAffordabilityPriority;
  canWait: boolean;
  notes?: string;

  decision: FlowAffordabilityDecision;
  reason?: string;
  recommendedAction?: string;
  monthChecked: string;
  cashflowRunId?: string;

  balanceBefore: number;
  balanceAfter: number;
  lowestBalanceAfter: number;
  firstFailureDate?: string;
  safeMinimumBalance: number;
  warningBalance: number;

  createdAt?: string;
  updatedAt?: string;
};

export type FlowAffordabilityCalculation = {
  check: FlowAffordabilityCheck;
  warnings: string[];
  simulatedRows?: Array<{
    date: string;
    name: string;
    inflow: number;
    outflow: number;
    balanceAfter: number;
    source: string;
  }>;
};
```

Use integer money values consistent with Actual.

Do not use floating point money math.

---

# 10. Backend handlers

Add typed backend handlers.

Suggested handlers:

```text
flow/affordability-checks-get
flow/affordability-check-save
flow/affordability-check-delete
```

Optional:

```text
flow/affordability-check-get-one
```

Minimum behavior:

## flow/affordability-checks-get

Input:

```ts
{
  month?: string;
}
```

Returns non-tombstoned affordability checks, optionally filtered by month.

## flow/affordability-check-save

Input:

```ts
{
  check: FlowAffordabilityCheck;
}
```

Behavior:

* normalize/validate fields
* generate ID if missing
* update timestamps
* use sync-safe DB insert/update path
* do not touch Actual transactions

## flow/affordability-check-delete

Input:

```ts
{
  id: string;
}
```

Behavior:

* soft-tombstone the affordability check
* do not touch Actual transactions

---

# 11. Frontend storage/API

Add frontend functions:

```ts
getFlowAffordabilityChecks(
  month?: string,
): Promise<FlowAffordabilityCheck[]>;

saveFlowAffordabilityCheck(
  check: FlowAffordabilityCheck,
): Promise<FlowAffordabilityCheck>;

deleteFlowAffordabilityCheck(
  id: string,
): Promise<{ deleted: boolean }>;
```

No localStorage fallback.

If read/write fails, show a local error on the page.

---

# 12. Data sources

The Affordability Calculator should use existing data sources.

Use:

* Actual accounts
* Actual categories
* Flow Settings
* Flow household members
* Flow Cashflow Planner calculation from TASK012
* saved Flow cashflow run if useful
* Flow transaction metadata defaults where useful
* Flow debts/subscriptions indirectly through Cashflow

Do not duplicate the whole Cashflow calculation if possible.

Preferred:

* reuse the TASK012 cashflow calculation engine
* inject the planned purchase as a one-off outflow row
* compare result with base cashflow projection

If the engine is not directly reusable, refactor carefully inside Flow modules only.

Do not modify Actual reports.

---

# 13. Affordability input form

The page should allow the user to enter:

* purchase name
* amount
* planned date
* account
* category
* paid by household member
* shared/personal/ignored
* split method
* priority
* can wait yes/no
* notes

Use Actual components:

* `FinancialInput` for amount
* `DateSelect` for planned date
* Actual `Select`/dropdown patterns
* Actual `Tooltip` for help text

Add clear help text/tooltips.

Examples:

```text
Can wait:
If yes, Flow may recommend waiting until after income if the purchase creates cashflow risk.

Shared:
If shared, Flow can show the household impact separately from the full purchase amount.
```

---

# 14. Calculation behavior

The calculator should simulate the purchase as a one-off outflow on the planned date.

Base logic:

1. Build or load monthly cashflow projection for the purchase month.
2. Add one extra one-off row for the purchase.
3. Recalculate running balances.
4. Compare:

   * projected end balance before vs after
   * lowest balance before vs after
   * first failure date before vs after
   * safe minimum balance
   * warning balance
5. Produce decision.

---

# 15. Decision logic

Use simple explainable rules.

## Danger

Decision should be `danger` if:

* simulated balance goes below zero, or
* simulated balance goes below safe minimum, or
* selected account would go negative now if this can be checked safely

Example reason:

```text
Danger: this purchase makes projected cash go below zero on 2026-07-18.
```

## Wait

Decision should be `wait` if:

* simulated balance stays above zero but goes below warning balance, or
* purchase is non-urgent and waiting until next income would avoid a warning, or
* the month remains positive but safety buffer is too low

Example reason:

```text
Wait: the month stays positive, but your lowest balance falls below the warning level.
```

## OK

Decision should be `ok` if:

* simulated balance stays above warning and safe minimum
* no major warnings are triggered

Example reason:

```text
OK: the purchase fits inside this month’s projected cashflow.
```

## Check

Decision should be `check` if:

* no cashflow projection can be generated
* starting cash is missing
* no account/category data is available
* required source data failed to load

Example reason:

```text
Check cashflow first: Flow could not generate a reliable projection for this month.
```

---

# 16. Shared purchase behavior

If the purchase is shared, show both:

```text
Gross purchase amount
Personal share estimate
```

For v1:

* equal split with active household members should be supported
* other split methods can warn if not supported
* do not create settlement items automatically

Example:

```text
Gross cost: €800
Estimated personal share: €400
Cashflow impact: €800 leaves the selected payer’s account
Household settlement impact: another member may owe €400 later
```

Important:

Cashflow impact should usually use the full amount paid from the selected account, not only personal share, because the money leaves the payer’s account now.

Settlement impact is separate and can be shown as a note.

Do not over-integrate with Settlement in v1.

---

# 17. Account impact

If selected account is known, show:

* current account balance if available
* estimated account balance after purchase
* warning if account would go negative

If exact account impact is hard for v1:

* show available account balance from Actual if available
* warn that full account-level projection is limited
* do not overclaim

---

# 18. Output UI

The page should show the answer at the top.

## Top answer card

Show:

* decision: OK / WAIT / DANGER / CHECK
* reason
* recommended action

Examples:

```text
OK — You can afford this.
WAIT — Safer after next income.
DANGER — This breaks the month.
CHECK — Generate cashflow first.
```

## Impact cards

Show:

* purchase amount
* balance before
* balance after
* lowest balance after
* first failure date
* safe minimum
* warning balance
* gross vs personal share if shared

## Simulated row preview

Show a compact table of relevant cashflow rows around the planned purchase date.

Do not show the entire monthly table unless easy and readable.

## Saved checks

Show recent saved affordability checks for the selected month.

Fields:

* purchase name
* amount
* planned date
* decision
* reason
* created date
* actions: load/edit/delete

---

# 19. Save/delete behavior

User should be able to save the check.

Save should persist:

* input fields
* decision
* reason
* summary numbers
* month checked
* linked cashflow run ID if used

Delete should soft-tombstone the check.

Do not create Actual transactions.

Do not modify cashflow snapshots unless explicitly designed.

---

# 20. Interaction with Monthly Cashflow Planner

If a saved cashflow run exists for the purchase month:

* allow using it as the base
* show if the base is a saved snapshot

If no saved run exists:

* calculate a fresh projection using current sources

Do not require a saved cashflow run.

The Affordability page should be useful even before the user saves a Cashflow run.

---

# 21. Warnings and edge cases

Show warnings for:

* missing starting cash
* no selected account
* no selected category
* purchase date outside selected month
* no cashflow projection available
* source data failed to load
* planned date is in the past
* shared purchase without household members
* unsupported split method
* selected account cannot be checked
* saved cashflow snapshot is stale if generated date is old

Do not crash.

---

# 22. Tests

Add unit tests for affordability calculation if feasible.

Suggested tests:

1. OK when purchase stays above warning/safe levels.
2. WAIT when purchase drops below warning but not safe minimum.
3. DANGER when purchase drops below zero or safe minimum.
4. CHECK when cashflow projection is unavailable.
5. Shared equal purchase calculates personal share but cashflow impact uses gross amount.
6. Past purchase date produces warning.

Use TASK012 test patterns where possible.

---

# 23. Browser smoke test

Use demo or test budget.

Test:

1. Open `/affordability`.
2. Confirm page loads without FatalError.
3. Enter purchase name, amount, date, and account.
4. Calculate.
5. Confirm decision renders.
6. Add a large purchase that triggers Danger.
7. Save check.
8. Reload page.
9. Confirm saved check persists.
10. Delete saved check.
11. Confirm Actual transactions were not edited.

If needed, create minimal Flow Settings/cashflow setup through existing APIs and document it.

---

# 24. Validation commands

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

# 25. Result report

Create:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK013_RESULT.md
```

The report must include:

```markdown
# TASK013 Result — Affordability Calculator

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. TASK012 Preflight Result

## 5. Database Tables Added

## 6. Affordability Models Added

## 7. Backend Handlers Added

## 8. Frontend Storage/API Added

## 9. Affordability Page Implementation

## 10. Data Sources Used

## 11. Calculation Rules Used

## 12. Decision Logic

## 13. Shared Purchase Behavior

## 14. Save/Delete Behavior

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
TASK014 — Yearly Monthly Overview
```

unless TASK013 discovers that Affordability or Cashflow needs stabilization first.

---

# 26. Definition of done

TASK013 is complete only when:

* `/affordability` exists as a real page
* user can enter a planned purchase
* user can calculate affordability
* the page returns OK / WAIT / DANGER / CHECK
* calculation uses or reuses the Monthly Cashflow Planner logic
* one-off purchase simulation works
* shared purchase gross/personal impact is shown
* saved affordability checks are DB-backed
* user can save/load/delete checks
* no Actual transactions are created or edited
* no Actual schema or budget calculation is changed
* no localStorage is used for affordability
* UI uses Actual components and active theme tokens
* changing the Actual theme would affect the page
* validation commands are run or attempted
* report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK013_RESULT.md`

---

# 27. Final instruction

Be conservative.

Build the first useful Affordability Calculator.

Do not build Runway yet.

Do not build Scenario Builder yet.

Do not create Actual transactions.

Make the page explainable, DB-backed, and native to Actual’s UI/theme.
