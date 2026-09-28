CREATE TABLE IF NOT EXISTS afterlife_runs (
 id TEXT PRIMARY KEY, thesis TEXT NOT NULL, root_task_id TEXT, state TEXT NOT NULL DEFAULT 'starting',
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, snapshot TEXT, preview_url TEXT, preview_token TEXT, preview_header TEXT
);
CREATE TABLE IF NOT EXISTS product_purchases (
 token_hash TEXT PRIMARY KEY, run_id TEXT NOT NULL, session_id TEXT UNIQUE,
 amount INTEGER NOT NULL, state TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS runs_created ON afterlife_runs(created_at);
