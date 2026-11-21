-- Phase 7: persistent Telegram conversational response modes.
ALTER TABLE telegram_accounts
  ADD COLUMN response_mode TEXT NOT NULL DEFAULT 'human'
  CHECK (response_mode IN ('human', 'simple', 'deep_thinking'));

CREATE INDEX idx_telegram_accounts_mode ON telegram_accounts(response_mode);
