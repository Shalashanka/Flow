# Flow Package

Flow is a product layer inside the Flow fork of Actual Budget.

Actual/Flow core remains the source of truth for:

- accounts
- transactions
- categories
- payees
- budgets
- transfers
- sync behavior
- budget files

Flow-owned modules will add:

- cashflow
- goals
- debts
- settlement
- monthly close
- account control
- affordability
- subscriptions
- deadlines
- investments
- system check
- monthly overview

Flow modules must avoid changing core budgeting calculations.

Flow modules should later read Actual data through an adapter.

Flow-specific metadata should later reference Actual records by ID, not by display name.

Example:

```ts
flowGoal.linkedCategoryId = actualCategoryId;
flowGoal.linkedAccountId = actualAccountId;
```

Avoid name-based matching except during import or mapping flows.
