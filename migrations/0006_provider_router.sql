-- Phase 5: provider routing, fallback and usage metadata.
ALTER TABLE tasks ADD COLUMN provider TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN provider_model TEXT NOT NULL DEFAULT '';
ALTER TABLE tasks ADD COLUMN fallback_used INTEGER NOT NULL DEFAULT 0 CHECK (fallback_used IN (0, 1));
ALTER TABLE tasks ADD COLUMN fallback_reason TEXT NOT NULL DEFAULT '';

CREATE INDEX idx_tasks_provider ON tasks(provider);
