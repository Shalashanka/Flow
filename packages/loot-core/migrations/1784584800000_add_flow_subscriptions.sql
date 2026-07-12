BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS flow_subscription_merchants (
  id TEXT PRIMARY KEY,
  canonical_name TEXT,
  match_pattern TEXT,
  default_category_id TEXT,
  typical_recurrence TEXT,
  active INTEGER DEFAULT 1,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS flow_subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT,
  payee_id TEXT,
  merchant_match_id TEXT,
  actual_schedule_id TEXT,
  category_id TEXT,
  account_id TEXT,
  amount INTEGER DEFAULT 0,
  recurrence TEXT DEFAULT 'unknown',
  first_seen TEXT,
  last_seen TEXT,
  next_expected_date TEXT,
  status TEXT DEFAULT 'candidate',
  confidence INTEGER DEFAULT 0,
  notes TEXT,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS flow_subscription_matches (
  id TEXT PRIMARY KEY,
  subscription_id TEXT,
  actual_transaction_id TEXT,
  match_type TEXT,
  confidence INTEGER DEFAULT 0,
  tombstone INTEGER DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS flow_subscription_merchants_pattern
  ON flow_subscription_merchants(match_pattern);

CREATE INDEX IF NOT EXISTS flow_subscriptions_payee_id
  ON flow_subscriptions(payee_id);

CREATE INDEX IF NOT EXISTS flow_subscriptions_status
  ON flow_subscriptions(status);

CREATE INDEX IF NOT EXISTS flow_subscription_matches_subscription_id
  ON flow_subscription_matches(subscription_id);

CREATE INDEX IF NOT EXISTS flow_subscription_matches_transaction_id
  ON flow_subscription_matches(actual_transaction_id);

COMMIT;
