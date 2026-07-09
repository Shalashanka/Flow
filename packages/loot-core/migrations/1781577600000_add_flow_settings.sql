BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS flow_settings (
  id TEXT PRIMARY KEY,
  version INTEGER DEFAULT 1,
  data TEXT DEFAULT '{}',
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS flow_transaction_metadata (
  id TEXT PRIMARY KEY,
  actual_transaction_id TEXT,
  data TEXT DEFAULT '{}',
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS flow_transaction_metadata_actual_transaction_id
  ON flow_transaction_metadata(actual_transaction_id);

COMMIT;
