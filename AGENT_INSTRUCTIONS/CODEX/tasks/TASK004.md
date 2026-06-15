# TASK004 — Build Flow Planning Setup Page and Configuration Models

## Role

You are the implementation AI working inside the Flow repository.

TASK001 created the internal Flow scaffold.
TASK002 rebranded the UI to Flow and added placeholder pages.
TASK003 created the first read-only Cashflow prototype using existing Actual data.

TASK004 creates the configuration foundation required before building the real projected Cashflow engine.

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
AGENT_INSTRUCTIONS/CODEX/reports/TASK004_RESULT.md
```

Do not create reports outside `AGENT_INSTRUCTIONS/CODEX/reports`.

---

# 2. Goal of TASK004

Create a new Flow configuration page where the user can customize the planning data that future Flow modules will use.

This page should be the software replacement for the custom Aspire spreadsheet tabs such as:

* Parametra Plus
* Fatura Fikse
* Te ardhura plan
* Variable Forecast
* Qellime
* Borxhe
* Subscriptions
* Deadlines

The page should not yet implement the full Cashflow forecast.
It should create the **configuration foundation** that Cashflow will later consume.

---

# 3. Product direction

Flow is one integrated product.

Do not create a separate Flow home page.

The new page should be a normal integrated page inside the existing app shell.

Recommended navigation label:

```text
Planning Setup
```

Recommended route:

```text
/planning-setup
```

Place it under the existing `More` section unless the existing navigation structure clearly suggests a better place.

---

# 4. Non-negotiable constraints

Do not modify Actual core budget calculations.

Do not modify Actual database table structures.

Do not create database migrations in this task.

Do not modify sync behavior.

Do not modify CRDT logic.

Do not write Actual transactions.

Do not write Actual budgets.

Do not alter Actual account/category storage.

Do not implement the full cashflow forecast yet.

Do not implement production-grade persistence if the safe persistence path is unclear.

Do not hide failures.

---

# 5. Main concept

Actual/Flow core remains the source of truth for real financial data:

* accounts
* transactions
* categories
* payees
* budgets
* transfers
* schedules
* reports

Flow Planning Setup stores Flow-owned planning metadata:

* household members
* default payer/split rules
* income plans
* fixed bills
* variable spending assumptions
* cashflow parameters
* scenarios
* goal planning metadata
* debt planning metadata
* subscription review metadata
* deadline/task metadata

Flow-owned data should reference Actual records by ID where possible, not display names.

Example:

```ts
linkedAccountId: actualAccountId
linkedCategoryId: actualCategoryId
```

Avoid name-based matching except as a temporary display fallback.

---

# 6. Persistence strategy for TASK004

The long-term goal is a shared Flow persistence layer that works across devices.

However, if the safe shared persistence path is not ready yet, TASK004 may use a clearly marked temporary persistence layer.

Preferred priority order:

1. Use an existing safe app-level settings/preferences mechanism if it supports budget-file-specific data.
2. If not safe, create a temporary local persistence layer using browser local storage.
3. Do not create new SQLite tables or migrations in TASK004.
4. Document the persistence choice clearly in the report.

If local storage is used, names must be clearly marked as temporary:

```text
flow.planningSetup.v0
```

The UI should display a small notice if the storage is temporary:

```text
Planning Setup is currently stored locally on this browser. Shared sync storage will be added in a later task.
```

This is acceptable for TASK004 because the goal is to shape the configuration UI and models before implementing sync-safe storage.

---

# 7. Data models to create

Create typed models for Flow planning configuration.

Recommended location:

```text
packages/desktop-client/src/flow/planning/
```

or another Flow-isolated location matching the existing structure.

Create something similar to:

```text
packages/desktop-client/src/flow/planning/types.ts
packages/desktop-client/src/flow/planning/defaults.ts
packages/desktop-client/src/flow/planning/storage.ts
packages/desktop-client/src/flow/PlanningSetupPage.tsx
```

Adjust filenames if the repo conventions suggest better names.

## Required TypeScript model concepts

### Household member

```ts
type FlowHouseholdMember = {
  id: string;
  name: string;
  role: 'owner' | 'partner' | 'child' | 'other';
  active: boolean;
  defaultAccountId?: string;
};
```

### Cashflow settings

```ts
type FlowCashflowSettings = {
  defaultProjectionMode: 'current-month' | 'next-month';
  defaultScenarioId: string;
  minimumSafeBalance: number;
  warningBalance: number;
  defaultStartingBalanceMode: 'actual-accounts' | 'manual';
  includeOffBudgetAccounts: boolean;
  includeTransfers: boolean;
};
```

### Income plan

```ts
type FlowIncomePlan = {
  id: string;
  name: string;
  memberId?: string;
  amount: number;
  dayOfMonth: number;
  accountId?: string;
  categoryId?: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
  uncertain?: boolean;
  notes?: string;
};
```

### Fixed bill

```ts
type FlowFixedBill = {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  accountId?: string;
  categoryId?: string;
  splitMethod: 'shared-50-50' | 'only-member' | 'custom';
  memberId?: string;
  active: boolean;
  startDate?: string;
  endDate?: string;
  notes?: string;
};
```

### Variable spending rule

This replaces the spreadsheet “not fixed spending” / Variable Forecast logic.

```ts
type FlowVariableSpendingRule = {
  id: string;
  name: string;
  categoryId?: string;
  monthlyBudget: number;
  forecastMethod: 'daily-spread' | 'weekly-spread' | 'one-reserve' | 'manual';
  budgetWeight: number;
  active: boolean;
  notes?: string;
};
```

### Scenario

```ts
type FlowScenario = {
  id: string;
  name: string;
  type: 'base' | 'stress' | 'custom';
  active: boolean;
  incomeMultiplier: number;
  expenseMultiplier: number;
  savingsMultiplier: number;
  notes?: string;
};
```

### Planning setup root

```ts
type FlowPlanningSetup = {
  version: 1;
  householdMembers: FlowHouseholdMember[];
  cashflowSettings: FlowCashflowSettings;
  incomePlans: FlowIncomePlan[];
  fixedBills: FlowFixedBill[];
  variableSpendingRules: FlowVariableSpendingRule[];
  scenarios: FlowScenario[];
  updatedAt: string;
};
```

Add more fields only if needed. Keep the first version simple.

---

# 8. Page requirements

Create or replace the placeholder page for:

```text
Planning Setup
```

Route:

```text
/planning-setup
```

Navigation:

Add it under `More`.

The page should have sections or tabs/cards for:

1. Household
2. Cashflow Parameters
3. Income Plan
4. Fixed Bills
5. Variable Spending
6. Scenarios

Do not build Goals/Debts/Subs/Deadlines editors yet unless simple placeholders are needed. Those already have their own pages planned.

---

# 9. UI behavior requirements

The page should allow the user to:

## Household

* add household member
* edit member name
* select role
* mark active/inactive
* optionally choose default account from Actual accounts

## Cashflow Parameters

* set minimum safe balance
* set warning balance
* choose default scenario
* toggle include off-budget accounts
* toggle include transfers
* choose starting balance mode

## Income Plan

* add income plan row
* edit name
* amount
* day of month
* linked account
* linked category
* active flag
* uncertain flag
* notes

## Fixed Bills

* add fixed bill row
* edit name
* amount
* day of month
* linked account
* linked category
* split method
* active flag
* notes

## Variable Spending

* add variable spending rule
* edit name
* linked category
* monthly budget
* forecast method
* budget weight
* active flag
* notes

## Scenarios

* add scenario
* edit name
* type
* income multiplier
* expense multiplier
* savings multiplier
* active flag
* notes

---

# 10. Actual data dropdowns

Use the Flow adapter or existing safe read path to populate dropdowns with Actual accounts and categories.

The page should not rely only on free-text names.

Where possible, store:

```text
accountId
categoryId
```

Display:

```text
account name
category name
```

If accounts/categories cannot be loaded, show a friendly warning and allow basic editing without crashing.

---

# 11. Default data

When the Planning Setup is empty, initialize reasonable defaults.

Example:

Household members:

```text
Griseld
Alba
```

If hardcoding these names is not appropriate in the repo, initialize generic examples instead:

```text
Person 1
Person 2
```

Preferred: use generic defaults to avoid personal data in the codebase.

Scenarios:

```text
Base
Safe Mode
Conservative
One income missing
Salary delayed
```

Cashflow defaults:

```text
minimumSafeBalance = 0
warningBalance = 300
defaultProjectionMode = current-month
defaultStartingBalanceMode = actual-accounts
includeOffBudgetAccounts = false
includeTransfers = false
```

Use integer money units consistent with Actual if the app stores money in integer format.

Document the convention.

---

# 12. Save/reset/import/export

Add basic controls:

* Save
* Reset to defaults
* Export JSON
* Import JSON

For TASK004, these can operate on the chosen temporary/planning storage.

The export/import is useful because persistence may be temporary at first.

Import must validate basic shape and fail gracefully if invalid.

---

# 13. Cashflow integration preparation

Do not implement the full projected Cashflow yet.

But expose a function that future Cashflow can call, for example:

```ts
getFlowPlanningSetup(): Promise<FlowPlanningSetup>
```

and maybe:

```ts
saveFlowPlanningSetup(setup: FlowPlanningSetup): Promise<void>
```

The next task will use these to generate projected cashflow rows.

---

# 14. Styling

The page should fit the existing Flow app style.

Do not over-polish.

Use existing UI components when practical.

The UI should be clear and practical, even if it is not final.

Prefer simple cards/tables over complex custom components.

---

# 15. Validation

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

If full lint fails due to pre-existing repository formatting issues, run targeted formatting/lint checks on changed files and document the exact results.

---

# 16. Browser smoke test

If the dev server can run:

```text
http://localhost:3001
```

Test:

1. open a budget
2. open Planning Setup
3. add a household member
4. add one income plan
5. add one fixed bill
6. add one variable spending rule
7. save
8. reload browser
9. confirm saved data remains
10. export JSON
11. reset
12. import JSON
13. confirm restored data appears
14. confirm no fatal backend worker error

Document the result.

---

# 17. Result report

Create:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK004_RESULT.md
```

The report must include:

```markdown
# TASK004 Result — Flow Planning Setup Foundation

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. Planning Models Added

## 5. Persistence Strategy Used

## 6. Planning Setup Page Implementation

## 7. Actual Account/Category Dropdown Integration

## 8. Save/Reset/Import/Export Behavior

## 9. Commands Run

## 10. Command Results

## 11. Browser Smoke Test

## 12. What Worked

## 13. What Did Not Work

## 14. Risks / Concerns

## 15. Items To Finish Later

## 16. Recommended Next Task
```

Recommended next task should likely be:

```text
TASK005 — Use Planning Setup data to generate projected monthly Cashflow rows with running balance, minimum balance warning, and scenario support.
```

---

# 18. Definition of done

TASK004 is complete only when:

* Planning Setup page exists
* it is reachable from the sidebar/navigation
* the page has sections for household, cashflow parameters, income, fixed bills, variable spending, and scenarios
* typed planning models exist
* basic save/load works
* reset defaults works
* export/import JSON works
* Actual account/category dropdowns are used where feasible
* no Actual core budget calculations are changed
* no database schema changes are made
* no sync logic is changed
* no real projected Cashflow engine is implemented yet
* checks were run or attempted
* result report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK004_RESULT.md`

---

# 19. Final instruction

Be conservative.

This task creates the planning configuration foundation.

Do not jump ahead to the full Cashflow forecast engine.

Do not implement Goals, Debts, Settlement, Investments, or Monthly Close in this task.

Build the setup page, make it save and reload, document everything, and stop.


# TASK004 AMENDMENT — Global Flow Settings, Not Only Cashflow Planning

## Important correction

TASK004 should not treat all parameters as Cashflow-only.

Some configuration data is global Flow data and must be available across the whole product.

The page should therefore be named and designed as:

```text
Flow Settings
```

or:

```text
Flow Configuration
```

Preferred route:

```text
/flow-settings
```

Alternative acceptable route:

```text
/planning-setup
```

But the internal concept must be global settings, not only planning setup.

---

# 1. Core distinction

There are two kinds of settings:

## A. Global Flow settings

Used across many Flow modules.

Examples:

* household members
* family/household structure
* default payer
* default split rules
* member default accounts
* transaction ownership
* who made the purchase
* who paid
* who benefits
* shared vs personal rules
* reimbursement rules
* default currency/money behavior if needed later

These are needed by:

* Quick Entry mobile form
* Flow Transactions view
* Settlement
* Cashflow
* Monthly Close
* Reports
* Affordability
* Goals/Debts where relevant

## B. Planning/Cashflow settings

Used mainly by forecast/planning modules.

Examples:

* planned income
* fixed bills
* variable spending rules
* scenarios
* warning balance
* minimum safe balance
* projection mode
* include/exclude transfers
* starting balance mode

These are needed mostly by:

* Cashflow
* Monthly Overview
* Affordability
* Monthly Close

---

# 2. Page structure correction

The page should be organized like this:

```text
Flow Settings

1. Household
2. Transaction Rules
3. Cashflow Parameters
4. Income Plan
5. Fixed Bills
6. Variable Spending
7. Scenarios
```

Future sections, not required yet:

```text
8. Goals Defaults
9. Debt Defaults
10. Quick Entry Permissions
11. Reimbursement Rules
12. Notification Rules
```

---

# 3. Household section is global

The Household section must not be tied only to Cashflow.

It should define people who can appear in Flow-specific transaction metadata.

Example members:

```ts
type FlowHouseholdMember = {
  id: string;
  name: string;
  role: 'owner' | 'partner' | 'child' | 'other';
  active: boolean;
  defaultAccountId?: string;
};
```

These members will later be used by transaction metadata such as:

```ts
paidByMemberId
enteredByMemberId
beneficiaryMemberId
splitParticipants
```

---

# 4. Flow Transactions will extend Actual transactions without changing Actual tables

Actual’s normal Transactions page should remain intact.

Flow will later have its own enhanced Transactions view with additional Flow columns.

Examples of future Flow-only columns:

```text
Paid by
Entered by
Shared / Personal
Split rule
Settlement status
Reimbursement linked?
Goal linked?
Cashflow included?
Notes for Flow
```

These must not require changing Actual’s original transaction table structure.

Flow should store this extra metadata separately and link it to Actual transactions by Actual transaction ID.

Example:

```ts
type FlowTransactionMetadata = {
  id: string;
  actualTransactionId: string;
  paidByMemberId?: string;
  enteredByMemberId?: string;
  splitMethod?: 'shared-50-50' | 'only-member' | 'custom';
  settlementStatus?: 'not-needed' | 'open' | 'reimbursed' | 'ignored';
  cashflowIncluded?: boolean;
  notes?: string;
};
```

TASK004 does not need to implement this full metadata system yet, but it must design global settings with this future use in mind.

---

# 5. Transaction Rules section

Add a section called:

```text
Transaction Rules
```

It should include basic global defaults such as:

```ts
type FlowTransactionRules = {
  defaultPaidByMemberId?: string;
  defaultEnteredByMemberId?: string;
  defaultSplitMethod: 'shared-50-50' | 'only-member' | 'custom';
  defaultCashflowIncluded: boolean;
};
```

This will later be used by:

* Quick Entry form
* Flow Transactions page
* Settlement module
* Cashflow module

For TASK004, this can be simple and editable.

---

# 6. Updated root settings model

The root setup model should become more global:

```ts
type FlowSettings = {
  version: 1;
  householdMembers: FlowHouseholdMember[];
  transactionRules: FlowTransactionRules;
  cashflowSettings: FlowCashflowSettings;
  incomePlans: FlowIncomePlan[];
  fixedBills: FlowFixedBill[];
  variableSpendingRules: FlowVariableSpendingRule[];
  scenarios: FlowScenario[];
  updatedAt: string;
};
```

If the previous model was named `FlowPlanningSetup`, rename or alias it carefully.

Preferred name:

```ts
FlowSettings
```

Acceptable transitional name:

```ts
FlowPlanningSetup
```

but the UI/report must state that household and transaction rules are global.

---

# 7. Navigation correction

If TASK004 adds a new page to navigation, preferred label:

```text
Flow Settings
```

Preferred route:

```text
/flow-settings
```

It should go under:

```text
More
```

Do not create a separate Flow home page.

Do not remove existing settings.

This is a Flow-specific settings page, not the same as Actual’s existing application Settings.

---

# 8. Persistence correction

If temporary local storage is used, use a global name:

```text
flow.settings.v1
```

not only:

```text
flow.planningSetup.v0
```

If using old name temporarily, document it as a known issue and recommend migration.

---

# 9. Report requirement

In `AGENT_INSTRUCTIONS/CODEX/reports/TASK004_RESULT.md`, include a section:

```markdown
## Global Settings vs Cashflow Settings
```

Explain:

* which settings are global
* which settings are Cashflow-specific
* how household members will later be used by Quick Entry and Flow Transactions
* whether the implemented storage name reflects global settings or needs migration later

---

# 10. Do not overbuild

TASK004 still should not implement:

* full Quick Entry form
* full Flow Transactions page
* real settlement engine
* real Cashflow forecast engine
* database migrations
* synced Flow persistence

It should only create the global settings foundation and the planning configuration UI.
