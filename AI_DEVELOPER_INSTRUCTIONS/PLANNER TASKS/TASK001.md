# TASK 001 — Study Actual Repo and Produce Flow Architecture Report

## Product name

The product name is **Flow**.

Flow is a modular planning and control layer built inside a fork of Actual Budget.

Actual Budget remains the core source of truth for:

* accounts
* transactions
* categories
* payees
* budgets
* transfers
* existing Actual reports
* sync behavior
* core budgeting logic

Flow adds new product modules around Actual without changing Actual’s core data model or budget calculations.

---

## Main architectural principle

Do not modify Actual’s core table structures.

Do not reshape Actual’s data model to fit Flow.

Do not directly change Actual core budgeting calculations.

Do not scatter Flow logic inside Actual core files unless there is no alternative.

Flow should read Actual data, interpret it through its own domain logic, and store Flow-specific metadata separately.

Actual remains the source of truth for real financial data.

Flow stores only planning/control metadata that Actual does not natively model.

---

## Goal of this task

Study the repository structure and create a Markdown report explaining the safest way to add Flow as a modular extension inside the Actual UI.

This task should not implement features yet.

This task should only inspect, analyze, and document.

The output file should be:

`docs/FLOW_REPO_ARCHITECTURE_REPORT.md`

If the repo does not have a suitable `docs/` folder, create the report at the repository root:

`FLOW_REPO_ARCHITECTURE_REPORT.md`

---

## Required research steps

### 1. Inspect repository structure

Identify:

* package manager
* workspace structure
* main packages
* frontend package
* server/sync package
* shared packages
* database-related packages
* API/client packages
* test structure
* build scripts
* development commands

Report the relevant folders and what they appear to do.

---

### 2. Inspect UI/routing structure

Find where Actual defines:

* main app shell
* sidebar/navigation
* page routing
* route registration
* layout components
* menu items
* feature flags if any
* settings pages
* reports pages

Answer:

* Where should Flow pages be added?
* How can Flow appear as part of the same UI?
* What files would likely need small changes to add a new page?
* What files should be avoided because they are core Actual logic?

---

### 3. Inspect data access architecture

Find how the UI reads Actual data.

Look for:

* query hooks
* selectors
* stores
* message bridge
* API client calls
* local database client
* ActualQL usage
* budget/account/category/transaction access patterns
* transaction creation/update methods
* transfer creation methods
* budget month/category balance methods

Answer:

* What is the safest read path for Flow?
* What is the safest write path if Flow later needs to create Actual transactions?
* Is there already a stable internal API Flow can wrap?
* Should Flow use ActualQL, internal actions, API client methods, or existing hooks?

Important rule:

Flow should not directly query or mutate Actual database tables unless the report proves that is the established internal pattern.

Prefer existing application APIs/actions/hooks.

---

### 4. Inspect database and persistence

Study how Actual stores data locally.

Look for:

* schema files
* migrations
* database initialization
* table definitions
* sync logic
* local storage or IndexedDB usage
* metadata/settings storage
* budget file persistence
* server persistence if relevant

Answer:

* Where are Actual tables defined?
* Which tables represent accounts, transactions, categories, payees, budgets, and transfers?
* How are IDs generated?
* How are changes synced?
* How are migrations handled?
* Is there a safe place for Flow-specific data?
* Should Flow create a separate database/store rather than modifying Actual tables?

Preferred Flow strategy:

* Do not alter Actual core tables.
* Store Flow metadata in a separate namespace/store.
* Link Flow records to Actual records using Actual IDs.

Possible Flow metadata examples:

* `flow_goals`
* `flow_debts`
* `flow_settlements`
* `flow_monthly_closes`
* `flow_cashflow_scenarios`
* `flow_deadlines`
* `flow_subscriptions`
* `flow_investment_plans`
* `flow_account_control_snapshots`

If adding actual database tables is too risky, propose an alternative such as:

* separate Flow metadata database
* separate local storage namespace
* separate JSON/blob storage
* existing settings/preferences mechanism
* plugin-like storage layer

The report should compare options.

---

### 5. Study update/merge risk

Analyze how to keep the fork maintainable.

Answer:

* Which files are likely to conflict often with upstream Actual updates?
* Which areas are safer extension points?
* How can Flow be isolated?
* Should Flow be placed under one top-level folder/package?
* Should UI integration be limited to a small number of shell/sidebar route files?
* How should imports be structured to avoid touching core code repeatedly?

Desired strategy:

* Keep Actual core close to upstream.
* Add Flow modules in isolated folders.
* Use a small adapter layer to read/write Actual data.
* Keep all Flow-specific code under clearly named namespaces.
* Keep UI integration patches minimal and easy to rebase.

---

## Proposed architecture to evaluate

Evaluate this proposed structure and improve it if needed:

```text
packages/flow/
  actual-adapter/
  domain/
    cashflow/
    goals/
    debts/
    settlements/
    monthly-close/
    account-control/
    affordability/
    subscriptions/
    deadlines/
    investments/
    system-check/
  persistence/
  ui/
    pages/
    components/
    routes/
  tests/
```

Alternative if the repo structure prefers apps/packages differently:

```text
packages/desktop-client/src/flow/
  actual-adapter/
  domain/
  persistence/
  ui/
```

Do not assume this is correct.

Study the repo first and recommend the best placement.

---

## Flow adapter requirement

The report must propose an adapter layer.

Purpose:

All Flow modules should access Actual data through a narrow adapter, not by importing random Actual internals everywhere.

Example adapter methods:

```ts
getFlowBudgetContext()
getAccounts()
getCategories()
getTransactions(range)
getTransactionsByAccount(accountId, range)
getTransactionsByCategory(categoryId, range)
getBudgetMonth(month)
getCategoryBudgetState(month, categoryId)
createActualTransaction(payload)
createActualAccountTransfer(payload)
```

The report should identify what existing Actual methods/hooks/actions can power these adapter methods.

---

## Flow data ownership rules

Actual-owned data:

* accounts
* transactions
* payees
* categories
* budget categories
* budget months
* account transfers
* reconciled balances if Actual supports them
* existing Actual reports

Flow-owned data:

* goal target dates
* goal target amounts if not mapped to Actual goals
* goal planning metadata
* actual-saved interpretation rules
* debt creditor and payoff plan
* settlement/couple-sharing rules
* reimbursement matching status
* monthly close confirmations
* cashflow scenarios
* cashflow generated runs
* affordability checks
* subscription review state
* deadline/task state
* investment assumptions
* system check results

Flow should reference Actual data by IDs, not names.

Example:

```text
flow_goal.linkedCategoryId = Actual category ID
flow_goal.linkedAccountId = Actual account ID
```

Avoid name-based matching except during initial mapping/import.

---

## Feature list to keep in mind

The report should consider future support for these Flow pages:

1. Flow Home / Control Center
2. Cashflow Forecast
3. Goals
4. Debts
5. Settlement / Couple Sharing
6. Monthly Close
7. Account Control
8. Affordability
9. Subscriptions
10. Deadlines
11. Investments
12. System Check
13. Monthly Overview

No implementation yet.

Only plan where these should live and how they should interact with Actual.

---

## Clarification: Flow Home / Control Center

Flow Home / Control Center is not a separate product.

It is simply the main Flow dashboard page inside the Actual UI.

It should show:

* pending issues
* stale cashflow
* account-control status
* monthly close status
* upcoming deadlines
* open reimbursements
* debt status
* goal progress
* affordability warnings
* system check summary

It is the daily entry point for Flow.

---

## Expected report structure

Create `FLOW_REPO_ARCHITECTURE_REPORT.md` with these sections:

```markdown
# Flow Architecture Report for Actual Fork

## 1. Executive Summary

## 2. Repository Structure Observed

## 3. Actual Runtime Architecture Observed

## 4. UI and Routing Extension Points

## 5. Data Access Patterns

## 6. Database / Persistence Findings

## 7. Actual Data That Flow Should Treat as Source of Truth

## 8. Flow-Specific Data That Needs Separate Storage

## 9. Recommended Flow Module Placement

## 10. Proposed Flow Adapter Layer

## 11. Proposed Flow Persistence Strategy

## 12. Minimal UI Integration Plan

## 13. Upstream Merge Risk Analysis

## 14. Files Likely To Be Touched

## 15. Files To Avoid Touching

## 16. Open Questions

## 17. Recommended Next Development Task
```

---

## Definition of done

This task is complete only when:

* The repo structure has been inspected.
* The UI/routing integration points have been identified.
* The database/persistence model has been investigated.
* The report explains how to add Flow without touching Actual core tables.
* The report explains how Flow should read Actual data.
* The report explains how Flow should store its own metadata.
* The report identifies minimal files to touch for the first placeholder Flow page.
* No actual feature implementation is done yet.
* Only the Markdown report is created.

---

## Important constraints

Do not start implementing Flow pages in this task.

Do not modify Actual database schema in this task.

Do not modify Actual budget calculations in this task.

Do not create Flow tables yet.

Do not add sidebar links yet.

Do not rename Actual.

Do not change branding yet.

Only study and report.


Everything inside this new product needs to be parameterized. User must be able to update parameters without changing the actual code. Parameters like "bank accounts, savings accounts etc..."