# TASK011 — Subscription Detector and Subscription Page

## Role

You are the implementation AI working inside the Flow repository.

TASK005 added database-backed Flow Settings.
TASK006 added durable Flow transaction metadata.
TASK007 added Flow metadata columns to the Transactions page.
TASK008 added Settlement calculation and snapshots.
TASK009 added Settlement payment linking and monthly close/reopen state.
TASK010 added the Debts metadata page.

TASK011 builds the first Flow Subscriptions feature.

This task creates a Flow-owned subscription detection and management page that scans Actual transactions for recurring payments, lets the user confirm/ignore candidates, and prepares future integration with Actual schedules.

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

Create the result report:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK011_RESULT.md
```

Do not create reports outside:

```text
AGENT_INSTRUCTIONS/CODEX/reports/
```

---

# 2. Global UI/theme requirement

All UI must follow Actual Budget’s existing design standards.

Use Actual’s existing:

- components
- active theme tokens
- spacing patterns
- typography patterns
- button variants
- inputs
- selects
- date pickers
- tables
- cards
- tooltips
- icons
- menu/popover patterns
- empty states
- warning/error styles

Do not create a separate Flow design system.

Do not hard-code colors unless there is no existing theme token and the reason is documented.

Changing the active Actual theme must also affect Flow pages.

Flow pages should feel native inside Actual, not like a separate pasted-on app.

---

# 3. TASK010 validation caveat

TASK010 could not complete automated browser smoke testing because Playwright Chromium was missing.

Before starting major TASK011 UI work, attempt a quick sanity check:

1. Start the app.
2. Open `/debts`.
3. Confirm the Debts page renders.
4. If possible, add/save/reload/archive one test debt.
5. Document whether browser automation was possible.

If Playwright Chromium is still missing, use the installed local Chrome channel/path if feasible.
If browser automation still cannot run, document that clearly and continue only if typecheck/build are healthy.

Do not spend excessive time on test infrastructure in this task.

---

# 4. Goal

Create a Subscriptions page that answers:

```text
Which recurring payments do we have, which ones are confirmed subscriptions, which ones are only candidates, and what is expected next?
```

The page should use Actual as the source of truth for real transactions, payees, categories, accounts, and schedules.

Flow adds:

- subscription candidate detection
- confirmed/ignored/cancelled subscription metadata
- recurrence estimate
- next expected date estimate
- linked Actual payee/account/category/schedule IDs
- confidence score
- price-change detection
- warnings for stale or missing subscriptions

---

# 5. Product principle

Actual already has schedules and rules.

Flow should not build a second recurrence engine that competes with Actual schedules.

Correct model:

```text
Actual transactions = real historical payments
Actual schedules = future recurring transaction source where available
Actual rules = payee/category cleanup
Flow subscriptions = detection, review, confirmation, metadata, and subscription control page
```

Flow can later suggest creating or linking an Actual schedule, but TASK011 should not auto-create schedules unless it is extremely safe and explicitly documented.

---

# 6. Non-negotiable constraints

Do not modify Actual core budget calculations.

Do not modify Actual transaction schema.

Do not modify Actual account/category/payee/schedule schemas.

Do not change Actual import behavior.

Do not change bank sync behavior.

Do not change CRDT/sync logic blindly.

Do not auto-create Actual schedules in this task unless explicitly safe and user-confirmed.

Do not auto-edit Actual rules.

Do not auto-edit Actual transactions.

Do not implement Cashflow Planner in this task.

Do not implement Quick Entry in this task.

Do not implement Scenario Builder in this task.

Do not store subscription data in localStorage.

---

# 7. Route and navigation

Use the existing route if already present:

```text
/subscriptions
```

If `/subscriptions` currently renders a placeholder, replace it with the real page.

Navigation label:

```text
Subscriptions
```

Keep it under the current More/Flow navigation structure unless already placed elsewhere.

---

# 8. Database tables

Add Flow-owned subscription tables.

Recommended migration:

```sql
CREATE TABLE IF NOT EXISTS flow_subscription_merchants (
  id TEXT PRIMARY KEY,
  canonical_name TEXT,
  match_pattern TEXT,
  default_category_id TEXT,
  typical_recurrence TEXT,
  active INTEGER DEFAULT 1,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS flow_subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT,
  payee_id TEXT,
  merchant_match_id TEXT,
  actual_schedule_id TEXT,
  category_id TEXT,
  account_id TEXT,
  amount INTEGER DEFAULT 0,
  recurrence TEXT,
  first_seen TEXT,
  last_seen TEXT,
  next_expected_date TEXT,
  status TEXT DEFAULT 'candidate',
  confidence INTEGER DEFAULT 0,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS flow_subscription_matches (
  id TEXT PRIMARY KEY,
  subscription_id TEXT,
  actual_transaction_id TEXT,
  match_type TEXT,
  confidence INTEGER DEFAULT 0,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);
```

Use nullable/defaulted non-ID columns where needed to remain compatible with Actual’s column-message insert/update path.

Avoid strict `NOT NULL` columns except for `id`.

---

# 9. TypeScript models

Add shared models if useful.

Suggested shared file:

```text
packages/loot-core/src/shared/flow-subscription.ts
```

Suggested frontend files:

```text
packages/desktop-client/src/flow/subscriptions/types.ts
packages/desktop-client/src/flow/subscriptions/storage.ts
packages/desktop-client/src/flow/subscriptions/detect.ts
packages/desktop-client/src/flow/SubscriptionsPage.tsx
```

Required model concepts:

```ts
export type FlowSubscriptionStatus =
  | 'candidate'
  | 'confirmed'
  | 'ignored'
  | 'cancelled'
  | 'paused';

export type FlowSubscriptionRecurrence =
  | 'weekly'
  | 'biweekly'
  | 'monthly'
  | 'quarterly'
  | 'yearly'
  | 'irregular'
  | 'unknown';

export type FlowSubscription = {
  id: string;
  name: string;
  payeeId?: string;
  merchantMatchId?: string;
  actualScheduleId?: string;
  categoryId?: string;
  accountId?: string;
  amount: number;
  recurrence: FlowSubscriptionRecurrence;
  firstSeen?: string;
  lastSeen?: string;
  nextExpectedDate?: string;
  status: FlowSubscriptionStatus;
  confidence: number;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type FlowSubscriptionMatch = {
  id: string;
  subscriptionId: string;
  actualTransactionId: string;
  matchType: 'payee-pattern' | 'recurrence' | 'manual';
  confidence: number;
  createdAt?: string;
  updatedAt?: string;
};

export type FlowSubscriptionCandidate = {
  candidateId: string;
  name: string;
  payeeId?: string;
  categoryId?: string;
  accountId?: string;
  amount: number;
  recurrence: FlowSubscriptionRecurrence;
  firstSeen?: string;
  lastSeen?: string;
  nextExpectedDate?: string;
  confidence: number;
  transactionIds: string[];
  warnings: string[];
};
```

Use integer money values consistent with Actual.

Confidence can be stored as integer 0–100.

---

# 10. Backend handlers

Add typed backend handlers.

Suggested handlers:

```text
flow/subscriptions-get
flow/subscription-save
flow/subscription-delete
flow/subscription-matches-get
flow/subscription-matches-save
flow/subscription-scan
```

Minimum acceptable handlers:

## flow/subscriptions-get

Returns all non-tombstoned subscription rows.

## flow/subscription-save

Upserts one subscription row.

Requirements:

- normalize/validate fields
- generate ID if missing
- update timestamps
- use sync-safe DB insert/update path
- do not touch Actual transactions/payees/categories/schedules

## flow/subscription-delete

Soft-tombstone one subscription row.

## flow/subscription-matches-get

Returns saved match rows for a subscription or all subscriptions.

## flow/subscription-matches-save

Saves match rows for a subscription.

## flow/subscription-scan

Optional.

It may be easier to scan in frontend using Actual adapter transaction reads.
If scan is frontend-only, document it.

---

# 11. Frontend storage/API

Add frontend functions:

```ts
getFlowSubscriptions(): Promise<FlowSubscription[]>;

saveFlowSubscription(
  subscription: FlowSubscription,
): Promise<FlowSubscription>;

deleteFlowSubscription(
  id: string,
): Promise<{ deleted: boolean }>;

getFlowSubscriptionMatches(
  subscriptionId?: string,
): Promise<FlowSubscriptionMatch[]>;

saveFlowSubscriptionMatches(
  subscriptionId: string,
  matches: FlowSubscriptionMatch[],
): Promise<{ saved: boolean }>;
```

No localStorage fallback.

If read/write fails, show a local error on the page.

---

# 12. Actual data integration

The Subscriptions page should read Actual transactions, payees, accounts, categories, and schedules where safe.

Use existing adapters/hooks where possible.

For v1 detection, use historical Actual transactions.

Recommended scan period:

```text
last 12 months
```

If 12 months is expensive, use 6 months and document.

Exclude:

- income/inflows
- transfers if identifiable
- tombstoned/deleted transactions
- zero-amount transactions
- one-off obvious manual adjustments if identifiable

Use Actual IDs for references:

- payee ID
- account ID
- category ID
- schedule ID later

Do not store names as permanent links when IDs exist.

---

# 13. Detection rules

Build a conservative subscription candidate detector.

A candidate can be created when:

1. Same normalized payee appears at least 2 times in different months, and
2. amounts are equal or close, and
3. date spacing looks recurring.

Recommended amount tolerance:

```text
exact or within 10%
```

Recommended recurrence detection:

- weekly: around 7 days
- biweekly: around 14 days
- monthly: around 28–33 days
- quarterly: around 85–95 days
- yearly: around 350–380 days

Minimum v1:

- monthly detection
- yearly detection if easy
- unknown/irregular fallback

Confidence scoring idea:

```text
+40 same payee repeated
+20 amount stable
+20 spacing stable
+10 same category
+10 same account
```

Cap at 100.

Do not silently confirm candidates.

Everything detected starts as:

```text
status = candidate
```

unless already saved as confirmed/ignored/cancelled.

---

# 14. Page UI

Create or replace `/subscriptions`.

Page should show:

## Header

```text
Subscriptions
```

Subtitle:

```text
Detect and manage recurring payments from Actual transactions.
```

## Top summary cards

Show:

- confirmed subscriptions count
- candidates count
- ignored/cancelled count
- estimated monthly total
- estimated yearly total
- price-change warnings count

## Controls

- scan/re-scan button
- scan period selector if easy
- status filter
- search
- optional recurrence filter

## Candidate/Subscription list

Use Actual-themed cards or table.

Each item should show:

- name
- status
- recurrence
- amount
- monthly equivalent
- yearly equivalent
- account
- category
- first seen
- last seen
- next expected
- confidence
- linked transaction count
- warnings

Actions:

- Confirm
- Ignore
- Mark cancelled
- Edit
- Archive/delete
- View matches

## Edit form

Fields:

- name
- status
- recurrence
- amount
- account
- category
- payee
- next expected date
- notes

Use Actual components and active theme tokens.

Use tooltips/help icons for unclear fields.

---

# 15. Price-change detection

For confirmed subscriptions or strong candidates:

If the latest amount differs from the median previous amount by more than 10%, show a warning:

```text
Price changed from about €X to €Y.
```

Do not overcomplicate v1.

---

# 16. Monthly and yearly totals

For each confirmed subscription:

Monthly equivalent:

- monthly: amount
- weekly: amount × 52 / 12
- biweekly: amount × 26 / 12
- quarterly: amount / 3
- yearly: amount / 12
- unknown/irregular: amount if monthly-like, else exclude or warn

Use integer money carefully.

Do not use floating point for final money outputs.

---

# 17. Actual schedules integration preparation

Do not auto-create schedules in v1.

If a subscription has a linked Actual schedule ID, display it.

If not linked, show placeholder action:

```text
Link schedule later
```

Do not implement schedule creation unless clearly safe and small.

Future task can implement:

```text
Create Actual schedule from confirmed subscription
```

---

# 18. Warnings / system check preparation

Show warnings for:

- candidate with low confidence
- confirmed subscription with no recent transaction
- expected date passed
- price changed
- missing linked account/category/payee
- duplicate candidates for same payee
- unknown recurrence

Keep warning logic reusable later for System Check.

---

# 19. Browser smoke test

Use demo or test budget.

Test:

1. Open `/subscriptions`.
2. Confirm page loads without FatalError.
3. Run scan/re-scan.
4. Confirm candidates render or empty state renders.
5. Confirm a candidate can be confirmed.
6. Reload page.
7. Confirm confirmed subscription persists.
8. Mark it ignored or cancelled.
9. Reload and confirm status persists.
10. Edit amount/recurrence/notes.
11. Confirm summary totals update.
12. Confirm Actual transactions were not edited.

If demo data does not produce candidates, create or identify repeated demo transactions if feasible, or document empty-state behavior.

---

# 20. Validation commands

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

If full repo lint fails because of pre-existing formatting issues, document it but do not block this task if changed files pass targeted checks.

---

# 21. Result report

Create:

```text
AGENT_INSTRUCTIONS/CODEX/reports/TASK011_RESULT.md
```

The report must include:

```markdown
# TASK011 Result — Subscription Detector and Subscription Page

## 1. Summary

## 2. Files Created

## 3. Files Modified

## 4. TASK010 Browser/Validation Preflight

## 5. Database Tables Added

## 6. Subscription Models Added

## 7. Backend Handlers Added

## 8. Frontend Storage/API Added

## 9. Detection Algorithm

## 10. Actual Data Integration

## 11. Subscriptions Page Implementation

## 12. Price Change Detection

## 13. Monthly/Yearly Total Calculation

## 14. UI Theme / Actual Design Compliance

## 15. Warnings / Edge Cases

## 16. Commands Run

## 17. Command Results

## 18. Browser Smoke Test

## 19. What Worked

## 20. What Did Not Work

## 21. Risks / Concerns

## 22. Items To Finish Later

## 23. Recommended Next Task
```

Recommended next task should likely be:

```text
TASK012 — Monthly Cashflow Planner.
```

Unless TASK011 discovers a blocker or needs stabilization.

---

# 22. Definition of done

TASK011 is complete only when:

- `/subscriptions` exists as a real page
- Flow subscription data is DB-backed
- user can scan transactions for candidates
- candidates are conservative and not silently confirmed
- user can confirm/ignore/cancel/edit subscriptions
- subscription records persist after reload
- summary totals render
- price-change warning works at least basically
- Actual transaction data is not edited
- Actual schedules are not auto-created unless explicitly safe and user-confirmed
- no localStorage is used for subscriptions
- UI uses Actual components and active theme tokens
- changing the Actual theme would affect the Subscriptions page
- validation commands are run or attempted
- result report exists at `AGENT_INSTRUCTIONS/CODEX/reports/TASK011_RESULT.md`

---

# 23. Final instruction

Be conservative.

Build the first useful Subscription Detector and Subscription page.

Do not build Cashflow Planner yet.

Do not build Quick Entry yet.

Do not auto-create schedules unless explicitly user-confirmed and safe.

Use Actual’s UI standards and active theme everywhere.
