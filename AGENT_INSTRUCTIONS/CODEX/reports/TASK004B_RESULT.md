# TASK004B Result — Flow Settings UI Layout Fix

## 1. Summary

Fixed the `/flow-settings` page so it renders as a readable settings form instead of a compressed spreadsheet-like layout. The core issue was the long page wrapper inheriting `View`'s default `minHeight: 0`; the page wrapper now overrides that with `minHeight: 'auto'`, allowing section cards to expand normally.

## 2. Files Created

- `AGENT_INSTRUCTIONS/CODEX/reports/TASK004B_RESULT.md`
- `AGENT_INSTRUCTIONS/CODEX/reports/task004b-final-desktop.png`
- `AGENT_INSTRUCTIONS/CODEX/reports/task004b-final-narrow.png`

## 3. Files Modified

- `packages/desktop-client/src/flow/FlowSettingsPage.tsx`

## 4. Layout Problems Fixed

- Fixed section/card vertical collapse caused by the page container inheriting `minHeight: 0`.
- Replaced dense editable rows with item sub-cards for Household, Income Plan, Fixed Bills, Variable Spending, and Scenarios.
- Added spacing, padding, and wrapping so labels, controls, helper text, and buttons no longer overlap.
- Fixed the Scenarios section so scenario rows are readable and push the JSON section down correctly.
- Moved the local storage notice into a top action/status card.
- Made JSON import/export collapsible so it no longer dominates the page by default.
- Added bottom padding and a max-width page container for better desktop/laptop layout.

## 5. UI Structure Implemented

- Top status/action bar with saved state, local storage notice, last updated timestamp, Save, Reset, Export, and Import.
- Main section cards for Household, Transaction Rules, Cashflow Parameters, Income Plan, Fixed Bills, Variable Spending, Scenarios, and JSON Import / Export.
- Reusable sub-card pattern for editable list items.
- Responsive wrapping field grid using flex-wrap.
- Collapsible native `<details>` JSON panel that opens automatically after export, import, or error status.

## 6. Functionality Preserved

- Household members add/edit/remove.
- Transaction rules edit.
- Cashflow parameters edit.
- Income plans add/edit/remove.
- Fixed bills add/edit/remove.
- Variable spending rules add/edit/remove.
- Scenarios add/edit/remove.
- Save, reset to defaults, export JSON, and import JSON.
- Local storage persistence under `flow.settings.v1`.
- Account/category dropdowns still use Actual account/category IDs.
- No Actual core calculations, schemas, migrations, sync, or CRDT logic changed.

## 7. Commands Run

- `node_modules\.bin\oxfmt.cmd --write packages\desktop-client\src\flow\FlowSettingsPage.tsx`
- `node_modules\.bin\oxlint.cmd --type-aware packages\desktop-client\src\flow\FlowSettingsPage.tsx`
- `node scripts\flow\check-flow-layout.mjs`
- `node .yarn\releases\yarn-4.13.0.cjs flow:check-layout`
- `git diff --check`
- `node .yarn\releases\yarn-4.13.0.cjs typecheck`
- `node .yarn\releases\yarn-4.13.0.cjs workspace @actual-app/web build`
- `node_modules\.bin\vite.cmd build --config packages\loot-core\vite.config.mts --mode development`
- Browser smoke test with Playwright using local Chrome.

## 8. Command Results

- Targeted format completed successfully.
- Targeted oxlint completed with 0 warnings and 0 errors.
- `node scripts\flow\check-flow-layout.mjs` passed.
- `yarn flow:check-layout` passed.
- `git diff --check` passed.
- Full typecheck passed.
- Web build passed. Existing Vite warnings remained: browser externalization of `vm`, large chunks, and plugin timing.
- Development browser worker was rebuilt after the production build.

## 9. Browser Smoke Test

Tested `http://localhost:3001/flow-settings` on a demo budget using Playwright and local Chrome.

- Page loaded without fatal error.
- Verified no section overlap on 1440px desktop viewport.
- Verified no section overlap on 900px narrow viewport.
- Clicked Add household member, Add income plan, Add fixed bill, Add variable spending rule, and Add scenario.
- Saved and confirmed local storage counts: 3 household members, 1 income plan, 1 fixed bill, 1 variable spending rule, 6 scenarios.
- Reloaded and confirmed counts persisted.
- Exported JSON and confirmed exported counts matched saved settings.
- Reset to defaults and confirmed counts returned to 2 household members, 0 income plans, 0 fixed bills, 0 variable spending rules, 5 scenarios.
- Imported the exported JSON and confirmed counts restored.

## 10. What Worked

- The `minHeight: 'auto'` page wrapper override fixed the actual rendered collapse without changing the shared `View` component.
- Existing TASK004 local storage and JSON import/export logic remained intact.
- Sub-cards made the editable list sections much easier to read and less fragile at narrower widths.
- The collapsible JSON panel kept the page focused while preserving import/export access.

## 11. What Did Not Work

- Earlier layout changes improved spacing but did not fully fix the visual collapse until the inherited `minHeight: 0` on the main page wrapper was overridden.
- The browser smoke test required the demo-budget setup path in a fresh Playwright context before reaching `/flow-settings`.

## 12. Risks / Concerns

- This task intentionally keeps scenarios as simple multiplier cards. They are still temporary until TASK005 implements the real rule-based Scenario Builder.
- Flow Settings still stores data in browser local storage only; shared/synced settings remain future work.
- The fix is scoped to Flow Settings and does not alter the shared `View` component, which is safer for the app but means other future long-form Flow pages should avoid inheriting `minHeight: 0` when they need natural document height.

## 13. Items To Finish Later

- Build the real Scenario Builder and replace simple multiplier cards.
- Move Flow Settings from browser-only local storage to the planned durable/shared storage layer.
- Add deeper UI tests once Flow Settings becomes part of a larger settings workflow.
- Eventually move System Check out of main navigation for normal users.

## 14. Recommended Next Task

TASK005 — Build Flow Scenario Builder and Parameterization Foundation.

---

## Follow-up: Compact Rows, Section Edit Forms, Autosave, and Help Tooltips

After review, Flow Settings was adjusted so editable list data is not permanently displayed as open forms.

### Summary

- Household, Income Plan, Fixed Bills, Variable Spending, and Scenarios now render as compact tables by default.
- Pressing Add creates one active form for the new item.
- Pressing Edit on a table row opens that item as a form.
- Pressing the section Save button collapses the active form back into a compact row.
- The active form item is hidden from the table until it is saved, avoiding duplicate row/form display.
- Whole-page autosave now runs after about 2.5 seconds of inactivity.
- Autosave updates the top status bar with a green check and timestamp.
- Saved timestamps are displayed using Actual's configured date format, with `HH:mm:ss` appended for time.
- Parameter help icons were added to table headers and form fields using the existing tooltip component.

### Files Modified

- `packages/desktop-client/src/flow/FlowSettingsPage.tsx`
- `AGENT_INSTRUCTIONS/CODEX/reports/TASK004B_RESULT.md`

### Functionality Preserved

- Manual Save remains available.
- Reset, Export JSON, and Import JSON remain available.
- Local storage key remains `flow.settings.v1`.
- Existing settings schema and planning storage remain unchanged.
- No Actual budget calculations, database schema, migrations, sync behavior, or CRDT logic changed.

### Browser Smoke Test

Tested in Chromium through Playwright on `http://localhost:3001/flow-settings`.

- Reset to defaults.
- Added and saved an Income Plan row.
- Confirmed the item did not appear in the table while its form was open.
- Confirmed Save income plan collapsed the form into a compact row.
- Edited the saved Income Plan row and saved it back to a row.
- Added and saved Fixed Bill, Variable Spending, Scenario, and Household rows.
- Waited for autosave and confirmed the new data was written to `flow.settings.v1`.
- Confirmed the saved/autosaved timestamp indicator appeared.
- Confirmed help icons rendered.

Screenshot artifact:

- `AGENT_INSTRUCTIONS/CODEX/reports/task004b-followup-row-autosave.png`

### Commands Run

- `node_modules\.bin\oxfmt.cmd --write packages\desktop-client\src\flow\FlowSettingsPage.tsx`
- `node_modules\.bin\oxlint.cmd --type-aware packages\desktop-client\src\flow\FlowSettingsPage.tsx`
- `node scripts\flow\check-flow-layout.mjs`
- `node .yarn\releases\yarn-4.13.0.cjs flow:check-layout`
- `git diff --check`
- `node .yarn\releases\yarn-4.13.0.cjs typecheck`
- `node .yarn\releases\yarn-4.13.0.cjs workspace @actual-app/web build`
- `node_modules\.bin\vite.cmd build --config packages\loot-core\vite.config.mts --mode development`

### Command Results

- Targeted format passed.
- Targeted oxlint passed with 0 warnings and 0 errors.
- Flow layout checks passed.
- `git diff --check` passed.
- Full typecheck passed.
- Web build passed with the existing Vite warnings about browser externalization of `vm`, large chunks, and plugin timing.
- Development browser worker was rebuilt after the production build.

### Notes / Risks

- Section Save buttons currently commit the row presentation state and collapse the form. Persistence is handled by the page autosave or the existing manual Save button.
- Tooltips explain current placeholder behavior where applicable, especially Scenarios, because the rule-based Scenario Builder still belongs in TASK005.
