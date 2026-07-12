BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS flow_debts (
  id TEXT PRIMARY KEY,
  name TEXT,
  lender TEXT,
  actual_account_id TEXT,
  actual_category_id TEXT,
  original_amount INTEGER DEFAULT 0,
  current_balance_override INTEGER,
  minimum_payment INTEGER DEFAULT 0,
  planned_payment INTEGER DEFAULT 0,
  due_day INTEGER,
  interest_rate_bps INTEGER DEFAULT 0,
  priority TEXT DEFAULT 'normal',
  status TEXT DEFAULT 'active',
  active INTEGER DEFAULT 1,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS flow_debts_actual_account_id
  ON flow_debts(actual_account_id);

CREATE INDEX IF NOT EXISTS flow_debts_actual_category_id
  ON flow_debts(actual_category_id);

CREATE INDEX IF NOT EXISTS flow_debts_status
  ON flow_debts(status);

COMMIT;
