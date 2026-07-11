BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS flow_settlement_payment_links (
  id TEXT PRIMARY KEY,
  settlement_id TEXT,
  month TEXT,
  payment_transaction_id TEXT,
  amount INTEGER DEFAULT 0,
  link_status TEXT DEFAULT 'linked',
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS flow_settlement_month_closures (
  id TEXT PRIMARY KEY,
  month TEXT,
  status TEXT DEFAULT 'open',
  closed_at TEXT,
  reopened_at TEXT,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS flow_settlement_payment_links_month
  ON flow_settlement_payment_links(month);

CREATE INDEX IF NOT EXISTS flow_settlement_payment_links_settlement_id
  ON flow_settlement_payment_links(settlement_id);

CREATE INDEX IF NOT EXISTS flow_settlement_payment_links_payment_transaction_id
  ON flow_settlement_payment_links(payment_transaction_id);

CREATE INDEX IF NOT EXISTS flow_settlement_month_closures_month
  ON flow_settlement_month_closures(month);

COMMIT;
