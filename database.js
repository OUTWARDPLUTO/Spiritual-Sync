// database.js — SQLite setup using sqlite3 (async API with prebuilt binaries)
require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const DB_PATH = path.join(dataDir, 'shloka.db');
const db = new sqlite3.Database(DB_PATH);

// ────────────────────────────────────────────────
// Promisified helpers
// ────────────────────────────────────────────────
function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function exec(sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

// ────────────────────────────────────────────────
// Schema initialization
// ────────────────────────────────────────────────
async function initDB() {
  await exec(`
    PRAGMA journal_mode=WAL;
    PRAGMA foreign_keys=ON;

    CREATE TABLE IF NOT EXISTS subscribers (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT    NOT NULL,
      email           TEXT    NOT NULL UNIQUE,
      plan            TEXT    NOT NULL DEFAULT 'trial',
      status          TEXT    NOT NULL DEFAULT 'active',
      preferred_hour  INTEGER NOT NULL DEFAULT 6,
      paid_until      TEXT,
      unsubscribe_token TEXT UNIQUE,
      razorpay_payment_id TEXT,
      razorpay_order_id   TEXT,
      welcome_sent    INTEGER NOT NULL DEFAULT 0,
      created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS send_log (
      id             INTEGER PRIMARY KEY AUTOINCREMENT,
      subscriber_id  INTEGER NOT NULL,
      shloka_id      INTEGER NOT NULL,
      ist_date       TEXT    NOT NULL,
      sent_at        TEXT    NOT NULL DEFAULT (datetime('now')),
      status         TEXT    NOT NULL DEFAULT 'sent',
      error_message  TEXT,
      FOREIGN KEY (subscriber_id) REFERENCES subscribers(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ai_cache (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      shloka_id       INTEGER NOT NULL,
      ist_date        TEXT    NOT NULL,
      ai_reflection   TEXT    NOT NULL,
      ai_practice     TEXT    NOT NULL,
      generated_at    TEXT    NOT NULL DEFAULT (datetime('now')),
      UNIQUE(shloka_id, ist_date)
    );

    CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
    CREATE INDEX IF NOT EXISTS idx_subscribers_hour  ON subscribers(preferred_hour, status);
    CREATE INDEX IF NOT EXISTS idx_send_log_date     ON send_log(subscriber_id, ist_date);
  `);

  // Safe migrations for new columns
  try { await exec(`ALTER TABLE subscribers ADD COLUMN preferred_language TEXT DEFAULT 'both'`); } catch(e) {}
  try { await exec(`ALTER TABLE subscribers ADD COLUMN primary_source TEXT DEFAULT 'all'`); } catch(e) {}
  try { await exec(`ALTER TABLE ai_cache ADD COLUMN ai_reflection_en TEXT`); } catch(e) {}
  try { await exec(`ALTER TABLE ai_cache ADD COLUMN ai_reflection_hi TEXT`); } catch(e) {}
  try { await exec(`ALTER TABLE ai_cache ADD COLUMN ai_practice_en TEXT`); } catch(e) {}
  try { await exec(`ALTER TABLE ai_cache ADD COLUMN ai_practice_hi TEXT`); } catch(e) {}

  console.log('✅ Database initialized:', DB_PATH);
}

// ────────────────────────────────────────────────
// Subscriber Queries
// ────────────────────────────────────────────────
const subscriberQueries = {
  getActiveForHour: (hour) => all(
    `SELECT * FROM subscribers WHERE preferred_hour = ? AND status = 'active' AND (paid_until IS NULL OR paid_until >= date('now'))`,
    [hour]
  ),

  alreadySentToday: (subscriberId, istDate) => get(
    `SELECT id FROM send_log WHERE subscriber_id = ? AND ist_date = ? LIMIT 1`,
    [subscriberId, istDate]
  ),

  create: (params) => run(
    `INSERT INTO subscribers (name, email, plan, preferred_hour, paid_until, unsubscribe_token, razorpay_payment_id, razorpay_order_id, status, preferred_language, primary_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [params.name, params.email, params.plan, params.preferred_hour, params.paid_until,
     params.unsubscribe_token, params.razorpay_payment_id, params.razorpay_order_id, params.status,
     params.preferred_language || 'both', params.primary_source || 'all']
  ),

  findByEmail: (email) => get(`SELECT * FROM subscribers WHERE email = ?`, [email]),

  findByToken: (token) => get(`SELECT * FROM subscribers WHERE unsubscribe_token = ?`, [token]),

  unsubscribe: (token) => run(`UPDATE subscribers SET status = 'unsubscribed' WHERE unsubscribe_token = ?`, [token]),

  markWelcomeSent: (id) => run(`UPDATE subscribers SET welcome_sent = 1 WHERE id = ?`, [id]),

  getAll: () => all(`SELECT * FROM subscribers ORDER BY created_at DESC`),

  countActive: () => get(`SELECT COUNT(*) as count FROM subscribers WHERE status = 'active'`),

  countTotal: () => get(`SELECT COUNT(*) as count FROM subscribers`),

  expireOld: () => run(
    `UPDATE subscribers SET status = 'expired' WHERE status = 'active' AND paid_until IS NOT NULL AND paid_until < date('now')`
  ),

  delete: (id) => run(`DELETE FROM subscribers WHERE id = ?`, [id]),

  manualCreate: (params) => run(
    `INSERT OR REPLACE INTO subscribers (name, email, plan, preferred_hour, paid_until, unsubscribe_token, status, preferred_language, primary_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [params.name, params.email, params.plan, params.preferred_hour,
     params.paid_until, params.unsubscribe_token, params.status,
     params.preferred_language || 'both', params.primary_source || 'all']
  ),

  updateProfile: (id, params) => run(
    `UPDATE subscribers SET preferred_hour = ?, preferred_language = ?, primary_source = ? WHERE id = ?`,
    [params.preferred_hour, params.preferred_language, params.primary_source, id]
  ),
};

// ────────────────────────────────────────────────
// Send Log Queries
// ────────────────────────────────────────────────
const logQueries = {
  record: (params) => run(
    `INSERT INTO send_log (subscriber_id, shloka_id, ist_date, status, error_message) VALUES (?, ?, ?, ?, ?)`,
    [params.subscriber_id, params.shloka_id, params.ist_date, params.status, params.error_message]
  ),

  getRecent: () => all(
    `SELECT sl.*, s.name, s.email FROM send_log sl
     JOIN subscribers s ON s.id = sl.subscriber_id
     ORDER BY sl.sent_at DESC LIMIT 100`
  ),

  getTodayCount: (istDate) => get(`SELECT COUNT(*) as count FROM send_log WHERE ist_date = ?`, [istDate]),
};

// ────────────────────────────────────────────────
// AI Cache Queries
// ────────────────────────────────────────────────
const cacheQueries = {
  get: (shlokaId, istDate) => get(
    `SELECT * FROM ai_cache WHERE shloka_id = ? AND ist_date = ?`,
    [shlokaId, istDate]
  ),
  set: (params) => run(
    `INSERT OR REPLACE INTO ai_cache (shloka_id, ist_date, ai_reflection_en, ai_reflection_hi, ai_practice_en, ai_practice_hi, ai_reflection, ai_practice)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [params.shloka_id, params.ist_date, params.ai_reflection_en, params.ai_reflection_hi, params.ai_practice_en, params.ai_practice_hi, params.ai_reflection_en || params.ai_reflection, params.ai_practice_en || params.ai_practice]
  ),
};

// ────────────────────────────────────────────────
// IST Helpers
// ────────────────────────────────────────────────
function getISTDateString() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return ist.toISOString().split('T')[0];
}

function getISTHour() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  return ist.getUTCHours();
}

function getDayOfYear() {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset);
  const start = new Date(Date.UTC(ist.getUTCFullYear(), 0, 0));
  const diff = ist - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

module.exports = {
  db,
  initDB,
  subscriberQueries,
  logQueries,
  cacheQueries,
  getISTDateString,
  getISTHour,
  getDayOfYear,
};
