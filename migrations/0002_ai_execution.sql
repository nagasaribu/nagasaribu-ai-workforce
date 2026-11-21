-- Phase 3 migration: permanent bootstrap lock, task results and execution metadata.
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

INSERT INTO system_settings (key, value)
SELECT 'bootstrap_completed', CASE WHEN EXISTS (SELECT 1 FROM users) THEN 'true' ELSE 'false' END
WHERE NOT EXISTS (SELECT 1 FROM system_settings WHERE key = 'bootstrap_completed');

ALTER TABLE tasks ADD COLUMN result TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN last_error TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN last_execution_at TEXT;
ALTER TABLE tasks ADD COLUMN execution_mode TEXT;
ALTER TABLE tasks ADD COLUMN execution_count INTEGER NOT NULL DEFAULT 0;

CREATE INDEX idx_tasks_execution ON tasks(last_execution_at);
CREATE INDEX idx_task_events_type ON task_events(event_type, created_at);
