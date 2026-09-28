-- One automatic native continuation per completed upstream task, even when
-- browser polling and scheduled refreshes race.
CREATE TABLE IF NOT EXISTS afterlife_handoff_recovery (
 task_id TEXT PRIMARY KEY,
 run_id TEXT NOT NULL,
 state TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 error TEXT
);
