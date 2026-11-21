-- Phase 6: secure Telegram command centre.
-- Pairing codes are stored as SHA-256 hashes only; plaintext codes are never persisted.

CREATE TABLE telegram_pairing_codes (
  id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  used_by_telegram_user_id TEXT,
  used_by_chat_id TEXT
);

CREATE INDEX idx_telegram_pairing_user ON telegram_pairing_codes(user_id, created_at);
CREATE INDEX idx_telegram_pairing_expiry ON telegram_pairing_codes(expires_at);

CREATE TABLE telegram_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  telegram_user_id TEXT NOT NULL UNIQUE,
  chat_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked')),
  paired_at TEXT NOT NULL,
  last_message_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_telegram_accounts_status ON telegram_accounts(status);
CREATE INDEX idx_telegram_accounts_last_message ON telegram_accounts(last_message_at);

CREATE TABLE telegram_updates (
  update_id TEXT PRIMARY KEY,
  telegram_user_id TEXT NOT NULL DEFAULT '',
  chat_id TEXT NOT NULL DEFAULT '',
  message_id TEXT,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_telegram_updates_received ON telegram_updates(received_at);
