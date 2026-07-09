# TASK006 — Flow Transaction Metadata API and Storage

## Role

You are the implementation AI working inside the Flow repository.

TASK005 moved Flow Settings into the budget database and created the initial `flow_transaction_metadata` table as future-facing preparation.

TASK006 makes `flow_transaction_metadata` usable by adding typed Flow metadata models, backend handlers, frontend storage functions, validation/normalization, and smoke-tested read/write behavior.

This task does **not** add Flow columns to the Transactions page yet.
That will be TASK007.

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
AGENT_INSTRUCTIONS/CODEX/reports/TASK006_RESULT.md
```

Do not create reports outside:

```text
AGENT_INSTRUCTIONS/CODEX/reports/
```

---

# 2. Goal

Build the durable Flow transaction metadata foundation.

Flow needs to attach extra household/planning/settlement meaning to Actual transactions without changing Actual’s core transaction table.

Actual remains the source of truth for the real transaction:

```text
date
amount
account
payee
category
notes
transfer status
cleared/reconciled status
```

Flow adds metadata such as:

```text
paid by
entered by
shared or personal
split rule
settlement status
settlement month
reimbursement link
cashflow included
Flow notes
```

This enables future features:

* Flow columns in the Transactions page
* shared expenses
* settlement calculator
* reimbursement handling
* Monthly Cashflow Planner inclusion/exclusion
* Quick Entry form
* System Check
* monthly settlement close

---

# 3. Non-negotiable constraints

Do not modify Actual core budget calculations.

Do not modify Actual envelope budgeting logic.

Do not modify the existing Actual transactions table.

Do not modify Actual account/category/payee schemas.

Do not change Actual import behavior.

Do not change Actual bank sync behavior.

Do not change CRDT/sync logic unless absolutely necessary and documented.

Do not implement Settlement UI in this task.

Do not implement Flow columns in the Transactions page in this task.

Do not implement Quick Entry in this task.

Do not implement Cashflow Forecast in this task.

Do not implement Scenario Builder in this task.

Do not store Flow transaction metadata in browser localStorage.

Do not create metadata rows for every transaction automatically.

Only save metadata rows when metadata is explicitly created/changed/imported.

---

# 4. Architecture rule

Flow transaction metadata must be stored separately from Actual transactions.

The link must be by Actual transaction ID.

Preferred relationship:

```text
Actual transaction id
→ flow_transaction_metadata.actual_transaction_id
→ Flow-only metadata JSON
```

Do not rely on payee names, category names, dates, or amounts as permanent identifiers.

Names can be used only for display.

---

# 5. Existing database table

TASK005 already created:

```text
flow_transaction_metadata
```

Before implementing anything, inspect:

```text
packages/loot-core/migrations/1781577600000_add_flow_settings.sql
```

Confirm the exact schema.

Do not blindly create a duplicate table.

If the existing table is usable, use it.

If a small additive migration is absolutely required, create a new migration and document why.

Avoid strict `NOT NULL` columns because TASK005 found that Actual’s synced `db.insert` column-message path can fail when strict NOT NULL columns are used before all column messages are applied.

---

# 6. Recommended storage shape

If the existing schema matches this pattern, use it:

```sql
flow_transaction_metadata (
  id TEXT PRIMARY KEY,
  actual_transaction_id TEXT,
  data TEXT,
  created_at TEXT,
  updated_at TEXT
)
```

Recommended row behavior:

```text
id = actual transaction id
actual_transaction_id = actual transaction id
data = JSON string of normalized FlowTransactionMetadataData
```

This keeps the first implementation flexible while the metadata model is still evolving.

If the existing table uses a different primary key, adapt safely and document the final behavior.

---

# 7. Required TypeScript models

Create Flow-isolated transaction metadata models.

Suggested location:

```text
packages/desktop-client/src/flow/transaction-metadata/types.ts
```

or, if shared between client/server is easier:

```text
packages/desktop-client/src/flow/transaction-metadata/
packages/loot-core/src/server/flow/
```

Avoid circular dependencies.

## Required model concepts

```ts
export type FlowSharedStatus = 'personal' | 'shared' | 'ignored';

export type FlowSplitMethod =
  | 'none'
  | 'equal'
  | 'percentage'
  | 'fixed-amount'
  | 'custom';

export type FlowSettlementStatus =
  | 'not-needed'
  | 'open'
  | 'settled'
  | 'reimbursed'
  | 'ignored';

export type FlowSplitParticipant = {
  memberId: string;
  percentage?: number;
  fixedAmount?: number;
};

export type FlowSplitData = {
  participants: FlowSplitParticipant[];
};

export type FlowTransactionMetadataData = {
  version: 1;

  paidByMemberId?: string;
  enteredByMemberId?: string;

  sharedStatus: FlowSharedStatus;
  splitMethod: FlowSplitMethod;
  splitData?: FlowSplitData;

  settlementStatus: FlowSettlementStatus;
  settlementMonth?: string;

  reimbursementLinkId?: string;

  cashflowIncluded: boolean;

  flowNotes?: string;
};
```

Add an envelope type for DB/API responses:

```ts
export type FlowTransactionMetadataRecord = {
  actualTransactionId: string;
  data: FlowTransactionMetadataData;
  exists: boolean;
  createdAt?: string;
  updatedAt?: string;
};
```

`exists` means:

* `true`: a DB row exists
* `false`: returned from defaults/normalization, not explicitly saved yet

---

# 8. Default metadata behavior

Do not automatically create metadata rows for every Actual transaction.

When reading metadata for a transaction:

1. Check if a DB row exists.
2. If it exists, normalize and return it with `exists: true`.
3. If it does not exist, return computed defaults with `exists: false`.

Defaults should come from Flow Settings transaction rules where possible:

```text
defaultPaidByMemberId
defaultEnteredByMemberId
defaultSplitMethod
defaultCashflowIncluded
```

If Flow Settings are unavailable, use safe defaults:

```ts
{
  version: 1,
  sharedStatus: 'personal',
  splitMethod: 'none',
  settlementStatus: 'not-needed',
  cashflowIncluded: true
}
```

Important:

Defaults are display/edit defaults only. They must not be persisted until the user or future API explicitly saves metadata.

---

# 9. Normalization and validation

Create normalization functions.

Suggested file:

```text
packages/desktop-client/src/flow/transaction-metadata/normalize.ts
```

or shared equivalent.

Required behavior:

* unknown version falls back to version 1 defaults
* invalid `sharedStatus` falls back to `personal`
* invalid `splitMethod` falls back to `none`
* invalid `settlementStatus` falls back to `not-needed`
* invalid participant arrays fall back to empty/undefined split data
* non-string notes are ignored
* non-boolean `cashflowIncluded` falls back to `true`
* money values remain integer values, not floats

Do not trust raw JSON from the DB.

Do not allow invalid imported metadata to crash the UI.

---

# 10. Backend handlers

Add typed backend handlers.

Suggested names:

```text
flow/transaction-metadata-get
flow/transaction-metadata-get-many
flow/transaction-metadata-save
flow/transaction-metadata-delete
```

Possible shapes:

```ts
'flow/transaction-metadata-get': {
  input: {
    actualTransactionId: string;
  };
  output: FlowTransactionMetadataRecord | null;
};

'flow/transaction-metadata-get-many': {
  input: {
    actualTransactionIds: string[];
  };
  output: FlowTransactionMetadataRecord[];
};

'flow/transaction-metadata-save': {
  input: {
    actualTransactionId: string;
    data: FlowTransactionMetadataData;
  };
  output: FlowTransactionMetadataRecord;
};

'flow/transaction-metadata-delete': {
  input: {
    actualTransactionId: string;
  };
  output: { deleted: boolean };
};
```

Adapt to the repo’s handler typing style.

Register handlers in the existing Flow server area created in TASK005:

```text
packages/loot-core/src/server/flow/app.ts
```

and any necessary handler type files, likely:

```text
packages/loot-core/src/types/handlers.ts
```

Follow existing Actual patterns. Do not invent a parallel IPC system.

---

# 11. Backend implementation requirements

## Get one

Read by Actual transaction ID.

If row exists:

* parse JSON
* normalize
* return `exists: true`

If row does not exist:

* return `null` from backend, or return default record only if backend already has safe access to Flow Settings defaults

Preferred:

* backend returns DB rows only
* frontend applies Flow Settings defaults

This keeps backend simple.

## Get many

Batch read metadata for multiple transaction IDs.

This is important for TASK007, where the Transactions page may display many rows.

Requirements:

* accept a list of Actual transaction IDs
* deduplicate input IDs
* return existing rows
* do not create missing rows
* avoid one query per transaction if possible

## Save

Upsert metadata row.

Requirements:

* normalize before saving
* use `id = actualTransactionId` unless existing schema requires otherwise
* set `actual_transaction_id`
* JSON.stringify normalized data
* set/update timestamps
* use the existing database helpers that generate normal change/sync messages

## Delete

Delete metadata row for Actual transaction ID.

Used when a user wants to clear Flow metadata and return to defaults.

Do not delete the Actual transaction.

---

# 12. Frontend API

Create a frontend storage/API layer.

Suggested location:

```text
packages/desktop-client/src/flow/transaction-metadata/storage.ts
```

Expose:

```ts
getFlowTransactionMetadata(
  actualTransactionId: string,
): Promise<FlowTransactionMetadataRecord>;

getFlowTransactionMetadataMany(
  actualTransactionIds: string[],
): Promise<FlowTransactionMetadataRecord[]>;

saveFlowTransactionMetadata(
  actualTransactionId: string,
  data: FlowTransactionMetadataData,
): Promise<FlowTransactionMetadataRecord>;

deleteFlowTransactionMetadata(
  actualTransactionId: string,
): Promise<{ deleted: boolean }>;
```

The frontend `get` functions should return computed defaults for missing DB rows.

Use Flow Settings transaction rules to compute defaults if available.

Do not persist defaults automatically.

---

# 13. Future UI preparation

Do not modify the Transactions page yet.

But design the API so TASK007 can efficiently render optional Flow columns:

* Paid by
* Shared?
* Split
* Settlement status
* Cashflow included
* Flow notes

TASK007 should be able to call:

```ts
getFlowTransactionMetadataMany(transactionIds)
```

for the visible transaction list.

---

# 14. Import/export preparation

Do not build full import/export UI for transaction metadata in this task.

But ensure the data model is JSON-safe.

In the report, document how future export/import could work:

```text
actualTransactionId + metadata data
```

---

# 15. Error handling

If metadata read fails:

* do not crash the app
* return safe defaults if possible
* show errors only in future UI where needed
* log carefully if useful

If metadata save fails:

* reject the promise
* future UI should show a message
* do not silently store in localStorage

No localStorage fallback for transaction metadata.

This data is too important for settlement.

---

# 16. Sync / durability notes

Use the same database write path proven in TASK005.

Document whether:

* writes generated normal change messages
* the table is expected to sync between updated Flow clients
* remote clients without the migration may fail with invalid schema
* AQL schema registration was needed or not

Do not claim cross-device sync is fully proven unless actually tested.

---

# 17. Optional small test helper

If there is no easy UI yet, it is acceptable to add a tiny internal-only test helper or unit test around normalization/storage.

Preferred:

* tests for normalization functions
* backend handler smoke via existing test pattern if available

Do not add a visible debug page.

Do not add a permanent button in the UI.

---

# 18. Validation commands

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

# 19. Smoke test

Because this task has little or no UI, smoke test the backend/frontend API as directly as possible.

Minimum smoke test:

1. Open a demo/test budget.
2. Pick or create one Actual transaction ID from that budget.
3. Save Flow metadata for that transaction:

   * paid by one household member
   * shared status = shared
   * split method = equal
   * settlement status = open
   * cashflow included = true
4. Read the metadata back.
5. Update one field.
6. Read again and confirm update.
7. Delete the metadata row.
8. Read again and confirm it returns defaults or no explicit row.
9. Confirm the Actual transaction itself was not changed.
10. Confirm no FatalError/backend error.

If no direct browser UI exists, perform this through the most appropriate repo-native handler/test method and document exactly how.

---

# 20. Result report

Create:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK006_RESULT.md
```

The report must include:

```markdown
# TASK006 Result — Flow Transaction Metadata API and Storage

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. Existing Table Inspection

## 5. Metadata Models Added

## 6. Normalization / Validation Behavior

## 7. Backend Handlers Added

## 8. Frontend API Added

## 9. Default Metadata Behavior

## 10. Database Write Path / Sync Findings

## 11. Commands Run

## 12. Command Results

## 13. Smoke Test

## 14. What Worked

## 15. What Did Not Work

## 16. Risks / Concerns

## 17. Items To Finish Later

## 18. Recommended Next Task
```

Recommended next task should be:

```text
TASK007 — Add optional Flow metadata columns to the Transactions page.
```

---

# 21. Definition of done

TASK006 is complete only when:

* the existing `flow_transaction_metadata` table is inspected and used safely
* typed Flow transaction metadata models exist
* normalization/validation exists
* backend get/get-many/save/delete handlers exist
* frontend get/get-many/save/delete functions exist
* missing metadata returns safe defaults without creating DB rows
* save writes metadata to the DB
* delete removes only Flow metadata, not the Actual transaction
* no Actual core transaction schema is changed
* no Actual budget calculations are changed
* no sync/CRDT logic is changed blindly
* checks were run or attempted
* result report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK006_RESULT.md`

---

# 22. Final instruction

Be conservative.

This task creates the metadata API foundation.

Do not build the Transactions page columns yet.

Do not build Settlement yet.

Do not build Quick Entry yet.

Make Flow transaction metadata durable, typed, safe, and ready for the next task.
