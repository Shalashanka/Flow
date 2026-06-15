# TASK002 Result - Flow Rebrand and Placeholder Navigation

## Summary

TASK002 was implemented with the later navigation correction from the owner.

The app now presents visible product branding as Flow where it was safe to do so, adds integrated read-only placeholder pages for the planned Flow modules, and places those pages in the existing app shell instead of a separate Flow home area.

## Navigation Implemented

The first pass used a `Flow` sidebar dropdown. After product feedback, that was removed because the whole app is Flow and the sidebar should not separate "Actual" features from "Flow" features.

Final sidebar structure:

- Budget
- Reports
- Schedules
- Cashflow
- Goals
- Debts
- Monthly Close
- More
  - Account Control
  - Settlement
  - Affordability
  - Subscriptions
  - Deadlines
  - Investments
  - System Check
  - Monthly Overview
  - Payees
  - Rules
  - Bank Sync, when server features are available
  - Tags
  - Settings

Cashflow, Goals, Debts, and Monthly Close are top-level because they are expected daily/monthly product features. The rest are under More because they are control, planning, reporting, or administrative tools. Existing Actual navigation entries were kept reachable under More to avoid removing current functionality.

System Check is currently a page because TASK002 requested a placeholder route. Product note: later it may be better as a small status indicator or health summary rather than a permanent main navigation destination.

## Placeholder Pages Added

Added shared Flow placeholder metadata and a shared placeholder page component:

- `packages/desktop-client/src/flow/flowPages.ts`
- `packages/desktop-client/src/flow/FlowPlaceholderPage.tsx`

Routes added in the existing finances app:

- `/cashflow`
- `/goals`
- `/debts`
- `/monthly-close`
- `/account-control`
- `/settlement`
- `/affordability`
- `/subscriptions`
- `/deadlines`
- `/investments`
- `/system-check`
- `/monthly-overview`

The pages are intentionally read-only placeholders. They do not query budget data, write data, add migrations, or change Actual core calculations.

The command bar now includes the Flow placeholder routes so they can be found by search/navigation.

## Rebrand Work Completed

Visible user-facing copy was changed from Actual or Actual Budget to Flow where safe, including:

- onboarding and welcome copy
- setup/configuration copy
- fatal error and fallback copy
- update notification copy
- settings/backups/encryption/user-facing settings copy
- bank sync visible labels
- import/export compatibility copy, now labeled Flow / Actual where the archive format is still Actual-compatible
- desktop Electron title/product metadata
- Linux AppStream visible name/summary/description
- browser title and web manifest visible metadata

Also improved fatal error object handling so plain object errors no longer collapse to `Error: [object Object]` in the displayed error details.

## Brand Assets

Added temporary Flow mark assets:

- `packages/desktop-client/public/flow-mark.svg`
- `flow-assets/flow-mark.svg`

Updated:

- `packages/desktop-client/index.html` to use `Flow` title and the temporary SVG favicon.
- `packages/desktop-client/public/site.webmanifest` visible name, short name, description, and screenshot labels.
- `flow-assets/README.md` to describe the temporary mark and note that final raster assets are still needed.

What was not replaced yet:

- existing PNG/ICO web icons
- Apple touch icon
- Android maskable icons
- Electron `.icns`, PNG, AppX, and store assets
- screenshots and social preview imagery

These need final brand artwork before replacement.

## Technical/Internal Actual References Kept

The remaining `Actual` references were intentionally not blindly renamed:

- `window.Actual` / `global.Actual` preload and runtime bridge APIs
- `@actual-app/*` package names and workspace identities
- component/module names such as `ImportActualModal`, which still map to the Actual-compatible import path
- import/export copy where users may have Flow or Actual-compatible archives
- Electron package identity fields such as `actualbudget.org.ActualBudget`
- Linux metadata id `com.actualbudget.actual` and contributor credit `Actual Core Contributors`
- upstream docs/support/GitHub URLs
- tests using `vi.importActual`
- comments and type names that describe Actual internals, for example ActualQL or mappable Actual fields

These should be revisited only with a deliberate packaging/legal/release plan.

## Layout Guard Update

Updated `scripts/flow/check-flow-layout.mjs` because it still expected root-level `CODEX/tasks` and `CODEX/reports`.

The current repository rule is that Codex tasks, reports, architecture notes, and agent material must stay under `AGENT_INSTRUCTIONS`, so the guard now checks:

- `AGENT_INSTRUCTIONS/CODEX/tasks`
- `AGENT_INSTRUCTIONS/CODEX/reports`

No root `CODEX` folder was created.

## Validation

Passed:

- `node scripts/flow/check-flow-layout.mjs`
- `node .yarn/releases/yarn-4.13.0.cjs flow:check-layout`
- `node .yarn/releases/yarn-4.13.0.cjs typecheck`
- `node .yarn/releases/yarn-4.13.0.cjs workspace @actual-app/web build`
- `git diff --check`
- targeted `oxfmt --check` on task-touched files
- targeted `oxlint --type-aware --quiet` on task-touched TypeScript/TSX files: 0 errors

Known validation caveat:

- `node .yarn/releases/yarn-4.13.0.cjs lint` failed at the repo-wide `oxfmt --check .` stage because the existing repository has many pre-existing formatting differences outside this task. The task-touched files were formatted and checked separately.
- Targeted `oxlint` still reports 15 warnings in touched legacy files when run without `--quiet`. They are existing patterns such as unsafe assertions and a11y warnings in old code paths, not new blocking errors from the TASK002 changes.
- The web build produced existing Vite warnings about browser externalization of `vm`, large chunks, and plugin timing. The build still completed successfully.

## What Went Wrong / Adjustments

- The initial Flow dropdown was technically clean but product-wise made Flow look like a plugin. It was replaced with the hybrid sidebar structure requested by the owner.
- The lint-preferred `#flow/...` imports required new explicit package import map entries in `packages/desktop-client/package.json`.
- The required Flow layout check initially failed because it still enforced the old root `CODEX` layout. The script was updated to match the current `AGENT_INSTRUCTIONS/CODEX` rule.
- Full repo lint is not currently a reliable task-local signal because repo-wide formatting is already dirty.

## Keep In Mind

- Do not add new Codex reports or task files outside `AGENT_INSTRUCTIONS`.
- Do not rename internal Actual bridge APIs or package identities casually.
- Future Flow modules should connect through a deliberate adapter/read model, not direct scattered database calls.
- Placeholder pages currently have no real data access by design.
- Final brand work still needs proper raster/icon assets for web, desktop, mobile/PWA, and store metadata.
