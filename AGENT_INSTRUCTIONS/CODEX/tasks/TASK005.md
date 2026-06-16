# TASK005 — Persist Flow Settings in the Budget Database

## Role

You are the implementation AI working inside the Flow repository.

TASK004 created Flow Settings using temporary browser local storage.
TASK004B fixed the Flow Settings UI layout and autosave behavior.

TASK005 replaces the temporary local-storage persistence with durable Flow-owned database persistence.

This task must be done before building the Scenario Builder, projected Cashflow, Runway, Quick Entry, or Flow Transactions metadata pages.

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
AGENT_INSTRUCTIONS/CODEX/reports/TASK005_RESULT.md
```

Do not create reports outside:

```text
AGENT_INSTRUCTIONS/CODEX/reports/
```

---

# 2. Goal

Move Flow Settings from browser-only local storage into persistent Flow-owned database tables inside the budget database.

Current storage:

```text
localStorage key: flow.settings.v1
```

New storage should be durable, budget-file-specific, and ready for future sync if the existing Actual database/sync mechanism supports it.

This task should preserve the existing Flow Settings UI and behavior:

* autosave
* manual save
* reset to defaults
* export JSON
* import JSON
* account/category dropdowns
* compact rows
* edit forms
* local status messages

But the underlying source of truth should become the database, not local storage.

---

# 3. Why this matters

Local storage is not enough because:

* it is browser-specific
* it is not shared across devices
* it is not attached reliably to the budget file
* it can disappear if browser data is cleared
* Alba/other devices will not see the same Flow settings
* future Quick Entry, Flow Transactions, Cashflow, Scenario Builder, and Runway need shared configuration

Flow must behave like real product software, not a spreadsheet prototype.

---

# 4. Non-negotiable constraints

Do not modify Actual core budget calculations.

Do not modify Actual envelope budgeting logic.

Do not modify existing Actual transaction/account/category/budget schemas except where absolutely necessary for Flow-owned tables.

Do not change sync behavior unless required for Flow-owned persistence and documented carefully.

Do not modify CRDT logic unless absolutely unavoidable.

Do not write Actual transactions in this task.

Do not implement Scenario Builder in this task.

Do not implement projected Cashflow in this task.

Do not implement Quick Entry in this task.

Do not implement Runway in this task.

Do not remove export/import JSON.

Do not break existing Flow Settings UI.

---

# 5. Important architecture rule

Actual remains the source of truth for:

* accounts
* transactions
* categories
* payees
* budgets
* transfers
* schedules
* reports

Flow owns additional metadata:

* household members
* transaction rules
* cashflow parameters
* income plans
* fixed bills
* variable spending rules
* scenarios
* future runway settings
* future transaction metadata
* future settlement metadata

Flow-owned data must be stored separately from Actual core data.

Flow-owned data should reference Actual records by ID, not by display name.

Examples:

```ts
linkedAccountId: actualAccountId
linkedCategoryId: actualCategoryId
actualTransactionId: actualTransactionId
```

---

# 6. Storage strategy

Implement the smallest durable database layer needed now.

Preferred first table:

```text
flow_settings
```

Recommended schema:

```sql
CREATE TABLE IF NOT EXISTS flow_settings (
  id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Use one row for global budget settings:

```text
id = 'default'
version = 1
data = JSON string of FlowSettings
```

This keeps the first storage step simple and flexible while the product model is still evolving.

Do not prematurely normalize every settings list into many relational tables unless the existing Actual persistence style strongly requires it.

---

# 7. Optional second table preparation

If it is safe and not overcomplicated, also create a minimal future-facing table:

```text
flow_transaction_metadata
```

Recommended schema:

```sql
CREATE TABLE IF NOT EXISTS flow_transaction_metadata (
  id TEXT PRIMARY KEY,
  actual_transaction_id TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

Purpose:

Future Flow Transactions and Quick Entry will use this to store Flow-only meaning linked to Actual transactions, such as:

* paid by
* entered by
* split method
* settlement status
* reimbursement link
* cashflow included
* goal link
* Flow notes

Do not build UI for this table in TASK005.

If adding this table introduces risk, skip it and document why.

The required table for TASK005 is `flow_settings`.

---

# 8. Migration from local storage

Implement a safe migration path from:

```text
localStorage: flow.settings.v1
```

to:

```text
database: flow_settings row id='default'
```

Behavior:

1. On Flow Settings load, try to read database settings.
2. If database settings exist, use them.
3. If database settings do not exist and localStorage settings exist:

   * import localStorage settings into the database
   * preserve localStorage as backup for now
   * show a status message that settings were migrated
4. If neither database nor localStorage settings exist:

   * load typed defaults
   * save defaults to database only when the user saves/autosaves

Do not delete localStorage automatically in this task.

Add a small note/report item that localStorage cleanup can happen later after confidence.

---

# 9. Backend/API design

Add safe read/write methods for Flow settings.

Preferred frontend API:

```ts
getFlowSettings(): Promise<FlowSettings>
saveFlowSettings(settings: FlowSettings): Promise<void>
```

These already exist in local-storage form. Refactor them to use database-backed storage.

If backend IPC is required, add handlers such as:

```text
flow-settings-get
flow-settings-save
```

Use existing Actual patterns for typed handlers, server registration, and IPC.

Do not invent a parallel API style if the repo has established conventions.

---

# 10. Sync/durability investigation during implementation

Before finalizing, inspect how new database tables are expected to be written in Actual.

Important questions:

* Do writes through the chosen DB helper generate sync/change messages?
* Are new tables automatically synced if written through normal DB helpers?
* Do new tables need AQL schema registration?
* Do new tables need migration registration?
* Does the server/client need type registration for handlers?
* Does the app need live query invalidation for Flow settings?

Implement the safest path based on existing repo patterns.

If true sync support for custom tables is unclear, still implement durable local budget-file persistence if safe, but document the sync limitation clearly.

---

# 11. UI changes required

Update Flow Settings UI copy.

Replace current local-only warning:

```text
Flow Settings is currently stored locally on this browser. Shared sync storage will be added in a later task.
```

with something like:

```text
Flow Settings are saved in this budget database.
```

If sync is not proven, use:

```text
Flow Settings are saved in this budget database. Cross-device sync support will be verified in a later task.
```

If the database read/write fails and localStorage fallback is used, show:

```text
Database storage failed. Flow Settings are temporarily using browser local backup.
```

The user must not be misled.

---

# 12. Fallback behavior

If database read/write fails, the page should not crash.

Fallback rules:

* show an error status in Flow Settings
* allow export JSON
* optionally use localStorage fallback as emergency backup
* document failure in console only if helpful
* do not show FatalError

---

# 13. Import/export behavior

Keep existing JSON import/export.

When user imports JSON:

* validate/normalize the settings
* save to database
* update UI state
* update autosave status

When user exports JSON:

* export the current UI/database state
* not stale localStorage state

---

# 14. Autosave behavior

Preserve autosave.

Autosave should save to database.

If save succeeds:

```text
Saved to budget database at HH:mm:ss
```

If save fails:

```text
Database save failed. Export your JSON or retry.
```

Do not silently fall back without telling the user.

---

# 15. Testing / validation

Test at minimum:

1. Open `/flow-settings`
2. Load defaults if no settings exist
3. Add household member
4. Add income plan
5. Save
6. Reload browser
7. Confirm data persists
8. Restart dev server if feasible
9. Confirm data persists
10. Export JSON
11. Reset
12. Import JSON
13. Confirm imported data persists
14. Clear localStorage manually if feasible
15. Confirm database settings still load

If a demo budget is used, document that.

If using local browser database/budget file, document the exact test setup.

---

# 16. Files likely to be touched

Likely frontend files:

```text
packages/desktop-client/src/flow/planning/storage.ts
packages/desktop-client/src/flow/FlowSettingsPage.tsx
```

Likely backend/core files if needed:

```text
packages/loot-core/src/types/handlers.ts
packages/loot-core/src/server/main.ts
packages/loot-core/src/server/...
packages/loot-core/migrations/...
packages/loot-core/src/server/aql/schema/...
```

Do not touch these blindly.

Follow existing patterns and document all core-touch points.

---

# 17. Validation commands

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

If full repo lint fails because of pre-existing formatting issues, document it but do not block the task if changed files pass targeted checks.

---

# 18. Browser smoke test

Open:

```text
http://localhost:3001/flow-settings
```

Test:

1. page loads without fatal error
2. existing settings load from DB or migrate from localStorage
3. add/edit settings
4. autosave
5. reload page
6. confirm data remains
7. restart dev server if feasible
8. confirm data remains
9. export JSON
10. reset
11. import JSON
12. confirm database state updates
13. clear localStorage if feasible
14. confirm database state still loads

Document exactly what was tested.

---

# 19. Result report

Create:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK005_RESULT.md
```

The report must include:

```markdown
# TASK005 Result — Persistent Flow Settings Storage

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. Database Tables Added

## 5. Migration Strategy

## 6. Backend / IPC Handlers Added

## 7. Frontend Storage Changes

## 8. LocalStorage Migration Behavior

## 9. Sync / Durability Findings

## 10. UI Copy Changes

## 11. Commands Run

## 12. Command Results

## 13. Browser Smoke Test

## 14. What Worked

## 15. What Did Not Work

## 16. Risks / Concerns

## 17. Items To Finish Later

## 18. Recommended Next Task
```

Recommended next task should likely be:

```text
TASK006 — Build Flow Scenario Builder and Parameterization Foundation.
```

Unless database persistence reveals a blocker.

---

# 20. Definition of done

TASK005 is complete only when:

* Flow Settings no longer depends primarily on browser localStorage
* `flow_settings` database table exists or an equivalent durable database-backed storage exists
* existing localStorage data migrates safely into database storage
* Flow Settings save/autosave writes to database
* Flow Settings reloads from database
* export/import JSON still works
* page does not crash if database read/write fails
* no Actual core budget calculations changed
* no existing Actual transaction/account/category/budget schemas changed
* no sync/CRDT behavior changed beyond necessary Flow persistence integration
* checks were run or attempted
* result report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK005_RESULT.md`

---

# 21. Final instruction

Be conservative.

This task is about durable persistence, not new features.

Do not build Scenario Builder yet.

Do not build Cashflow Forecast yet.

Do not build Quick Entry yet.

Make Flow Settings real, durable, and safe.
