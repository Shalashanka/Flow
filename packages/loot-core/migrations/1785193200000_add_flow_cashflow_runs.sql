BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS flow_cashflow_runs (
  id TEXT PRIMARY KEY,
  month TEXT,
  run_name TEXT,
  starting_cash INTEGER DEFAULT 0,
  starting_cash_source TEXT DEFAULT 'manual',
  selected_account_ids TEXT,
  safe_minimum_balance INTEGER DEFAULT 0,
  warning_balance INTEGER DEFAULT 0,
  one_off_name TEXT,
  one_off_amount INTEGER DEFAULT 0,
  one_off_date TEXT,
  status TEXT DEFAULT 'draft',
  lowest_balance INTEGER DEFAULT 0,
  projected_end_balance INTEGER DEFAULT 0,
  first_failure_date TEXT,
  generated_at TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS flow_cashflow_rows (
  id TEXT PRIMARY KEY,
  run_id TEXT,
  row_date TEXT,
  row_type TEXT,
  name TEXT,
  account_id TEXT,
  category_id TEXT,
  inflow INTEGER DEFAULT 0,
  outflow INTEGER DEFAULT 0,
  balance_after INTEGER DEFAULT 0,
  confirmed INTEGER DEFAULT 0,
  source TEXT,
  source_id TEXT,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS flow_cashflow_runs_month
  ON flow_cashflow_runs(month);

CREATE INDEX IF NOT EXISTS flow_cashflow_runs_generated_at
  ON flow_cashflow_runs(generated_at);

CREATE INDEX IF NOT EXISTS flow_cashflow_rows_run_id
  ON flow_cashflow_rows(run_id);

CREATE INDEX IF NOT EXISTS flow_cashflow_rows_date
  ON flow_cashflow_rows(row_date);

COMMIT;
