-- Phase 8: shared conversational workspace, chat persistence and user AI preferences.

CREATE TABLE IF NOT EXISTS user_ai_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  response_mode TEXT NOT NULL DEFAULT 'human'
    CHECK (response_mode IN ('human', 'simple', 'deep_thinking')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO user_ai_preferences (user_id, response_mode)
SELECT user_id, response_mode
FROM telegram_accounts
WHERE status = 'active'
ON CONFLICT(user_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'web' CHECK (channel IN ('web', 'telegram')),
  title TEXT NOT NULL DEFAULT '',
  response_mode TEXT NOT NULL DEFAULT 'human'
    CHECK (response_mode IN ('human', 'simple', 'deep_thinking')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_message_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_conversations_user
  ON conversations(user_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_conversations_channel
  ON conversations(user_id, channel, updated_at);

CREATE TABLE IF NOT EXISTS conversation_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL DEFAULT '',
  task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
  agent_name TEXT NOT NULL DEFAULT '',
  provider TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL DEFAULT '',
  execution_status TEXT NOT NULL DEFAULT '',
  response_mode TEXT NOT NULL DEFAULT 'human'
    CHECK (response_mode IN ('human', 'simple', 'deep_thinking')),
  client_message_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation
  ON conversation_messages(conversation_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_messages_client
  ON conversation_messages(user_id, client_message_id)
  WHERE client_message_id IS NOT NULL AND client_message_id <> '';
