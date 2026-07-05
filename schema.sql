CREATE TABLE IF NOT EXISTS results (
  id TEXT PRIMARY KEY,            -- client UUID (idempotency)
  ts INTEGER NOT NULL,            -- unix ms
  user_email TEXT,                -- stamped server-side from Cf-Access-Authenticated-User-Email
  kind TEXT NOT NULL,             -- drill | quiz | redo | simulacro | recall | scenario | block | rapidfire | distractor_explain | feedback
  family TEXT,
  tier INTEGER,
  chapter TEXT,
  category TEXT,
  score INTEGER, total INTEGER,
  duration_sec INTEGER,
  detail_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_results_ts ON results(ts);
CREATE INDEX IF NOT EXISTS idx_results_kind ON results(kind);
