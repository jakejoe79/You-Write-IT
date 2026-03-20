CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  mode TEXT NOT NULL,
  genre TEXT,
  author_style TEXT,
  protagonist TEXT,
  state TEXT,           -- JSON: emotion, characters, inventory, choices, world_rules
  last_event TEXT,      -- JSON: last SSE event for resume
  streaming INTEGER DEFAULT 0,  -- 1 if currently streaming
  last_activity DATETIME,       -- last activity timestamp
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
  branch_id TEXT,       -- NULL for main story, branch ID for adventure
  status TEXT DEFAULT 'complete',  -- 'complete', 'incomplete', 'edited'
  last_edited DATETIME, -- timestamp of last edit
  derived_from INTEGER, -- if recomputed, the original chapter index
  extracted_state TEXT, -- JSON: extracted characters, inventory, deadCharacters for edited chapters
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS revisions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scene_id INTEGER NOT NULL REFERENCES scenes(id),
  content TEXT NOT NULL,
  emotion TEXT,         -- JSON emotion state at revision time
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_scenes_session ON scenes(session_id, index);
CREATE INDEX IF NOT EXISTS idx_scenes_branch ON scenes(session_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_revisions_scene ON revisions(scene_id);