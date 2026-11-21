-- Add the explicit execution state machine alongside the legacy status column.
ALTER TABLE tasks ADD COLUMN execution_state TEXT NOT NULL DEFAULT 'pending'
  CHECK (execution_state IN ('pending', 'assigned', 'running', 'completed', 'failed', 'blocked', 'cancelled'));

UPDATE tasks SET execution_state = CASE status
  WHEN 'in_progress' THEN 'running'
  WHEN 'pending'     THEN 'pending'
  WHEN 'assigned'    THEN 'assigned'
  WHEN 'completed'   THEN 'completed'
  WHEN 'blocked'     THEN 'blocked'
  WHEN 'cancelled'   THEN 'cancelled'
  ELSE 'pending'
END;

CREATE INDEX idx_tasks_execution_state ON tasks(execution_state);
