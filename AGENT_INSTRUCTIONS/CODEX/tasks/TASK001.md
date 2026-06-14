# TASK001 — Bootstrap Flow Internal Project Structure and Codex Reporting Protocol

## Role

You are the implementation AI working inside the Flow repository.

The human owner is building **Flow**, a rebranded and expanded fork of Actual Budget.

The planner will provide numbered tasks. You execute them carefully, report back in Markdown, and do not jump ahead.

---

# 1. Current repository reality

The repository root is:

```text
C:\dev\Flow
```

This folder is the Git-tracked fork of Actual Budget, already renamed/rebranded as the Flow repository.

All Flow source code, project folders, reports, scripts, assets, and future modules must live inside:

```text
C:\dev\Flow
```

Do not create Flow implementation folders outside this repository.

Correct examples:

```text
C:\dev\Flow\packages\flow\
C:\dev\Flow\CODEX\tasks\
C:\dev\Flow\CODEX\reports\
C:\dev\Flow\docs\
C:\dev\Flow\flow-assets\
C:\dev\Flow\packages\desktop-client\src\flow\
```

Incorrect examples:

```text
C:\dev\packages\flow\
C:\dev\flow-external\
C:\dev\Flow-external\
C:\dev\AI-output-outside-repo\
```

Everything important must be inside `C:\dev\Flow` so Git tracks it.

---

# 2. Goal of this task

Create the internal Flow project structure and Codex reporting system.

This task prepares the repo for future implementation work.

This task does not implement real Flow features yet.

This task does not perform the full rebrand yet.

This task does not change Actual/Flow budgeting logic.

This task does not change database structures.

This task only creates safe folders, documentation, placeholders, and reporting conventions.

---

# 3. Non-negotiable reporting rule

Every Codex task must produce a report Markdown file.

Reports must be saved in:

```text
CODEX/reports/
```

Report filename format:

```text
TASK001_RESULT.md
TASK002_RESULT.md
TASK003_RESULT.md
```

Each report must explain:

- what was requested
- what files were created
- what files were modified
- what worked
- what did not work
- commands run
- command results
- errors or blockers
- risks introduced
- what must be finished later
- recommended next task
- any important notes for the planner

The planner relies on these report files to decide the next step.

Do not finish a task without creating the report.

---

# 4. Folder structure to create

Create or verify this structure inside the repository root:

```text
CODEX/
  tasks/
  reports/
  notes/

packages/
  flow/
    package.json
    README.md
    src/
      index.ts
      actual-adapter/
        index.ts
      domain/
        README.md
      persistence/
        README.md
      ui/
        README.md
      shared/
        README.md

flow-assets/
  README.md

scripts/
  flow/
    check-flow-layout.mjs

docs/
```

If some folders already exist, preserve them and extend them safely.

Do not delete existing repository files.

---

# 5. Create `CODEX/` task system

Create:

```text
CODEX/tasks/
CODEX/reports/
CODEX/notes/
```

Create:

```text
CODEX/README.md
```

The README must explain:

- Codex executes tasks from `CODEX/tasks/`
- Codex writes reports to `CODEX/reports/`
- every task must have a result report
- reports must be detailed enough for the planner to continue
- Codex must not silently skip errors
- Codex must not jump ahead to future tasks

Create or copy this task into:

```text
CODEX/tasks/TASK001.md
```

If the user manually already created `TASK001.md`, do not duplicate it unnecessarily. Instead, make sure the task is present in `CODEX/tasks/`.

---

# 6. Create `packages/flow`

Create the Flow module package:

```text
packages/flow/
```

This is the future home for Flow-owned modules that should be kept separate from the original Actual core logic.

Create:

```text
packages/flow/package.json
packages/flow/README.md
packages/flow/src/index.ts
packages/flow/src/actual-adapter/index.ts
packages/flow/src/domain/README.md
packages/flow/src/persistence/README.md
packages/flow/src/ui/README.md
packages/flow/src/shared/README.md
```

Suggested `packages/flow/package.json`:

```json
{
  "name": "@flow/core",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "main": "src/index.ts"
}
```

If this conflicts with the existing workspace setup, adjust minimally and document the decision in the report.

---

# 7. `packages/flow/README.md` content

The README must explain:

Flow is a product layer inside the Flow fork of Actual Budget.

Actual/Flow core remains the source of truth for:

- accounts
- transactions
- categories
- payees
- budgets
- transfers
- sync behavior
- budget files

Flow-owned modules will add:

- cashflow
- goals
- debts
- settlement
- monthly close
- account control
- affordability
- subscriptions
- deadlines
- investments
- system check
- monthly overview

Flow modules must avoid changing core budgeting calculations.

Flow modules should later read Actual data through an adapter.

Flow-specific metadata should later reference Actual records by ID, not by display name.

Example:

```ts
flowGoal.linkedCategoryId = actualCategoryId;
flowGoal.linkedAccountId = actualAccountId;
```

Avoid name-based matching except during import/mapping.

---

# 8. Create adapter placeholder

Create:

```text
packages/flow/src/actual-adapter/index.ts
```

The adapter should contain placeholder types only.

Do not wire real Actual internals yet.

Use this as a starting point:

```ts
export type ActualId = string;

export type FlowDateRange = {
  start: string;
  end: string;
};

export type FlowAccountSummary = {
  id: ActualId;
  name: string;
  closed?: boolean;
  offBudget?: boolean;
};

export type FlowCategorySummary = {
  id: ActualId;
  name: string;
  groupId?: ActualId;
  isIncome?: boolean;
  hidden?: boolean;
};

export type FlowTransactionSummary = {
  id: ActualId;
  accountId: ActualId;
  categoryId?: ActualId;
  payeeId?: ActualId;
  date: string;
  amount: number;
  notes?: string;
};

export interface ActualAdapter {
  getAccounts(): Promise<FlowAccountSummary[]>;
  getCategories(): Promise<FlowCategorySummary[]>;
  getTransactions(range: FlowDateRange): Promise<FlowTransactionSummary[]>;
}

export class NotImplementedActualAdapter implements ActualAdapter {
  async getAccounts(): Promise<FlowAccountSummary[]> {
    throw new Error('ActualAdapter.getAccounts is not implemented yet.');
  }

  async getCategories(): Promise<FlowCategorySummary[]> {
    throw new Error('ActualAdapter.getCategories is not implemented yet.');
  }

  async getTransactions(
    _range: FlowDateRange,
  ): Promise<FlowTransactionSummary[]> {
    throw new Error('ActualAdapter.getTransactions is not implemented yet.');
  }
}
```

---

# 9. Create module placeholder READMEs

Create:

```text
packages/flow/src/domain/README.md
packages/flow/src/persistence/README.md
packages/flow/src/ui/README.md
packages/flow/src/shared/README.md
```

## `domain/README.md`

Explain that this folder will contain Flow business logic modules:

```text
cashflow
goals
debts
settlements
monthly-close
account-control
affordability
subscriptions
deadlines
investments
system-check
monthly-overview
```

## `persistence/README.md`

Explain that this folder will later contain Flow-specific persistence logic.

Important rules:

- do not modify Actual core tables without explicit approval
- Flow-owned data should reference Actual IDs
- Flow metadata must stay logically separate from core budgeting data

## `ui/README.md`

Explain:

- Flow pages will be integrated into the existing app sidebar
- there must be no separate Flow home page
- Flow pages should feel native in the same product
- placeholder pages will be added in a later task

## `shared/README.md`

Explain this folder is for shared Flow types, constants, helpers, and validation utilities.

---

# 10. Create `flow-assets`

Create:

```text
flow-assets/
flow-assets/README.md
```

The README must explain this folder is for Flow brand assets, such as:

- logo concepts
- final logo files
- favicon source
- app icons
- splash images
- social preview images
- brand color notes

Do not replace application assets yet.

Actual app assets will be replaced during Task002.

---

# 11. Create safety script

Create:

```text
scripts/flow/check-flow-layout.mjs
```

Purpose:

Check that required Flow folders exist and that task reports folder exists.

It should check for:

```text
CODEX/tasks
CODEX/reports
packages/flow
packages/flow/src
packages/flow/src/actual-adapter
flow-assets
```

If missing, print a clear failure and exit with non-zero code.

If present, print:

```text
PASS: Flow project layout is present.
```

Optional but useful:

Also check that `CODEX/reports` exists and is writable.

---

# 12. Root package scripts

Inspect the existing root `package.json`.

If safe, add:

```json
{
  "scripts": {
    "flow:check-layout": "node scripts/flow/check-flow-layout.mjs"
  }
}
```

Do not break existing scripts.

If modifying `package.json` is risky, do not do it. Document the reason in the report.

---

# 13. Create TASK001 result report

Create:

```text
CODEX/reports/TASK001_RESULT.md
```

The report must include:

```markdown
# TASK001 Result — Flow Internal Project Bootstrap

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. Folder Structure Created

## 5. Commands Run

## 6. Command Results

## 7. What Worked

## 8. What Did Not Work

## 9. Risks / Concerns

## 10. Items To Finish Later

## 11. Recommended Next Task
```

The recommended next task should be:

```text
TASK002 — Rebrand visible Actual Budget UI to Flow, replace/prepare brand assets, and add integrated sidebar placeholder pages.
```

---

# 14. Commands to run

After creating the scaffold, run:

```bash
node scripts/flow/check-flow-layout.mjs
```

If a package script was added, also run:

```bash
yarn flow:check-layout
```

If the app dependencies are already installed and the environment is ready, optionally run:

```bash
yarn lint
```

If lint is too slow or fails for unrelated existing reasons, document the exact output in the report.

Do not hide failures.

---

# 15. Definition of done

TASK001 is complete only when:

- `CODEX/tasks/` exists
- `CODEX/reports/` exists
- this task exists in `CODEX/tasks/TASK001.md`
- `packages/flow/` exists
- Flow adapter placeholder exists
- domain/persistence/ui/shared placeholder folders exist
- `flow-assets/` exists
- layout check script exists
- layout check script runs
- `CODEX/reports/TASK001_RESULT.md` exists
- no real Flow feature logic is implemented yet
- no full rebrand is done yet
- no sidebar pages are added yet
- no database schema changes are made
- no core budget calculations are changed

---

# 16. Final instruction

Be conservative.

This task is only the foundation.

Do not start Task002.

Do not rebrand yet.

Do not add sidebar pages yet.

Do not implement Cashflow, Goals, Debts, or any other module yet.

Create the structure, run checks, write the report, and stop.
