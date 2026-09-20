CREATE TABLE IF NOT EXISTS subscriptions (
  device_id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  timezone TEXT NOT NULL,
  reminders_json TEXT NOT NULL DEFAULT '[]',
  last_sent_json TEXT NOT NULL DEFAULT '{}',
  updated_at INTEGER NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_endpoint
  ON subscriptions(endpoint);
