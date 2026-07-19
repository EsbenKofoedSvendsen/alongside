import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { seed } from "./seed";

// On Vercel the project directory is read-only — use /tmp instead. Note that
// /tmp is per-instance and ephemeral there: the pilot demo re-seeds itself on
// every cold start. Swap in a hosted DB (Turso/Postgres) for persistent data.
const DATA_DIR = process.env.VERCEL ? "/tmp/alongside-data" : path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "alongside.db");

declare global {
  var __alongsideDb: Database.Database | undefined;
}

function createDb(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'caregiver' CHECK (role IN ('caregiver','ops')),
      onboarded_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS elders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      age INTEGER,
      photo_emoji TEXT DEFAULT '🌸',
      conditions TEXT NOT NULL DEFAULT '[]',       -- JSON array
      care_needs TEXT DEFAULT '',
      routine TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS elder_preferences (
      elder_id INTEGER PRIMARY KEY REFERENCES elders(id) ON DELETE CASCADE,
      favorite_foods TEXT DEFAULT '',
      music TEXT DEFAULT '',
      hobbies TEXT DEFAULT '',
      routines TEXT DEFAULT '',
      dislikes TEXT DEFAULT '',
      calming_strategies TEXT DEFAULT '',
      mobility_limits TEXT DEFAULT '',
      communication_style TEXT DEFAULT '',
      dietary_restrictions TEXT DEFAULT '',
      updated_at TEXT,
      updated_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS care_circle (
      elder_id INTEGER NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (elder_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS family_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      elder_id INTEGER NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      relationship TEXT DEFAULT '',
      channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp','sms')),
      phone TEXT NOT NULL,
      is_digest_recipient INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT NOT NULL UNIQUE,
      elder_id INTEGER NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
      invitee_name TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
      created_by INTEGER REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      accepted_at TEXT
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      elder_id INTEGER NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'New conversation',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','playbook_offer','playbook','escalation','warning')),
      content TEXT NOT NULL,
      meta TEXT DEFAULT '{}',                      -- JSON
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS playbooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      summary TEXT NOT NULL,
      triggers TEXT NOT NULL DEFAULT '[]',         -- JSON array of keyword groups
      steps TEXT NOT NULL DEFAULT '[]',            -- JSON array of {title, detail, caution?}
      contraindications TEXT NOT NULL DEFAULT '[]',-- JSON array of {ifProfileHas, avoidStep, note}
      reviewed_by TEXT NOT NULL DEFAULT '',
      version TEXT NOT NULL DEFAULT '1.0'
    );

    CREATE TABLE IF NOT EXISTS playbook_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playbook_id INTEGER NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      elder_id INTEGER NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
      conversation_id INTEGER REFERENCES conversations(id) ON DELETE SET NULL,
      checked_steps TEXT NOT NULL DEFAULT '[]',    -- JSON array of step indexes
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','resolved','needs_help')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      elder_id INTEGER NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
      author_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      category TEXT NOT NULL DEFAULT 'observation' CHECK (category IN ('question','update','observation','urgent')),
      content TEXT NOT NULL,
      shareable INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      elder_id INTEGER NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
      created_by INTEGER REFERENCES users(id),
      severity TEXT NOT NULL DEFAULT 'warning' CHECK (severity IN ('emergency','warning')),
      title TEXT NOT NULL,
      detail TEXT DEFAULT '',
      source_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL,
      shared_with_family INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS digests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      elder_id INTEGER NOT NULL REFERENCES elders(id) ON DELETE CASCADE,
      caregiver_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      digest_date TEXT NOT NULL,
      draft TEXT NOT NULL DEFAULT '',
      final TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','failed')),
      sent_at TEXT,
      recipients TEXT NOT NULL DEFAULT '[]',       -- JSON
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (elder_id, caregiver_id, digest_date)
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      props TEXT NOT NULL DEFAULT '{}',            -- JSON
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_notes_elder ON notes(elder_id);
    CREATE INDEX IF NOT EXISTS idx_alerts_elder ON alerts(elder_id);
    CREATE INDEX IF NOT EXISTS idx_events_name ON events(name);
  `);

  const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number };
  if (userCount.n === 0) {
    seed(db);
  }
}

export function getDb(): Database.Database {
  if (!global.__alongsideDb) {
    global.__alongsideDb = createDb();
  }
  return global.__alongsideDb;
}
