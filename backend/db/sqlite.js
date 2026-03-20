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
    return { ...row, state: JSON.parse(row.state || '{}') };
  }
  stmt.free();
  return null;
}

async function updateSessionState(id, state) {
  const database = await getDb();
  database.run(`UPDATE sessions SET state = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [JSON.stringify(state), id]);
  save();
}

async function addScene(sessionId, index, content, emotion, validation) {
  const database = await getDb();
  database.run(
    `INSERT INTO scenes (session_id, index, content, emotion, validation) VALUES (?, ?, ?, ?, ?)`,
    [sessionId, index, content, JSON.stringify(emotion || {}), validation || '']
  );
  save();
}

async function getScenes(sessionId) {
  const database = await getDb();
  const stmt = database.prepare(`SELECT * FROM scenes WHERE session_id = ? ORDER BY index`);
  stmt.bind([sessionId]);
  const scenes = [];
  while (stmt.step()) {
    const row = stmt.getAsObject();
    scenes.push({
      index: row.index,
      text: row.content,
      emotion: JSON.parse(row.emotion || '{}'),
      validation: row.validation,
    });
  }
  stmt.free();
  return scenes;
}

async function updateSceneContent(sessionId, index, content) {
  const database = await getDb();
  database.run(`UPDATE scenes SET content = ? WHERE session_id = ? AND index = ?`, [content, sessionId, index]);
  save();
}

module.exports = {
  getDb, save,
  createSession, getSession, updateSessionState,
  addScene, getScenes, updateSceneContent,
};