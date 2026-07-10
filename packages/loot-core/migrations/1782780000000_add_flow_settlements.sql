BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS flow_settlements (
  id TEXT PRIMARY KEY,
  month TEXT,
  from_member_id TEXT,
  to_member_id TEXT,
  amount INTEGER DEFAULT 0,
  item_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  payment_transaction_id TEXT,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS flow_settlement_items (
  id TEXT PRIMARY KEY,
  settlement_id TEXT,
  month TEXT,
  actual_transaction_id TEXT,
  owed_by_member_id TEXT,
  owed_to_member_id TEXT,
  amount INTEGER DEFAULT 0,
  source_amount INTEGER DEFAULT 0,
  split_method TEXT,
  settlement_status TEXT,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS flow_settlements_month
  ON flow_settlements(month);

CREATE INDEX IF NOT EXISTS flow_settlement_items_month
  ON flow_settlement_items(month);

CREATE INDEX IF NOT EXISTS flow_settlement_items_settlement_id
  ON flow_settlement_items(settlement_id);

CREATE INDEX IF NOT EXISTS flow_settlement_items_actual_transaction_id
  ON flow_settlement_items(actual_transaction_id);

COMMIT;
