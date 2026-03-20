// SQLite via sql.js — pure JS, no native compilation required
const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DB_PATH = path.resolve(__dirname, '../../data/factory.db');

let db = null;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  const schema = fs.readFileSync(path.resolve(__dirname, 'schema.sql'), 'utf8');
  db.run(schema);

  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

// --- Session helpers ---

function generateId() {
  return crypto.randomUUID?.() || crypto.randomBytes(8).toString('hex');
}

async function createSession({ mode, title, genre, authorStyle, protagonist, state }) {
  const database = await getDb();
  const id = generateId();
  database.run(
    `INSERT INTO sessions (id, title, mode, genre, author_style, protagonist, state) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, title || null, mode, genre || null, authorStyle || null, protagonist || null, JSON.stringify(state || {})]
  );
  save();
  return id;
}

async function getSession(id) {
  const database = await getDb();
  const stmt = database.prepare(`SELECT * FROM sessions WHERE id = ?`);
  stmt.bind([id]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return { 
      ...row, 
      state: JSON.parse(row.state || '{}'),
      last_event: row.last_event ? JSON.parse(row.last_event) : null,
      streaming: Boolean(row.streaming)
    };
  }
  stmt.free();
  return null;
}

async function updateSession(id, updates) {
  const database = await getDb();
  const fields = [];
  const values = [];
  
  if (updates.state !== undefined) {
    fields.push('state = ?');
    values.push(JSON.stringify(updates.state));
  }
  if (updates.last_event !== undefined) {
    fields.push('last_event = ?');
    values.push(JSON.stringify(updates.last_event));
  }
  if (updates.streaming !== undefined) {
    fields.push('streaming = ?');
    values.push(updates.streaming ? 1 : 0);
  }
  if (updates.last_activity !== undefined) {
    fields.push('last_activity = ?');
    values.push(updates.last_activity);
  }
  
  if (fields.length === 0) return;
  
  values.push(id);
  database.run(`UPDATE sessions SET ${fields.join(', ')} WHERE id = ?`, values);
  save();
}

async function updateSessionState(id, state) {
  const database = await getDb();
  database.run(`UPDATE sessions SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [JSON.stringify(state), id]);
  save();
}

// --- Chapter helpers ---

async function addChapter(sessionId, index, content, emotion, validation, branchId = null, derivedFrom = null, extractedState = null) {
  const database = await getDb();
  database.run(
    `INSERT INTO scenes (session_id, index, content, emotion, validation, branch_id, derived_from, extracted_state) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, index, content, JSON.stringify(emotion || {}), validation || '', branchId, derivedFrom, extractedState ? JSON.stringify(extractedState) : null]
  );
  save();
}

async function getChapters(sessionId, branchId = null) {
  const database = await getDb();
  let query = `SELECT * FROM scenes WHERE session_id = ?`;
  const params = [sessionId];
  
  if (branchId !== undefined) {
    query += branchId ? ` AND branch_id = ?` : ` AND branch_id IS NULL`;
    params.push(branchId);
  }
  
  query += ` ORDER BY index`;
  
  const stmt = database.prepare(query);
  stmt.bind(params);
  const chapters = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    chapters.push({
      index: row.index,
      content: row.content,
      emotion: JSON.parse(row.emotion || '{}'),
      validation: row.validation,
      branch_id: row.branch_id,
      status: row.status,
      last_edited: row.last_edited,
      derived_from: row.derived_from,
      extracted_state: row.extracted_state ? JSON.parse(row.extracted_state) : null,
      created_at: row.created_at,
    });
  }
  stmt.free();
  return chapters;
}

async function getChapter(sessionId, index, branchId = null) {
  const chapters = await getChapters(sessionId, branchId);
  const chapter = chapters.find(c => c.index === index) || null;
  if (chapter) {
    // Also fetch derived_from and extracted_state
    const database = await getDb();
    let query = `SELECT derived_from, extracted_state FROM scenes WHERE session_id = ? AND index = ?`;
    const params = [sessionId, index];
    if (branchId !== null) {
      query += ` AND branch_id = ?`;
      params.push(branchId);
    } else {
      query += ` AND branch_id IS NULL`;
    }
    const stmt = database.prepare(query);
    stmt.bind(params);
    if (stmt.step()) {
      const row = stmt.getAsObject();
      chapter.derived_from = row.derived_from;
      chapter.extracted_state = row.extracted_state ? JSON.parse(row.extracted_state) : null;
    }
    stmt.free();
  }
  return chapter;
}

async function updateChapterContent(sessionId, index, content, branchId = null, extractedState = null, derivedFrom = null) {
  const database = await getDb();
  let query = `UPDATE scenes SET content = ?, status = 'edited', last_edited = CURRENT_TIMESTAMP, extracted_state = ?, derived_from = ? WHERE session_id = ? AND index = ?`;
  const params = [content, extractedState ? JSON.stringify(extractedState) : null, derivedFrom, sessionId, index];
  
  if (branchId !== null) {
    query += ` AND branch_id = ?`;
    params.push(branchId);
  } else {
    query += ` AND branch_id IS NULL`;
  }
  
  database.run(query, params);
  save();
}

async function getChapterState(sessionId, upToIndex) {
  const chapters = await getChapters(sessionId);
  const relevantChapters = chapters.filter(c => c.index < upToIndex);
  
  // Aggregate state from all previous chapters
  const state = {
    characters: [],
    inventory: [],
    deadCharacters: [],
    removedInventory: [],
    worldRules: [],
    events: [],
  };
  
  for (const chapter of relevantChapters) {
    // Extract characters
    const charMatches = chapter.content.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*/g) || [];
    state.characters.push(...charMatches);
    
    // Check for death mentions
    const deathMatches = chapter.content.match(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*).*?(?:died|dead|killed|passed away)/gi) || [];
    for (const match of deathMatches) {
      const name = match.replace(/.*?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*).*/i, '$1');
      if (!state.deadCharacters.includes(name)) {
        state.deadCharacters.push(name);
      }
    }
    
    // Extract inventory
    const invPatterns = [
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:carries|has|holds|wields|owns)/g,
    ];
    for (const pattern of invPatterns) {
      let match;
      while ((match = pattern.exec(chapter.content)) !== null) {
        if (!state.inventory.includes(match[1])) {
          state.inventory.push(match[1]);
        }
      }
    }
  }
  
  // Deduplicate
  state.characters = [...new Set(state.characters)];
  state.inventory = [...new Set(state.inventory)];
  
  return state;
}

// --- Revision helpers (5-revision FIFO) ---

async function addRevision(chapterId, content, emotion) {
  const database = await getDb();
  database.run(
    `INSERT INTO revisions (scene_id, content, emotion) VALUES (?, ?, ?)`,
    [chapterId, content, JSON.stringify(emotion || {})]
  );
  
  // Keep only 5 revisions per chapter (FIFO)
  const stmt = database.prepare(`
    SELECT id FROM revisions WHERE scene_id = ? ORDER BY created_at DESC LIMIT 5 OFFSET 4
  `);
  stmt.bind([chapterId]);
  const toDelete = [];
  while (stmt.step()) {
    toDelete.push(stmt.getAsObject().id);
  }
  stmt.free();
  
  for (const revId of toDelete) {
    database.run(`DELETE FROM revisions WHERE id = ?`, [revId]);
  }
  
  save();
}

async function getRevisions(chapterId) {
  const database = await getDb();
  const stmt = database.prepare(`SELECT * FROM revisions WHERE scene_id = ? ORDER BY created_at DESC`);
  stmt.bind([chapterId]);
  const revisions = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    revisions.push({
      id: row.id,
      content: row.content,
      emotion: JSON.parse(row.emotion || '{}'),
      created_at: row.created_at,
    });
  }
  stmt.free();
  return revisions;
}

async function getChapterId(sessionId, index, branchId = null) {
  const database = await getDb();
  let query = `SELECT id FROM scenes WHERE session_id = ? AND index = ?`;
  const params = [sessionId, index];
  
  if (branchId !== null) {
    query += ` AND branch_id = ?`;
    params.push(branchId);
  } else {
    query += ` AND branch_id IS NULL`;
  }
  
  const stmt = database.prepare(query);
  stmt.bind(params);
  
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row.id;
  }
  
  stmt.free();
  return null;
}

// --- Legacy scene helpers (for compatibility) ---

async function addScene(sessionId, index, content, emotion, validation, branchId = null) {
  return addChapter(sessionId, index, content, emotion, validation, branchId);
}

async function getScenes(sessionId, branchId = null) {
  return getChapters(sessionId, branchId);
}

async function updateSceneContent(sessionId, index, content, branchId = null) {
  return updateChapterContent(sessionId, index, content, branchId);
}

module.exports = {
  getDb, save,
  createSession, getSession, updateSession, updateSessionState,
  addChapter, getChapters, getChapter, updateChapterContent, getChapterState,
  addRevision, getRevisions, getChapterId,
  addScene, getScenes, updateSceneContent,
};