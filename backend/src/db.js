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
`);

module.exports = db;
