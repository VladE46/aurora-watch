const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = path.resolve(process.env.DB_PATH || './data/aurora.db');

// Ensure the data directory exists
const dir = path.dirname(DB_PATH);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

let db;

function getDb() {
  if (db) return db;
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) {
      console.error('Failed to open database:', err.message);
      process.exit(1);
    }
    console.log('Connected to SQLite database at', DB_PATH);
  });
  return db;
}

function initDb() {
  return new Promise((resolve, reject) => {
    const database = getDb();
    database.serialize(() => {
      // Enable WAL mode for better concurrency
      database.run('PRAGMA journal_mode=WAL');

      // Subscribers table
      database.run(`
        CREATE TABLE IF NOT EXISTS subscribers (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          email        TEXT    NOT NULL UNIQUE COLLATE NOCASE,
          lat          REAL    NOT NULL,
          lon          REAL    NOT NULL,
          location_name TEXT   NOT NULL,
          threshold    INTEGER NOT NULL DEFAULT 50,
          active       INTEGER NOT NULL DEFAULT 1,
          token        TEXT    NOT NULL UNIQUE,
          created_at   TEXT    NOT NULL DEFAULT (datetime('now')),
          updated_at   TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `);

      // Alert log — records every email sent to avoid spamming
      database.run(`
        CREATE TABLE IF NOT EXISTS alert_log (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          subscriber_id   INTEGER NOT NULL REFERENCES subscribers(id),
          aurora_prob     REAL    NOT NULL,
          kp_index        REAL,
          cloud_cover     REAL,
          sent_at         TEXT    NOT NULL DEFAULT (datetime('now'))
        )
      `, (err) => {
        if (err) reject(err);
        else {
          console.log('Database tables ready');
          resolve();
        }
      });
    });
  });
}

// Helper: promisify db.run
function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

// Helper: promisify db.get
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

// Helper: promisify db.all
function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

module.exports = { initDb, dbRun, dbGet, dbAll };
