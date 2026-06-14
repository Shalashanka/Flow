# Flow Architecture Reference for OpenAI Codex

This document serves as an in-depth reference of the Actual Budget repository structure, runtime design, database mechanisms, data models, and the Flow integration architecture. Read this before writing any code to avoid reading the entire repository or wasting tokens.

> [!IMPORTANT]
> **Strict Isolation Constraint**:
> The `actual/` folder represents the clean, upstream Actual Budget codebase and must **never** contain any Flow source code. All Flow logic, pages, domain adapters, and scripts must reside entirely outside the `actual/` folder (e.g., in a sibling `packages/` directory). Any required modifications to Actual core files (e.g. registration of routes, sidebar items, backend handlers) must be handled dynamically via pre-build scripts, bundler aliases, or temporary patch files applied during build time.

---

## 1. Monorepo Structure

Actual Budget is a monorepo configured using Yarn Workspaces:
*   **`packages/desktop-client/`** (`@actual-app/web`): React UI code. Uses React Router 6, Redux Toolkit, and Tailwind/Vanilla CSS.
*   **`packages/loot-core/`** (`@actual-app/core`): Node/electron/browser-server backend engine containing the SQLite interface, AQL query compiler, spreadsheet logic, and CRDT synchronization.
*   **`packages/crdt/`** (`@actual-app/crdt`): Conflict-free replicated data type engine (hybrid logical clocks, Merkle trees).
*   **`packages/sync-server/`** (`@actual-app/sync-server`): Core sync backend. Agnostic to table schemas; simply routes encrypted/plain message buffers between clients.
*   **`packages/component-library/`** (`@actual-app/components`): Common buttons, styles, inputs.

---

## 2. Runtime Architecture & IPC

Actual Budget runs in a separate thread/process architecture to maintain responsiveness:
*   **UI Thread**: React DOM frontend.
*   **Server Thread**: Web Worker (Browser) or Node child process (Electron). Handles filesystem, SQLite transactions, sync, and encryption.

### Client-to-Server IPC:
*   Import client `send` helper:
    ```typescript
    import { send } from '@actual-app/core/platform/client/connection';
    ```
*   Sending IPC messages:
    ```typescript
    const result = await send('method-name', { param1: 'value' });
    ```
*   IPC handlers are typed via `Handlers` in `packages/loot-core/src/types/handlers.ts` and combined using `app.combine()` inside `packages/loot-core/src/server/main.ts`.

---

## 3. Database & Sync Mechanics

*   **Initial DB**: New budget files copy `packages/loot-core/default-db.sqlite`.
*   **Migrations**: Handled dynamically upon file open via `packages/loot-core/src/server/migrate/migrations.ts`. Runs SQL and JS migrations located in `packages/loot-core/migrations/`.
*   **Sync Logic**: All insertions/updates via `db.insert`/`db.update` in `loot-core/src/server/db/index.ts` automatically create hybrid logical clock (HLC) message records in the local database. These are synced to the server as generic column updates.
*   **Live Updates**: UI queries use `useQuery` or `liveQuery`. They listen to `'sync-event'` IPC notifications. Whenever a backend transaction updates tables, the frontend automatically refetches any AQL query depending on those tables.

---

## 4. Database Schema (Subset of Core Tables)

Defined in `packages/loot-core/src/server/aql/schema/index.ts`:

*   **`accounts`**: `id`, `name`, `offbudget`, `closed`, `sort_order`, `tombstone`, `account_id`, `official_name`, `account_sync_source`, `last_reconciled`, `last_sync`, `bank_sync_status`.
*   **`transactions`**: `id`, `is_parent`, `is_child`, `parent_id`, `account` (FK accounts), `category` (FK categories), `amount` (integer, e.g., cents), `payee` (FK payees), `notes`, `date`, `imported_id`, `cleared`, `reconciled`, `tombstone`, `schedule`.
*   **`categories`**: `id`, `name`, `is_income`, `hidden`, `group` (FK category_groups), `goal_def`, `cleanup_def`, `template_settings`, `sort_order`, `tombstone`.
*   **`category_groups`**: `id`, `name`, `is_income`, `hidden`, `sort_order`, `tombstone`.
*   **`zero_budgets`** / **`reflect_budgets`**: `id`, `month` (integer format, e.g., `202606`), `category` (FK categories), `amount` (allocated budget), `carryover`, `goal`, `long_goal`.

---

## 5. Flow Module Placement & Adapter Design

All Flow code sits entirely in a sibling `packages/flow` (or `packages/finance-plus`) folder outside the `actual` directory:

```text
c:/dev/flow/
  actual/ (Clean Upstream Actual Git Submodule/Directory)
  packages/
    flow/ (Our Isolated Flow Codebase)
      package.json
      actual-adapter/
        index.ts
      domain/
      ui/
  package.json (Parent monorepo configuration joining both)
```

### Parent Monorepo Workspace Configuration:
We can declare a parent `package.json` in the root `c:\dev\flow` to merge the workspaces dynamically:
```json
{
  "name": "flow-monorepo",
  "private": true,
  "workspaces": [
    "actual/packages/*",
    "packages/*"
  ]
}
```
This enables yarn to link the packages seamlessly without touching a single file in the `actual/` folder.

### Actual Adapter (`packages/flow/actual-adapter/index.ts`):
Wrap standard AQL queries and backend IPCs:
```typescript
import { send } from '@actual-app/core/platform/client/connection';
import { q } from '@actual-app/core/shared/query';

export class ActualAdapter {
  static async getAccounts() {
    return send('accounts-get');
  }
  static async getCategories() {
    return send('categories-get');
  }
  static getTransactions(range: { start: string; end: string }) {
    return q('transactions')
      .filter({
        $and: [
          { date: { $gte: range.start } },
          { date: { $lte: range.end } }
        ]
      })
      .select('*')
      .serialize();
  }
}
```

---

## 6. Persistence Strategy for Flow

*   **Do not alter Actual core tables**.
*   **Store Flow data in new SQLite tables** (e.g. `flow_goals`, `flow_debts`) within the same budget database.
*   **Use SQL migrations** to construct tables, and register them inside `packages/loot-core/src/server/aql/schema/index.ts` to enable AQL compile capability.
*   **Zero-Touch actual/ Strategy**: 
    To append migrations and register schemas without modifying `actual/` files, we can use a pre-build scripting step (like a node script) that copies/injects these migrations into the build folders or applies temporary git patches before compilation, which are reverted on exit.
    This guarantees **automatic cross-device synchronization** (since the sync-server is schema-agnostic and syncs any table message) and **automatic React live-reloads** through `useQuery` while keeping the repository clean.

---

## 7. UI Integration Steps

We will maintain a `patches/` folder containing clean diffs for UI integrations:
1.  **Sidebar Link** (`packages/desktop-client/src/components/sidebar/PrimaryButtons.tsx`):
    Inject the navigation item:
    ```tsx
    <Item title={t('Flow')} Icon={SvgWallet} to="/flow" />
    ```
2.  **Route Registration** (`packages/desktop-client/src/components/FinancesApp.tsx`):
    Inject the main route entry point:
    ```tsx
    import { FlowApp } from '@actual-app/flow/ui';
    ...
    <Route path="/flow/*" element={<FlowApp />} />
    ```
3.  **Feature Flag** (`packages/desktop-client/src/hooks/useFeatureFlag.ts`):
    Add the feature flag:
    ```typescript
    flowEnabled: false,
    ```

These integrations will be applied dynamically at compile time via a pre-build tool and reverted automatically, ensuring that developers never accidentally commit Flow changes inside the `actual/` repository.

---

## 8. Codebase Guidelines for Codex

1.  **Do not touch core calculations** or CRDT libraries.
2.  All custom Flow backend IPC handlers must be combined dynamically during startup or injected into the server app handlers.
3.  Write all Flow UI components in `c:/dev/flow/packages/flow/ui`.
4.  Always run `yarn lint` to verify Monorepo compliance before finalizing tasks.
