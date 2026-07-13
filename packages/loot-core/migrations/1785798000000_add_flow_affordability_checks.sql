BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS flow_affordability_checks (
  id TEXT PRIMARY KEY,
  purchase_name TEXT,
  amount INTEGER DEFAULT 0,
  planned_date TEXT,
  account_id TEXT,
  category_id TEXT,
  paid_by_member_id TEXT,
  shared_status TEXT DEFAULT 'personal',
  split_method TEXT DEFAULT 'none',
  priority TEXT DEFAULT 'normal',
  can_wait INTEGER DEFAULT 1,
  notes TEXT,
  decision TEXT DEFAULT 'check',
  reason TEXT,
  recommended_action TEXT,
  month_checked TEXT,
  cashflow_run_id TEXT,
  balance_before INTEGER DEFAULT 0,
  balance_after INTEGER DEFAULT 0,
  lowest_balance_after INTEGER DEFAULT 0,
  first_failure_date TEXT,
  safe_minimum_balance INTEGER DEFAULT 0,
  warning_balance INTEGER DEFAULT 0,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS flow_affordability_checks_month
  ON flow_affordability_checks(month_checked);

CREATE INDEX IF NOT EXISTS flow_affordability_checks_created_at
  ON flow_affordability_checks(created_at);

COMMIT;
