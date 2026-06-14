# Finance Plus / Flow Product Plan

## 1. Product vision

Build a personal finance product based on Actual Budget, but extended into a full household finance control system.

Actual Budget remains the base engine for:

* accounts
* transactions
* categories
* envelope budgeting
* budgets
* sync
* existing reports

The new product layer adds:

* cashflow forecasting
* monthly close workflow
* account reconciliation control
* goals with actual saved tracking
* debt payoff planning
* couple settlement and reimbursements
* subscriptions
* deadlines
* affordability checks
* investment and ETF planning
* system health checks
* control center

Important principle:

Do not rewrite Actual’s core budgeting logic.

Build around it.

The product should feel like one app, but internally the new features should be modular and separated from Actual core code so upstream updates remain possible.

---

## 2. License and branding

Actual Budget is MIT licensed.

This allows commercial use, modification, distribution, sublicensing, and selling modified copies, as long as the original copyright notice and MIT license text remain included.

The fork/product should use its own branding.

Avoid presenting the product as the official Actual Budget unless explicitly allowed.

Working product name options:

* Flow
* CashPilot
* BalanceOS
* FlowBudget
* WealthPilot

Preferred name for now:

Flow

---

## 3. Architectural rule

Keep three layers separate.

### Layer 1 — Actual Core

Do not heavily change:

* account data model
* transaction data model
* budget math
* category budget logic
* sync logic
* existing Actual reports
* existing import/export behavior

Actual should remain updatable.

### Layer 2 — Finance Plus Modules

Add new modules in a separate area.

Suggested folder:

`packages/finance-plus/`

Suggested modules:

* `cashflow`
* `monthly-close`
* `account-control`
* `goals`
* `debts`
* `settlements`
* `subscriptions`
* `deadlines`
* `affordability`
* `investments`
* `system-check`
* `control-center`

### Layer 3 — Adapter

Create a single adapter that reads/writes Actual data.

Suggested file:

`packages/finance-plus/actual-adapter.ts`

All new modules should access Actual data through this adapter.

Do not scatter direct Actual database calls across new pages.

Adapter should expose functions like:

* `getAccounts()`
* `getCategories()`
* `getTransactions(dateRange)`
* `getBudgetMonth(month)`
* `getCategoryBalances(month)`
* `createTransaction(payload)`
* `createAccountTransfer(payload)`
* `getNetWorthSnapshot()`

If Actual internals change, update the adapter only.

---

## 4. Data model philosophy

Actual’s data remains the source of truth for real financial activity.

Actual should store:

* real transactions
* account transfers
* account balances
* budget categories
* category budgets
* payees if needed

Finance Plus should store planning and control metadata.

Finance Plus should store:

* goal target dates
* goal start dates
* goal priority
* debt creditor data
* planned debt payments
* settlement rules
* reimbursement matching
* monthly close confirmations
* cashflow scenario settings
* subscription review flags
* deadline statuses
* investment assumptions

Do not force all planning data into Actual categories.

---

## 5. Core concept: account transfer vs budget allocation

This is critical.

### Account transfer

Example:

ING Griseld → Piggybank

This is physical money movement.

In Actual, it should be represented as an account transfer / transfer transaction.

It affects account balances.

### Budget allocation

Example:

Available to budget → Emergency Fund category

This is envelope planning.

It affects category budget status.

It does not represent physical movement between accounts.

The product must treat these as separate concepts.

For savings, both may happen:

1. Move money physically from bank account to savings account.
2. Assign budget money to the savings goal category.

---

## 6. Goals module

Purpose:

Track real progress toward household goals.

Examples:

* Emergency fund
* Wedding
* Future car
* Vacation
* Future children
* Investments
* Home in Albania

Fields:

* goal id
* name
* target amount
* starting amount
* current amount
* start date
* target date
* priority
* active
* monthly needed
* linked category
* linked account optional
* notes

Important rule:

Goal actual saved should be based on real transfers or marked contributions, not only budget allocation.

Example:

If user moves €300 from ING to Piggybank with goal Emergency Fund, the goal actual saved increases by €300.

If user only budgets €300 to Emergency Fund but does not move the money, this should show as planned/funded, not necessarily physically moved.

Views:

* goal list
* progress bars
* monthly required amount
* planned vs actual saved
* behind/ahead status
* impact on cashflow

---

## 7. Debt module

Purpose:

Plan and track debts to friends, family, partner, or other creditors.

Fields:

* debt id
* creditor
* starting amount
* remaining amount
* start date
* target payoff date
* planned monthly payment
* priority
* active
* linked transactions
* notes

Rules:

* debt payment transactions reduce remaining debt
* debt payments can feed cashflow
* debt payoff progress should be visible
* debt module should warn if planned payments are not enough by target date

Views:

* active debts
* debt payoff calendar
* monthly debt payment total
* debt remaining over time
* paid this month
* target payoff risk

---

## 8. Settlement / couple sharing module

Purpose:

Track shared spending between Griseld and Alba.

Problem:

One person often pays expenses for the household. The system should calculate who owes whom.

Inputs:

* transaction payer
* split method
* amount
* category
* date
* shared or personal
* reimbursement transactions

Split methods:

* 50/50
* only Griseld
* only Alba
* custom percentage later

Output:

* Griseld owes Alba
* Alba owes Griseld
* reimbursements paid
* net open amount
* settlement status by month

Important rule:

Reimbursement must reduce open settlement.

Example:

Griseld owes Alba €100.
Griseld reimburses €40.
Open amount becomes €60.

Views:

* current month settlement
* previous month settlements
* open reimbursements
* reimbursement history
* settlement close status

---

## 9. Cashflow module

Purpose:

Show expected liquidity over time.

This is not the same as envelope budgeting.

Cashflow answers:

* Will we run out of money before salary?
* Can we afford this purchase on a specific date?
* What happens if salary arrives late?
* What happens if one income is missing?
* What is the lowest expected cash balance this month?

Inputs:

* starting balance
* planned income
* fixed bills
* variable forecast
* debt payments
* goal savings
* one-off expenses
* scenarios

Outputs:

* daily cashflow rows
* running free cash
* running total cash
* minimum cash
* risk status
* event list
* generated timestamp
* scenario name
* starting balance source

Scenarios:

* Normal
* Safe mode
* Conservative
* Strict
* No minijob
* No assistance income
* Griseld salary missing
* Alba salary missing
* Griseld salary late
* Alba salary late
* Wedding/travel month

Rules:

* Cashflow must be generated with a visible timestamp.
* Cashflow must show selected month, scenario, and starting balance source.
* Cashflow must warn if stale.
* Cashflow should not pretend to be real transactions.

---

## 10. Variable forecast module

Purpose:

Estimate flexible spending by category.

Examples:

* groceries
* fuel
* cigarettes
* restaurants
* clothes
* gifts
* household items
* pharmacy
* mixed expenses

Inputs:

* budget amount
* actual spending this month
* historical median spending
* lookback months
* budget weight
* start rule
* forecast method
* active flag
* account
* notes

Forecast methods:

* daily spread
* weekly spread
* one reserve
* custom day

Start rules:

* from month start
* from today
* from first income
* from salary day
* manual start day

Outputs:

* remaining forecast
* final monthly forecast
* confidence
* budget-led/history-led label
* cashflow rows

---

## 11. Affordability module

Purpose:

Answer whether a purchase is safe.

Inputs:

* purchase name
* amount
* purchase date
* account
* priority
* shared/personal
* can wait?
* scenario

Checks:

* cash available on purchase date
* lowest cash after purchase
* account balance
* emergency fund impact
* goal impact
* debt plan impact
* upcoming bills
* income uncertainty

Output:

* safe
* risky
* wait
* not recommended
* suggested safe date
* notes explaining why

---

## 12. Subscriptions module

Purpose:

Track recurring services and decide what to cancel.

Fields:

* name
* amount
* frequency
* next payment
* account
* category
* active
* used
* cancel?
* yearly cost
* notes

Outputs:

* monthly cost
* yearly cost
* next due list
* cancel candidates
* cashflow impact

---

## 13. Deadlines module

Purpose:

Track important financial/admin dates.

Examples:

* insurance payment
* tax deadline
* car tax
* work/admin deadline
* contract renewal
* warranty deadline
* documents
* NASpI deadline

Fields:

* deadline
* area
* task
* amount
* priority
* status
* reminder date
* days left
* risk
* notes

Outputs:

* overdue
* urgent
* due soon
* cashflow impact if amount exists

---

## 14. Monthly Close module

Purpose:

Guide month-end and month-start routine.

End-month process:

1. stop new edits briefly
2. import pending transactions
3. run system check
4. enter real account balances
5. reconcile differences
6. check shared settlement
7. record reimbursements if paid
8. update debt payments
9. update actual savings
10. create net worth snapshot
11. enter real end cash
12. refresh monthly overview
13. confirm month only if differences are explained

Start-month process:

1. review income plan
2. review fixed bills
3. review goals
4. review debts
5. refresh variable forecast
6. generate cashflow
7. confirm starting balance
8. check cashflow risk
9. check affordability for planned purchases
10. check subscriptions
11. check deadlines
12. confirm month ready

Features:

* guided assistant
* resumable steps
* asks for real values
* stops when user wants to check
* records close report
* prevents month confirmation with unresolved issues

---

## 15. Monthly Overview module

Purpose:

Yearly scoreboard.

Shows for every month:

* suggested start cash
* confirmed start cash
* income actual
* expenses actual
* debt paid actual
* savings actual
* savings planned
* debt planned
* expected end cash
* real end cash
* difference
* confirmed?
* debt remaining
* net worth
* savings rate
* status
* notes

Important rules:

* should support multiple years
* should preserve historical values
* should not overwrite manual confirmations
* actual savings must be real moved money
* planned savings must stay separate

---

## 16. Account Control module

Purpose:

Check if account balances are correct.

Fields:

* account
* owner
* expected balance
* real balance
* difference
* status
* notes

Rules:

* real balance must be manually confirmed
* unresolved differences block monthly close
* cash accounts must be included
* savings accounts must be included
* investment accounts can be included later

---

## 17. System Check module

Purpose:

Catch silent failures.

Checks:

* unknown account
* unknown category
* unknown transaction type
* duplicate transaction id
* missing immutable id
* imported row missing in Actual
* Actual row missing finance-plus id
* stale cashflow
* unresolved account difference
* unconfirmed monthly close
* missing budget month
* invalid scenario
* goal without linked category
* debt without payment plan
* reimbursement not matched
* source data older than report
* row capacity if spreadsheet import mode is still used

Output:

* PASS
* WARNING
* ERROR
* blocker count
* details
* last run timestamp

Control Center should show the global status.

---

## 18. Investments module

Purpose:

Track investments and simulate long-term ETF growth.

Sections:

* current investments
* monthly investment plan
* compound projection
* scenario comparison
* inflation-adjusted value
* portfolio summary

Inputs:

* starting amount
* monthly contribution
* contribution increase per year
* return type: annual or monthly
* expected return
* inflation assumption
* years
* broker
* asset / ETF
* current value
* fees

Outputs:

* final nominal value
* inflation-adjusted value
* total contributions
* estimated gains
* real return after inflation
* investment progress
* net worth integration

---

## 19. Control Center

Purpose:

One home page that tells the user what needs attention.

Cards:

* System Check status
* pending imports
* account control status
* cashflow status
* monthly close status
* upcoming deadlines
* subscriptions to review
* settlement open
* debt status
* goal progress
* affordability shortcut
* net worth snapshot status

This is the daily entry page.

---

## 20. Development rules for Codex

Rules:

1. Do not change Actual core budget calculations unless explicitly asked.
2. Add Finance Plus modules in isolated folders.
3. Use an adapter for all Actual data access.
4. Keep product data separate from Actual core data.
5. Do not hardcode category names, account names, transaction types, or scenario names.
6. Add typed models for all Finance Plus data.
7. Add tests for each module.
8. Add migration scripts for Finance Plus data.
9. Add clear UI labels and notes.
10. Make all generated outputs stamped with time, source, and scenario.
11. Use feature flags where possible.
12. Keep upstream merges easy.

Suggested folder layout:

`packages/finance-plus/`

* `actual-adapter/`
* `cashflow/`
* `goals/`
* `debts/`
* `settlements/`
* `monthly-close/`
* `account-control/`
* `affordability/`
* `subscriptions/`
* `deadlines/`
* `investments/`
* `system-check/`
* `control-center/`

---

## 21. MVP order

### MVP 1 — Read-only Finance Plus

Build pages that read Actual data and calculate insights.

* Control Center
* Cashflow
* Monthly Overview
* Goals
* Debts
* Account Control
* System Check

No writing to Actual yet except reading data.

### MVP 2 — Controlled writes

Add safe write actions.

* create planned transactions
* create account transfers
* record reimbursements
* mark debt payment
* create net worth snapshot
* save monthly close

### MVP 3 — Advanced planning

* affordability
* variable forecast
* subscriptions
* deadlines
* investment planner
* scenarios

### MVP 4 — Product polish

* onboarding
* settings
* household members
* owner/split rules
* export
* backup/restore
* paid hosting if desired

---

## 22. Core principle

Actual answers:

“Where is my money and how is it budgeted?”

Finance Plus answers:

“What is going to happen, what should I do next, and is the system safe?”

The final product should combine both into one interface without mixing their core logic.
