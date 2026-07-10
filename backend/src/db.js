const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbFile = process.env.DB_PATH || path.join(dataDir, 'checkin.db');
const db = new Database(dbFile);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS seniors (
    senior_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    phone_number TEXT,
    preferred_checkin_time TEXT DEFAULT '09:00',
    person_in_charge_name TEXT,
    person_in_charge_phone TEXT,
    person_in_charge_email TEXT,
    nok_name TEXT,
    next_of_kin_phone TEXT,
    next_of_kin_email TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS checkins (
    checkin_id TEXT PRIMARY KEY,
    senior_id TEXT NOT NULL,
    checkin_timestamp TEXT NOT NULL,
    device_type TEXT DEFAULT 'web',
    app_version TEXT DEFAULT '1.0.0',
    FOREIGN KEY (senior_id) REFERENCES seniors(senior_id)
  );

  CREATE TABLE IF NOT EXISTS daily_status (
    status_id TEXT PRIMARY KEY,
    senior_id TEXT NOT NULL,
    date TEXT NOT NULL,
    checked_in_today INTEGER DEFAULT 0,
    last_checkin_time TEXT,
    push_reminder_sent INTEGER DEFAULT 0,
    FOREIGN KEY (senior_id) REFERENCES seniors(senior_id),
    UNIQUE(senior_id, date)
  );

  CREATE TABLE IF NOT EXISTS alert_log (
    alert_id TEXT PRIMARY KEY,
    senior_id TEXT,
    alert_date TEXT,
    alert_type TEXT,
    sent_at TEXT,
    recipient TEXT,
    content TEXT
  );

  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    senior_id TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS caregiver_push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

// ── Migrations ────────────────────────────────────────────────────────────────
try { db.exec('ALTER TABLE daily_status ADD COLUMN push_reminder_sent INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE seniors ADD COLUMN invite_code TEXT UNIQUE'); } catch {}

// New table: many-to-many caregiver ↔ senior links (replaces phone matching)
db.exec(`
  CREATE TABLE IF NOT EXISTS caregiver_senior_links (
    link_id       TEXT PRIMARY KEY,
    senior_id     TEXT NOT NULL REFERENCES seniors(senior_id),
    caregiver_phone TEXT NOT NULL,
    linked_at     TEXT DEFAULT (datetime('now')),
    UNIQUE(senior_id, caregiver_phone)
  );
`);

// Generate invite codes for any seniors that don't have one yet
const { randomUUID: _uuid } = require('crypto');
const { normalisePhone: _norm } = require('./phoneUtils');

function _genCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
  let c = '';
  for (let i = 0; i < 6; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return c;
}

const _noCode = db.prepare('SELECT senior_id FROM seniors WHERE invite_code IS NULL').all();
for (const s of _noCode) {
  let code;
  do { code = _genCode(); }
  while (db.prepare('SELECT 1 FROM seniors WHERE invite_code = ?').get(code));
  db.prepare('UPDATE seniors SET invite_code = ? WHERE senior_id = ?').run(code, s.senior_id);
}

// Auto-migrate existing person_in_charge_phone links into caregiver_senior_links
const _existing = db.prepare('SELECT senior_id, person_in_charge_phone, next_of_kin_phone FROM seniors WHERE is_active = 1').all();
for (const s of _existing) {
  for (const raw of [s.person_in_charge_phone, s.next_of_kin_phone]) {
    const phone = _norm(raw || '');
    if (!phone) continue;
    try {
      db.prepare('INSERT OR IGNORE INTO caregiver_senior_links (link_id, senior_id, caregiver_phone) VALUES (?, ?, ?)')
        .run(_uuid(), s.senior_id, phone);
    } catch {}
  }
}

module.exports = db;
