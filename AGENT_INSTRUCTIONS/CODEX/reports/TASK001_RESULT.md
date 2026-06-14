# TASK001 Result - Flow Internal Project Bootstrap

## 1. Summary

TASK001 requested a conservative project bootstrap for Flow inside `C:\dev\Flow`.

Completed:

- Created the `CODEX` task, report, and notes structure.
- Copied the task into `AGENT_INSTRUCTIONS/CODEX/tasks/TASK001.md`.
- Created the `packages/flow` workspace package with placeholder adapter types and documentation.
- Created the `flow-assets` placeholder folder.
- Created a root `docs` placeholder folder.
- Added `scripts/flow/check-flow-layout.mjs`.
- Added the root `flow:check-layout` package script.
- Ran the layout checks successfully.

Not done by design:

- No Flow feature logic was implemented.
- No rebrand was performed.
- No sidebar pages or routes were added.
- No database schema or migration changes were made.
- No Actual budget calculations were changed.

## 2. Files Created

- `AGENT_INSTRUCTIONS/CODEX/README.md`
- `AGENT_INSTRUCTIONS/CODEX/tasks/TASK001.md`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK001_RESULT.md`
- `AGENT_INSTRUCTIONS/CODEX/notes/.gitkeep`
- `packages/flow/package.json`
- `packages/flow/README.md`
- `packages/flow/src/index.ts`
- `packages/flow/src/actual-adapter/index.ts`
- `packages/flow/src/domain/README.md`
- `packages/flow/src/persistence/README.md`
- `packages/flow/src/ui/README.md`
- `packages/flow/src/shared/README.md`
- `flow-assets/README.md`
- `scripts/flow/check-flow-layout.mjs`
- `docs/.gitkeep`

## 3. Files Modified

- `package.json`
  - Added `flow:check-layout`.
- `yarn.lock`
  - Added the new `@flow/core@workspace:packages/flow` workspace entry required by Yarn after adding `packages/flow`.

## 4. Folder Structure Created

```text

AGENT_INSTRUCTIONS/
  CODEX/
    README.md
    tasks/
      TASK001.md
    reports/
      TASK001_RESULT.md
    notes/
      .gitkeep

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
  .gitkeep
```

## 5. Commands Run

```powershell
Get-ChildItem -Recurse -File AGENT_INSTRUCTIONS
Get-ChildItem -Recurse -File CODEX\tasks
git status --short
Get-Content -Raw AGENTS.md
Get-Content -Raw AGENT_INSTRUCTIONS\FLOW_REPO_MANAGEMENT_FOR_GRISELD_AND_CODEX.md
Get-Content -Raw AGENT_INSTRUCTIONS\FLOW_REPO_ARCHITECTURE_REPORT.md
Get-Content -Raw AGENT_INSTRUCTIONS\readme.md
Get-Content -Raw AGENT_INSTRUCTIONS\walkthrough.md
Get-Content -Raw "AGENT_INSTRUCTIONS\CODEX TASKS\TASK001.md"
git branch --show-current
git remote -v
Get-Content -Raw package.json
New-Item -ItemType Directory -Force ...
Copy-Item "AGENT_INSTRUCTIONS\CODEX TASKS\TASK001.md" CODEX\tasks\TASK001.md
node scripts/flow/check-flow-layout.mjs
yarn flow:check-layout
node .yarn/releases/yarn-4.13.0.cjs flow:check-layout
node .yarn/releases/yarn-4.13.0.cjs install --mode=update-lockfile
node .yarn/releases/yarn-4.13.0.cjs install
node_modules\.bin\oxfmt.cmd --check ...
node_modules\.bin\oxfmt.cmd ...
node .yarn/releases/yarn-4.13.0.cjs lint
git diff --stat
git diff -- package.json yarn.lock scripts\flow\check-flow-layout.mjs packages\flow\src\actual-adapter\index.ts packages\flow\src\index.ts CODEX\README.md packages\flow\README.md flow-assets\README.md
git status --short
```

## 6. Command Results

Repository checks:

- Current branch: `flow-product`
- Remotes:
  - `origin` = `https://github.com/Shalashanka/Flow.git`
  - `upstream` = `https://github.com/actualbudget/actual.git`

Initial layout discovery:

- `AGENT_INSTRUCTIONS/CODEX TASKS/TASK001.md` existed and was copied into `CODEX/tasks/TASK001.md`.

Direct layout check:

```text
PASS: Flow project layout is present.
```

Global Yarn command:

```text
Error: Cannot find module 'C:\Program Files\nodejs\node_modules\corepack\dist\yarn.js'
Node.js v25.8.1
```

Resolution:

- Used checked-in Yarn release at `.yarn/releases/yarn-4.13.0.cjs`.

First checked-in Yarn package script attempt:

```text
Internal Error: @flow/core@workspace:packages/flow: This package doesn't seem to be present in your lockfile; run "yarn install" to update the lockfile
```

Resolution:

- Ran `node .yarn/releases/yarn-4.13.0.cjs install --mode=update-lockfile`.
- This added the required `@flow/core` workspace entry to `yarn.lock`.

Second checked-in Yarn package script attempt:

```text
Usage Error: Couldn't find the node_modules state file - running an install might help (findPackageLocation)
```

Resolution:

- Ran `node .yarn/releases/yarn-4.13.0.cjs install` because this checkout had no `node_modules` directory.
- Install completed with existing peer dependency warnings and build-script warnings from repo settings.

Final checked-in Yarn package script result:

```text
PASS: Flow project layout is present.
```

Targeted formatting check after formatting the new files:

```text
All matched files use the correct format.
```

Full lint result:

```text
Format issues found in above 451 files. Run without `--check` to fix.
```

The full lint command failed during the repository-wide formatting phase. The newly added files were checked separately and pass formatting.

## 7. What Worked

- The Flow scaffold was created inside `C:\dev\Flow`.
- The task file is now present at `CODEX/tasks/TASK001.md`.
- The report file is present at `CODEX/reports/TASK001_RESULT.md`.
- The `packages/flow` package exists and is isolated from Actual core code.
- The adapter contains only placeholder types and a non-wired `NotImplementedActualAdapter`.
- The layout checker works directly with Node.
- The layout checker works through the root package script when using the checked-in Yarn release.
- New scaffold files pass targeted `oxfmt --check`.

## 8. What Did Not Work

- `yarn flow:check-layout` using the global Yarn shim failed because global Corepack/Yarn is broken on this machine.
- The checked-in Yarn package script initially failed until the new workspace was added to `yarn.lock`.
- The checked-in Yarn package script also required a full `yarn install` because there was no `node_modules` linker state.
- Full `yarn lint` did not pass because the existing repository has many formatting issues outside this task's changes.

## 9. Risks / Concerns

- `yarn.lock` changed because adding `packages/flow` under the existing `packages/*` workspace pattern requires a lockfile workspace entry.
- A full Yarn install created local `node_modules` state. This should remain untracked.
- The working tree already showed a deleted `AGENT_INSTRUCTIONS/PLANNER TASKS/TASK001.md` and untracked `AGENT_INSTRUCTIONS/CODEX TASKS/` before scaffold implementation. These were not reverted or cleaned up.
- The global `yarn` command is not reliable in this environment. Use `node .yarn/releases/yarn-4.13.0.cjs <command>` until Corepack/Yarn is fixed.
- Full lint remains blocked by pre-existing repository formatting state.

## 10. Items To Finish Later

- Decide whether to keep or clean up the pre-existing `AGENT_INSTRUCTIONS/PLANNER TASKS` deletion and `AGENT_INSTRUCTIONS/CODEX TASKS` untracked folder.
- Fix the global Corepack/Yarn installation if developers want plain `yarn ...` commands to work.
- Decide when to address repository-wide formatting so `yarn lint` can pass from a clean baseline.
- Add real Flow modules only in later tasks.
- Add Flow UI placeholders only in Task002 or another explicit future task.
- Add persistence and migrations only after explicit approval in a future task.

## 11. Recommended Next Task

TASK002 - Rebrand visible Actual Budget UI to Flow, replace/prepare brand assets, and add integrated sidebar placeholder pages.
