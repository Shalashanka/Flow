# TASK002 — Rebrand Visible Actual Budget UI to Flow and Add Integrated Flow Placeholder Pages

## Role

You are the implementation AI working inside the Flow repository.

The planner has reviewed TASK001. The project scaffold is now ready.

This task is the first visible product task.

You must execute carefully, document everything, and produce a detailed result report.

---

# 1. Repository reality

The repository root is:

```text
C:\dev\Flow
```

This is the Git-tracked Flow fork.

All implementation code, assets, tasks, and reports must stay inside this repository.

The Codex task/report system currently lives here:

```text
AGENT_INSTRUCTIONS/CODEX/
  tasks/
  reports/
  notes/
```

For this task, write the result report to:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK002_RESULT.md
```

Do not create a second competing `CODEX/` root unless explicitly instructed.

---

# 2. Goal of TASK002

Rebrand visible user-facing Actual Budget branding to **Flow** and add integrated placeholder pages for future Flow modules.

This task should make the app visibly become Flow, while preserving Actual’s core functionality.

This is still mostly a shell/integration task.

Do not implement real Flow business logic yet.

---

# 3. Product direction

Flow is not a separate app.

Flow is a rebranded and expanded fork of Actual Budget.

There must be:

* one app shell
* one sidebar
* one product identity: Flow
* one shared UI
* Actual core budgeting pages still working
* Flow modules added as normal first-class app pages

There must NOT be:

* a separate Flow home page
* a separate Flow dashboard app
* a duplicate app shell
* a disconnected Flow sub-product

Flow feature pages should appear in the existing sidebar/navigation just like normal Actual pages.

---

# 4. Non-negotiable constraints

Do not modify Actual core budget calculations.

Do not modify Actual database table structures.

Do not modify sync behavior.

Do not modify CRDT logic.

Do not implement real Cashflow logic yet.

Do not implement real Goals logic yet.

Do not implement real Debts logic yet.

Do not implement real Flow persistence yet.

Do not create Flow migrations yet.

Do not blindly rename technical identifiers.

Do not break existing Actual/Flow pages.

---

# 5. Rebranding scope

Replace visible user-facing branding from:

```text
Actual
Actual Budget
```

to:

```text
Flow
```

Focus on user-visible product identity.

Likely areas to inspect and update:

* browser title
* app title
* sidebar/app header
* login/setup screens
* loading/splash screens
* settings/about pages
* visible product labels
* public/static visible copy
* image alt text where appropriate
* favicon/app icon references if simple and safe
* metadata where appropriate

---

# 6. Important branding warning

Do not blindly rename internal technical references.

Some names may need to remain unchanged for now, for example:

* package names such as `@actual-app/...`
* internal imports
* internal folder names
* database table names
* migration names
* sync/protocol identifiers
* license attribution
* comments that are not user-facing
* upstream references required by MIT license attribution

The task is visible branding first, not dangerous internal renaming.

If you find internal `Actual` references, classify them in the report as:

* changed because user-facing
* intentionally left unchanged because technical/internal
* uncertain and needs planner review

---

# 7. Brand assets

Locate current brand assets.

Look for:

* main logo
* favicon
* app icon
* web manifest icons
* splash/loading image
* Electron/desktop icons if present
* public/static image assets
* any logo SVGs
* any PNG app icons

Prepare or replace them with temporary Flow assets if safe.

Flow visual direction:

* minimalist
* modern
* premium
* fintech-like
* calm
* clean
* abstract movement / money flow / data flow / balance

If final assets are not available, create clear placeholder assets or prepare the asset paths and document what still needs replacement.

Do not spend excessive time perfecting graphic design in code.

---

# 8. Integrated Flow placeholder pages

Add placeholder pages for future Flow modules.

These pages must open inside the existing app shell.

Add sidebar/navigation entries for:

* Cashflow
* Goals
* Debts
* Monthly Close
* Account Control
* Settlement
* Affordability
* Subscriptions
* Deadlines
* Investments
* System Check
* Monthly Overview

Each placeholder page should show:

* title
* short explanation
* “Coming soon” / “Under construction”
* no real data queries yet
* no database writes
* no business logic

Example placeholder text:

```text
Cashflow

Coming soon.

This page will forecast future liquidity using transactions, planned income, recurring bills, goals, debts, and scenarios.
```

---

# 9. No separate Flow home page

Do not create:

```text
/flow
```

as a Flow home/dashboard page.

Do not create a “Flow Home” page.

Instead, add individual pages directly, for example:

```text
/cashflow
/goals
/debts
/monthly-close
/account-control
/settlement
/affordability
/subscriptions
/deadlines
/investments
/system-check
/monthly-overview
```

Use route names that fit the existing app’s routing conventions.

If the existing app requires nested routes, follow the existing style, but do not create a separate Flow app shell.

---

# 10. Existing home/start page shortcut buttons

Find the existing app home/start/dashboard page if one exists.

If it is safe and simple, add shortcut buttons/cards to future Flow pages:

* Cashflow
* Goals
* Debts
* Monthly Close
* Affordability
* System Check

Important:

These are just shortcuts on the existing app page.

This is not a separate Flow home page.

If the existing home/start page is unclear or risky to modify, do not modify it. Instead, document exactly where it should be changed in a future task.

---

# 11. Preferred code placement

Use the structure created in TASK001 where appropriate.

Possible locations:

```text
packages/flow/src/ui/
packages/flow/src/shared/
packages/flow/src/domain/
```

However, because this repo is an existing Actual web app, placeholder React pages may need to live where the existing app can import them cleanly.

If imports from `packages/flow` are not yet wired or are risky, create the minimal placeholder pages inside the existing UI package but keep them clearly isolated, for example:

```text
packages/desktop-client/src/flow/
  pages/
  components/
```

Choose the least risky approach that works with the existing bundler.

Document the choice in the report.

---

# 12. Minimal integration philosophy

Touch as few Actual core files as possible.

Expected integration points may include:

* sidebar/navigation registration
* route registration
* app title/branding file
* logo/icon asset references
* page component imports

Avoid touching:

* budget calculation files
* database schema files
* sync files
* CRDT files
* transaction calculation engine
* migrations
* server persistence logic

---

# 13. Reports required

Create:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK002_RESULT.md
```

The report must include:

```markdown
# TASK002 Result — Flow Rebrand and Placeholder Navigation

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. Branding References Changed

## 5. Branding References Intentionally Left Unchanged

## 6. Brand Asset Locations Found

## 7. Brand Assets Changed or Prepared

## 8. Placeholder Pages Added

## 9. Sidebar / Navigation Changes

## 10. Existing Home/Start Page Changes

## 11. Commands Run

## 12. Command Results

## 13. What Worked

## 14. What Did Not Work

## 15. Risks / Concerns

## 16. Items To Finish Later

## 17. Recommended Next Task
```

Recommended next task should likely be:

```text
TASK003 — Build the first real Flow module: Cashflow read-only prototype using Actual data through an adapter or safest existing data access path.
```

But if TASK002 discovers problems, recommend the next task based on those findings.

---

# 14. Commands to run

Use the checked-in Yarn release because global Yarn/Corepack is unreliable on this machine.

Preferred command format:

```bash
node .yarn/releases/yarn-4.13.0.cjs <command>
```

After changes, run the most feasible checks.

At minimum:

```bash
node scripts/flow/check-flow-layout.mjs
```

If dependencies are installed:

```bash
node .yarn/releases/yarn-4.13.0.cjs flow:check-layout
```

Then run one or more if feasible:

```bash
node .yarn/releases/yarn-4.13.0.cjs lint
node .yarn/releases/yarn-4.13.0.cjs typecheck
node .yarn/releases/yarn-4.13.0.cjs test
```

If lint/typecheck/test fail because of pre-existing repository issues, document the exact failure and whether new files pass targeted checks.

Do not hide failures.

---

# 15. Definition of done

TASK002 is complete only when:

* visible app branding says Flow where appropriate
* browser/app title says Flow where appropriate
* visible Actual Budget branding is replaced where safe
* technical/internal Actual references are not blindly renamed
* brand asset locations are identified
* temporary Flow brand assets are added or asset replacement plan is documented
* sidebar/navigation includes placeholder entries for the listed Flow modules
* each placeholder page opens in the existing app shell
* no separate Flow home page exists
* existing Actual/Flow core pages still work
* no core budget calculations were changed
* no database schema changes were made
* no sync logic was changed
* `AGENT_INSTRUCTIONS/CODEX/reports/TASK002_RESULT.md` exists and is detailed

---

# 16. Final instruction

Work incrementally.

Before editing, identify the expected files to touch.

After editing, document exactly what changed.

Do not jump to TASK003.

Do not implement real Flow module logic yet.

Do the rebrand, placeholders, assets preparation, reports, and stop.
