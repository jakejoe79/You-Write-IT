CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  mode TEXT NOT NULL,
  genre TEXT,
  author_style TEXT,
  protagonist TEXT,
  state TEXT,           -- JSON: emotion, characters, inventory, choices, world_rules
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scenes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  index INTEGER NOT NULL,
  content TEXT NOT NULL,
  emotion TEXT,         -- JSON emotion state at generation time
  validation TEXT,      -- continuity validation result
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scenes_session ON scenes(session_id, index);