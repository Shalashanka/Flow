# Startup Backend Init Fix - 2026-06-15

## Problem

On `yarn start:browser`, the app showed:

```text
Error: { "type": "app-init-failure", "BackendInitFailure": true }
```

The browser frontend loaded, but the loot-core backend worker failed during initialization.

## Root Cause

Two Windows startup issues were involved:

1. `/kcab/kcab.worker.dev.js` was returning Vite's HTML fallback instead of backend worker JavaScript. The dev worker file was missing, and the dev middleware passed the request through to Vite instead of returning a clear 404.
2. The dev server's `loot-core-backend` plugin spawned plain `yarn`. On this Windows environment the reliable executable is the checked-in Yarn CLI run through `node`, so the loot-core worker watcher was not consistently starting.

While restarting the dev server, another Windows issue appeared:

- Root `start:browser` used shell-sensitive quoting around `npm-run-all` arguments.
- `packages/desktop-client` used `./bin/watch-browser`, a shell script, which fails in PowerShell/cmd because `sh` is not available.

## Changes Made

Updated `packages/desktop-client/vite.config.mts`:

- spawn the loot-core backend watcher with `process.execPath` and the checked-in `.yarn/releases/yarn-4.13.0.cjs`
- return `404` for missing `/kcab/...` worker assets instead of letting Vite serve HTML fallback

Updated `package.json`:

- made `start:browser` quoting Windows-safe for `npm-run-all`

Updated `packages/desktop-client/package.json`:

- replaced shell-script startup with a cross-platform command:
  `cross-env PORT=3001 REACT_APP_BACKEND_WORKER_HASH=dev vite --mode=browser`

## Verification

Passed:

- `node .yarn/releases/yarn-4.13.0.cjs typecheck`
- `git diff --check`
- targeted `oxfmt --check` for changed startup files
- targeted `oxlint --type-aware packages/desktop-client/vite.config.mts` with 0 errors
- `http://localhost:3001/kcab/kcab.worker.dev.js` returns `application/javascript`
- Playwright smoke against `http://localhost:3001` rendered the setup screen:
  - "Where's the server?"
  - "Don't use a server"
  - "Create test file"
  - `App: v26.6.0 | Server: N/A`

The dev server is currently running on port `3001`.

## Notes

- The first smoke test after changing config hit stale Vite optimized dependency `504 Outdated Optimize Dep` responses. Restarting the Flow dev processes cleared that state.
- `oxlint` still reports two warnings in `vite.config.mts` from pre-existing type assertions unrelated to this fix.
- No root `CODEX` files were created; this report stays under `AGENT_INSTRUCTIONS/CODEX/reports`.
