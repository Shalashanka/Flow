# TASK004B — Fix Flow Settings UI Layout and Usability

## Role

You are the implementation AI working inside the Flow repository.

TASK004 created the Flow Settings foundation. Functionally it works, but the current UI is visually broken, cramped, and too spreadsheet-like.

This task fixes the Flow Settings page layout before moving on to Scenario Builder, Cashflow Forecast, Runway, or any other real Flow modules.

Do not implement new business logic in this task.

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
AGENT_INSTRUCTIONS/CODEX/reports/TASK004B_RESULT.md
```

Do not create reports outside:

```text
AGENT_INSTRUCTIONS/CODEX/reports/
```

---

# 2. Goal

Make `/flow-settings` visually usable, clean, readable, and stable.

The page currently has these problems:

* sections are too compressed vertically
* controls overlap labels and helper text
* action buttons float awkwardly inside section headers
* editable rows look like a broken spreadsheet
* the Scenarios section is visibly broken
* the JSON area starts too close to previous controls
* table rows do not have enough height
* fields do not wrap nicely on narrower widths
* the page feels like raw developer UI, not a real product settings page
* some top-section clicks may be affected by titlebar/scroll overlay behavior

Fix the UX/layout before adding more complexity.

---

# 3. Non-negotiable constraints

Do not modify Actual core budget calculations.

Do not modify Actual database schemas.

Do not create migrations.

Do not modify sync behavior.

Do not modify CRDT logic.

Do not implement projected Cashflow yet.

Do not implement Scenario Builder yet.

Do not implement Runway / Time to Broke yet.

Do not add Quick Entry yet.

Do not add Goals, Debts, Settlement, Investments, or Monthly Close logic.

Do not remove existing TASK004 functionality.

---

# 4. Preserve existing functionality

The following must continue working exactly as before:

* household members add/edit/remove
* transaction rules edit
* cashflow parameters edit
* income plans add/edit/remove
* fixed bills add/edit/remove
* variable spending rules add/edit/remove
* scenarios add/edit/remove
* save
* reset to defaults
* export JSON
* import JSON
* local storage persistence with `flow.settings.v1`
* account/category dropdowns using Actual IDs
* no writes to Actual transactions/accounts/categories/budgets

---

# 5. Product/UX principle

Flow Settings is not only Cashflow settings.

It is the global configuration area for Flow.

It must feel like a serious product configuration page, not a spreadsheet.

The page should start simple and stay readable, because later it will become the foundation for:

* Quick Entry form
* Flow Transactions view
* Cashflow Forecast
* Scenario Builder
* Settlement
* Runway / Time to Broke
* Affordability
* Monthly Close
* Reports

The user should be able to understand the page without reading code.

---

# 6. Required layout direction

Use clear cards or panels.

Each section should have:

* title
* short description
* action button on the right if needed
* enough padding
* enough vertical spacing
* no overlapping text or controls
* controls aligned cleanly
* responsive wrapping

Preferred page structure:

```text
Flow Settings

Top status/action bar:
- local storage notice
- last updated
- Save
- Reset
- Export
- Import

Sections:
1. Household
2. Transaction Rules
3. Cashflow Parameters
4. Income Plan
5. Fixed Bills
6. Variable Spending
7. Scenarios
8. JSON Import / Export
```

---

# 7. Page container requirements

Use a reasonable maximum width.

Suggested:

```text
max-width: 1180px or 1200px
```

The page should not stretch awkwardly across ultra-wide screens.

Add enough bottom padding so the last section is not hidden by browser/app chrome.

The page should look good at:

* 1920px desktop width
* 1366px laptop width
* approximately tablet width if easy

Do not prioritize mobile perfection yet, but avoid layouts that completely break on narrower windows.

---

# 8. Section card requirements

Every main section should be a distinct card.

Each card should contain:

```text
header row
description/helper text
content area
```

Header row:

* title on the left
* action button on the right
* no overlap
* no absolute positioning unless truly necessary

Content area:

* clean vertical spacing
* rows/cards separated clearly
* no negative margins
* no overlapping labels
* no controls over helper text

---

# 9. Form control requirements

Inputs/selects must not overlap labels.

Labels should be above fields or clearly associated with fields.

Editable rows must be tall enough.

Recommended minimum row/sub-card height:

```text
48px to 56px minimum
```

For larger editable items, use sub-cards rather than cramped table rows.

---

# 10. Preferred pattern for editable lists

For sections like:

* Household
* Income Plan
* Fixed Bills
* Variable Spending
* Scenarios

Prefer **sub-cards per item** instead of dense table rows, unless a clean responsive table is already easy.

Sub-card pattern:

```text
[Item title / name]                         [Remove]

Name              Amount / Role / Type
Account           Category
Active checkbox   Notes
```

This is more readable and less likely to break.

If using CSS grid, make sure fields wrap cleanly.

---

# 11. Section-specific requirements

## Household

Use one sub-card per household member.

Fields:

* Name
* Role
* Default account
* Active
* Remove

Button:

```text
Add household member
```

No table header overlap.

---

## Transaction Rules

Use a simple two-column grid.

Fields:

* Default paid by
* Default entered by
* Default split method
* Include in cashflow by default

Add short helper text:

```text
These defaults will later be used by Quick Entry, Flow Transactions, Settlement, and Cashflow.
```

---

## Cashflow Parameters

Use a two-column or three-column grid.

Fields:

* Minimum safe balance
* Warning balance
* Projection mode
* Default scenario
* Starting balance mode
* Include off-budget accounts
* Include transfers

Add short helper text:

```text
These settings define how Flow will later build projected monthly cashflow.
```

---

## Income Plan

Use sub-cards per income plan.

Each item should include:

* Name
* Amount
* Day of month
* Account
* Category
* Active
* Uncertain
* Notes
* Remove

Button:

```text
Add income plan
```

Empty state:

```text
No income plans yet.
```

---

## Fixed Bills

Use sub-cards per fixed bill.

Each item should include:

* Name
* Amount
* Day of month
* Account
* Category
* Split method
* Active
* Notes
* Remove

Button:

```text
Add fixed bill
```

Empty state:

```text
No fixed bills yet.
```

---

## Variable Spending

Use sub-cards per variable spending rule.

Each item should include:

* Name
* Category
* Monthly budget
* Forecast method
* Budget weight
* Active
* Notes
* Remove

Button:

```text
Add variable spending rule
```

Empty state:

```text
No variable spending rules yet.
```

---

## Scenarios

This section must be fixed especially.

Use sub-cards per scenario.

Each item should include:

* Name
* Type
* Income multiplier
* Expense multiplier
* Savings multiplier
* Active
* Notes
* Remove

Button:

```text
Add scenario
```

Empty state:

```text
No scenarios yet.
```

Do not build the future rule-based scenario builder in this task. That will be TASK005.

Just make the existing simple scenario rows look clean and usable.

---

## JSON Import / Export

Put this at the bottom.

If easy, make it collapsible using a native `<details>` element or existing app component.

If not, keep it as a bottom card.

It should include:

* explanation
* textarea
* Export JSON
* Import JSON

The JSON textarea should not dominate the page by default.

If using collapsible details, default it to closed unless there is an import/export status message.

---

# 12. Top action bar

Create a clean top action card or toolbar.

It should show:

* local storage warning/notice
* saved/unsaved status if available
* last updated
* Save
* Reset to defaults
* Export JSON
* Import JSON

Buttons should align to the right where possible.

Buttons must not overlap the first section below.

Text should wrap cleanly on smaller widths.

---

# 13. Tooltips / helper text

Do not build a full tooltip system yet unless one already exists and is easy to use.

But add short inline helper text where it matters.

Examples:

For household:

```text
Household members can later be used for who paid, who entered a transaction, and split/settlement rules.
```

For variable spending:

```text
Variable spending rules estimate flexible monthly costs that are not fixed bills.
```

For scenarios:

```text
Simple scenario multipliers are temporary. A rule-based scenario builder will be added later.
```

---

# 14. Styling

Use existing Flow/Actual styles and components.

Do not introduce a separate design system.

Do not use random colors.

Keep it consistent with the app theme.

The goal is:

```text
clean, usable, professional, no overlapping
```

Not:

```text
final polished marketing UI
```

---

# 15. Implementation guidance

Likely file:

```text
packages/desktop-client/src/flow/FlowSettingsPage.tsx
```

You may create Flow-specific helper components if useful.

Suggested possible files:

```text
packages/desktop-client/src/flow/settings/SettingsSection.tsx
packages/desktop-client/src/flow/settings/FieldGrid.tsx
packages/desktop-client/src/flow/settings/EditableItemCard.tsx
```

Keep Flow-specific UI helpers inside:

```text
packages/desktop-client/src/flow/
```

Do not scatter them into generic Actual component folders unless there is a strong reason.

---

# 16. Validation commands

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

If full repo lint fails because of pre-existing formatting issues, document it but do not block the task if the changed files pass targeted checks.

---

# 17. Browser smoke test

Open:

```text
http://localhost:3001/flow-settings
```

Test:

1. page loads without fatal error
2. no controls overlap
3. top buttons are clickable
4. add household member
5. add income plan
6. add fixed bill
7. add variable spending rule
8. add scenario
9. save
10. reload
11. confirm data persists
12. export JSON
13. reset
14. import JSON
15. confirm data restores
16. test at a narrower browser width if feasible

Document the smoke test.

---

# 18. Result report

Create:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK004B_RESULT.md
```

The report must include:

```markdown
# TASK004B Result — Flow Settings UI Layout Fix

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. Layout Problems Fixed

## 5. UI Structure Implemented

## 6. Functionality Preserved

## 7. Commands Run

## 8. Command Results

## 9. Browser Smoke Test

## 10. What Worked

## 11. What Did Not Work

## 12. Risks / Concerns

## 13. Items To Finish Later

## 14. Recommended Next Task
```

Recommended next task should be:

```text
TASK005 — Build Flow Scenario Builder and Parameterization Foundation.
```

Unless TASK004B discovers a blocker.

---

# 19. Definition of done

TASK004B is complete only when:

* `/flow-settings` no longer looks visually broken
* no section content overlaps
* controls are readable and clickable
* Scenarios section is visually fixed
* JSON section is usable
* save/reset/import/export still work
* local storage persistence still works
* account/category dropdowns still work
* no Actual core calculations changed
* no database schemas changed
* no sync logic changed
* no projected Cashflow implemented
* no rule-based Scenario Builder implemented
* result report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK004B_RESULT.md`

---

# 20. Final instruction

Do not jump ahead.

This is a UX stabilization task.

Fix the Flow Settings page, verify it, write the report, and stop.
