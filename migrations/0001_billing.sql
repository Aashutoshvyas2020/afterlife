CREATE TABLE IF NOT EXISTS billing_entitlements (
  token_hash TEXT PRIMARY KEY NOT NULL CHECK (length(token_hash) = 64),
  checkout_key TEXT NOT NULL UNIQUE CHECK (length(checkout_key) = 64),
  checkout_session_id TEXT UNIQUE,
  state TEXT NOT NULL CHECK (state IN ('pending', 'paid')),
  created_at INTEGER NOT NULL,
  paid_at INTEGER,
  CHECK ((state = 'pending' AND paid_at IS NULL) OR (state = 'paid' AND paid_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS stripe_events (
  event_id TEXT PRIMARY KEY NOT NULL,
  received_at INTEGER NOT NULL
);
