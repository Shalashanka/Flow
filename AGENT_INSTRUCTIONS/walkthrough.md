# Task 001 Walkthrough — Consolidated Architecture Reference and Actual Separation

We have consolidated the technical architecture documentation to be completely separate from the `actual/` folder. Here is a summary of the rationale and layout.

## 1. Single Architecture Reference File
Instead of creating two separate files (which resulted in duplicate documentation), we now maintain a single, consolidated reference file:
*   **Location**: [FLOW_REPO_ARCHITECTURE_REPORT.md](file:///c:/dev/flow/AI_DEVELOPER_INSTRUCTIONS/FLOW_REPO_ARCHITECTURE_REPORT.md) inside the `AI_DEVELOPER_INSTRUCTIONS` directory (AI Developer root).
*   **Purpose**: A single source of truth that OpenAI Codex can use to understand Actual Budget's internal mechanisms (workspaces, routing, IPC, migrations, schemas) without wasting context tokens.

## 2. Zero-Touch Strategy for `actual/`
To keep the core `actual/` repository clean, standard, and easy to merge with upstream releases, we will **never write or commit any Flow files inside the `actual/` directory**.

### Separation Architecture:
1.  **Workspaces**: All Flow source code and database adapters will reside in a sibling directory (e.g. `c:/dev/flow/packages/flow`). A root-level monorepo configuration will join the packages at compile time.
2.  **AQL & Schema Injection**: To register new Flow tables and enable live queries, we will use a pre-build scripting step or webpack/vite aliasing. Flow tables will be created via database migrations, which will run dynamically inside the user's SQLite database file.
3.  **UI Diffs**: Diffs for routing entries and sidebar changes will be maintained in a sibling `patches/` folder and applied temporarily at build time, then reverted automatically.

This ensures that the `actual/` git directory remains 100% clean at all times.
