const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'flight_booking.db');
let db = null;

// -----------------------------
// Initialize DB
// -----------------------------
async function initializeDatabase() {
  try {
    db = new Database(dbPath, { verbose: console.log });
    console.log('Connected to SQLite database at:', dbPath);

    // Enable foreign keys
    db.pragma('foreign_keys = ON');

    // Load schema file
    const schemaPath = path.join(__dirname, '../../db/schema.sqlite.sql');

    if (fs.existsSync(schemaPath)) {
      const schema = fs.readFileSync(schemaPath, 'utf8');

      const statements = schema
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const stmt of statements) {
        db.prepare(stmt).run();
      }

      console.log('Database tables initialized successfully');
    }

    return db;

  } catch (err) {
    console.error('Database initialization failed:', err);
    throw err;
  }
}

// -----------------------------
// Wrapper Functions (Promise API)
// -----------------------------
function runAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const info = stmt.run(...params);
      resolve({ lastID: info.lastInsertRowid, changes: info.changes });
    } catch (err) {
      reject(err);
    }
  });
}

function getAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const row = stmt.get(...params);
      resolve(row);
    } catch (err) {
      reject(err);
    }
  });
}

function allAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    try {
      const stmt = db.prepare(sql);
      const rows = stmt.all(...params);
      resolve(rows);
    } catch (err) {
      reject(err);
    }
  });
}

function execAsync(sql) {
  return new Promise((resolve, reject) => {
    try {
      db.exec(sql);
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

// -----------------------------
// Transactions
// -----------------------------
function beginTransaction() {
  return runAsync('BEGIN TRANSACTION');
}

function commit() {
  return runAsync('COMMIT');
}

function rollback() {
  return runAsync('ROLLBACK');
}

// -----------------------------
// Close DB
// -----------------------------
function closeDatabase() {
  return new Promise((resolve, reject) => {
    try {
      if (db) {
        db.close();
        db = null;
      }
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  initializeDatabase,
  runAsync,
  getAsync,
  allAsync,
  execAsync,
  beginTransaction,
  commit,
  rollback,
  closeDatabase,
  getDb: () => db,
};
