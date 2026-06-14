# Flow Repo Management Guide

This file is for Griseld and for CODEX.

The project is a fork of Actual Budget. The goal is to build a separate product named **Flow**, while keeping the original Actual Budget base easy to update later.

---

## 1. Main Goal

Keep two things separate:

```text
Actual Budget base code  = kept as clean as possible
Flow product code        = custom changes for the new product
```

The repo should be managed so that future updates from Actual Budget can still be pulled in without turning the repo into a mess.

---

## 2. Repo Remotes

Use two Git remotes:

```text
origin   = Griseld's fork
upstream = original Actual Budget repo
```

Expected setup:

```powershell
git remote -v
```

Should show something like:

```text
origin    https://github.com/Shalashanka/Flow.git
upstream  https://github.com/actualbudget/actual.git
```

If `upstream` is missing, add it:

```powershell
git remote add upstream https://github.com/actualbudget/actual.git
```

---

## 3. Branch Roles

The repo should use this branch logic:

```text
master or main      = clean branch synced with Actual Budget
flow-product        = main custom Flow product branch
feature/*           = short-term branches for specific changes
fix/*               = short-term branches for fixes
```

Important rule:

```text
Do not put custom Flow product work directly into master/main.
```

The clean base branch should stay as close as possible to Actual Budget.

---

## 4. First Local Setup

Clone the fork:

```powershell
cd C:\dev
git clone https://github.com/Shalashanka/Flow.git
cd Flow
```

Add upstream:

```powershell
git remote add upstream https://github.com/actualbudget/actual.git
```

Create the product branch:

```powershell
git checkout -b flow-product
git push -u origin flow-product
```

---

## 5. Daily Work

Before making changes:

```powershell
git status
git branch
```

Make sure the active branch is not `master` or `main`.

Expected:

```text
* flow-product
```

If you are on `master` or `main`, switch branch first:

```powershell
git checkout flow-product
```

Then make the changes.

Commit:

```powershell
git add .
git commit -m "Clear commit message"
git push
```

---

## 6. Feature Branches

For bigger changes, create a feature branch from `flow-product`:

```powershell
git checkout flow-product
git pull
git checkout -b feature/name-of-change
```

After work is done:

```powershell
git add .
git commit -m "Add name of change"
git push -u origin feature/name-of-change
```

Then merge it into `flow-product` later.

---

## 7. Keeping Actual Budget Updated

When syncing future Actual Budget updates, update the clean base branch first.

Use `master` below if the repo uses `master`.
Use `main` instead if the repo uses `main`.

```powershell
git checkout master
git fetch upstream
git merge upstream/master
git push origin master
```

Then bring those updates into Flow:

```powershell
git checkout flow-product
git merge master
git push
```

Update path:

```text
upstream/master
      ↓
origin/master
      ↓
flow-product
```

Do not pull Actual Budget updates straight into random feature branches.

---

## 8. ZIP Downloads

Do not use GitHub ZIP downloads for this project.

A ZIP download can be faster, but it is not good for long-term work.

A ZIP does not include:

```text
Git history
branches
remotes
commit links
merge support
easy sync with upstream
```

Use `git clone`.

A shallow clone is okay only as a temporary fix:

```powershell
git clone --depth 1 https://github.com/Shalashanka/Flow.git
cd Flow
git fetch --unshallow
```

For normal work, use a full clone.

---

## 9. How to Keep Flow Changes Separate

Prefer adding Flow code in new files and folders.

Good examples:

```text
flow/
flow-docs/
flow-scripts/
flow-config/
docs/flow/
```

Avoid large rewrites of original Actual Budget files unless there is no better way.

If changing original files, keep changes small and easy to review.

When needed, mark custom sections:

```ts
// FLOW CUSTOM START
// custom Flow code here
// FLOW CUSTOM END
```

This helps when merging future upstream updates.

---

## 10. CODEX Rules

CODEX must follow these rules before changing files.

### Before editing

Run:

```bash
git status
git branch
git remote -v
```

CODEX must not work on `master` or `main` unless the task is only about syncing from upstream.

If currently on `master` or `main`, switch to the product branch:

```bash
git checkout flow-product
```

For bigger changes, CODEX should create a feature branch:

```bash
git checkout flow-product
git pull
git checkout -b feature/short-task-name
```

### While editing

CODEX should:

- Prefer new Flow-specific files over changing original Actual Budget files.
- Keep changes small.
- Avoid formatting unrelated files.
- Avoid renaming large folders unless asked.
- Avoid moving core files unless asked.
- Avoid changing lockfiles unless dependencies were changed.
- Avoid adding new packages unless needed.
- Avoid secrets, tokens, passwords, API keys, or local paths in commits.
- Keep environment-specific settings in `.env.example` or docs, not in real `.env` files.
- Keep custom Flow code clear and easy to find.

### If editing original Actual files

CODEX should:

- Make the smallest possible change.
- Add comments only where useful.
- Use `FLOW CUSTOM START` and `FLOW CUSTOM END` markers if the change is not obvious.
- Avoid changing core behavior unless the task requires it.
- Mention in the commit message that Actual core files were touched.

### Before committing

Run:

```bash
git status
git diff
```

If available and not too slow, run project checks:

```bash
pnpm test
pnpm lint
pnpm typecheck
```

If the repo uses different commands, use the commands already defined in `package.json`.

### Commit style

Use clear commit messages.

Good examples:

```text
Add Flow onboarding page
Add Flow config loader
Fix Flow import date handling
Update docs for repo workflow
```

Bad examples:

```text
update
changes
fix stuff
wip
```

### Push rules

CODEX may push only to Griseld's fork, not to upstream.

Allowed:

```bash
git push origin branch-name
```

Not allowed:

```bash
git push upstream anything
```

Never force-push unless Griseld directly asks for it.

Not allowed unless clearly asked:

```bash
git push --force
git push --force-with-lease
```

---

## 11. Conflict Rules

When merging upstream updates, conflicts may happen.

Do not blindly accept one side.

General rule:

```text
Actual Budget base code should remain close to upstream.
Flow custom code should remain on top.
```

For conflicts:

1. Read both sides.
2. Keep upstream code when it is core Actual behavior.
3. Keep Flow code when it is a custom product feature.
4. Re-apply Flow code cleanly if needed.
5. Run tests/checks after conflict fixes.
6. Commit the merge.

---

## 12. Files That Need Extra Care

Be careful with these files:

```text
package.json
pnpm-lock.yaml
yarn.lock
package-lock.json
tsconfig files
database migration files
auth files
sync files
encryption files
import/export files
server config files
desktop app config files
```

Changing these can affect the whole app.

CODEX should change them only when the task requires it.

---

## 13. Dependency Rules

Before adding a dependency, check if the repo already has something that can do the job.

If adding a package:

1. Use the package manager already used by the repo.
2. Update the correct lockfile.
3. Explain why the package is needed.
4. Avoid adding large packages for small tasks.

Do not mix package managers.

If the repo uses `pnpm`, do not add `package-lock.json`.

---

## 14. Environment and Secrets

Never commit real secrets.

Do not commit:

```text
.env
.env.local
API keys
database passwords
private tokens
OAuth secrets
personal local paths
```

Use examples only:

```text
.env.example
```

Example values should be fake:

```text
DATABASE_URL=postgres://user:password@localhost:5432/flow
```

---

## 15. Safe Sync Checklist

Before syncing Actual Budget:

```powershell
git status
```

Working tree must be clean.

Then:

```powershell
git checkout master
git fetch upstream
git merge upstream/master
git push origin master
```

Then:

```powershell
git checkout flow-product
git merge master
```

If conflicts happen, fix them.

Then:

```powershell
git add .
git commit
git push
```

---

## 16. Safe Commit Checklist for Griseld

Before every commit:

```powershell
git branch
git status
git diff
```

Check:

```text
Am I on flow-product or a feature branch?
Did I avoid master/main?
Did I avoid unrelated files?
Did I avoid secrets?
Is the commit message clear?
```

Then:

```powershell
git add .
git commit -m "Clear commit message"
git push
```

---

## 17. Safe Commit Checklist for CODEX

Before CODEX commits:

```bash
git branch
git status
git diff
```

CODEX must check:

```text
Not on master/main unless syncing
No unrelated formatting
No secrets
No unwanted lockfile changes
No accidental file deletes
No changes outside the task
```

Then:

```bash
git add .
git commit -m "Clear commit message"
```

Push only to `origin`:

```bash
git push origin branch-name
```

---

## 18. Main Rule

The most important rule:

```text
Keep the base clean.
Keep Flow changes separate.
Sync upstream into base first.
Merge base into Flow after.
```

This keeps Flow alive as its own product while still allowing future Actual Budget updates.
