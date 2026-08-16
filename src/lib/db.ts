import { config, ensureDirs } from './config';

// `node:sqlite` is experimental and Node-only. We lazy-import it so that
// serverless runtimes (Vercel + Supabase) never statically evaluate this
// module — they use Supabase instead of the local SQLite fallback.
type SqliteDb = import('node:sqlite').DatabaseSync;

let _db: SqliteDb | null = null;

function loadSqlite(): typeof import('node:sqlite') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('node:sqlite') as typeof import('node:sqlite');
}

export function getDb(): SqliteDb {
  if (_db) return _db;
  ensureDirs();
  const { DatabaseSync } = loadSqlite();
  _db = new DatabaseSync(config.dbPath);
  _db.exec('PRAGMA journal_mode = WAL;');
  _db.exec('PRAGMA foreign_keys = ON;');
  migrate(_db);
  return _db;
}

function migrate(db: SqliteDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT '',
      hike_date TEXT,
      context TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'Draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS media_assets (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      source_id TEXT NOT NULL UNIQUE,
      kind TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      filename TEXT NOT NULL,
      width INTEGER NOT NULL DEFAULT 0,
      height INTEGER NOT NULL DEFAULT 0,
      orientation TEXT NOT NULL DEFAULT 'landscape',
      bytes INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS enhancement_profiles (
      asset_id TEXT PRIMARY KEY,
      profile TEXT NOT NULL,
      engine TEXT NOT NULL,
      qa_confidence REAL NOT NULL DEFAULT 1,
      camera_analysis TEXT,
      analysis TEXT,
      FOREIGN KEY (asset_id) REFERENCES media_assets(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS concepts (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      data TEXT NOT NULL,
      score_total REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS carousels (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      concept_id TEXT,
      title TEXT NOT NULL DEFAULT '',
      pillar TEXT,
      data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Draft',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS google_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      access_token_enc TEXT NOT NULL,
      refresh_token_enc TEXT,
      expires_at TEXT,
      scope TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS instagram_connections (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE,
      access_token_enc TEXT NOT NULL,
      instagram_account_id TEXT,
      username TEXT,
      account_type TEXT,
      expires_at TEXT,
      scope TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS publish_jobs (
      id TEXT PRIMARY KEY,
      carousel_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      status TEXT NOT NULL,
      meta_media_id TEXT,
      meta_container_id TEXT,
      error TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (carousel_id) REFERENCES carousels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      carousel_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (carousel_id) REFERENCES carousels(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS reference_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      hook TEXT,
      pillar TEXT,
      performance TEXT NOT NULL DEFAULT 'average',
      notes TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  const instagramColumns = [
    'ALTER TABLE instagram_connections ADD COLUMN account_type TEXT',
    'ALTER TABLE instagram_connections ADD COLUMN expires_at TEXT',
    'ALTER TABLE instagram_connections ADD COLUMN scope TEXT',
    'ALTER TABLE instagram_connections ADD COLUMN updated_at TEXT'
  ];
  for (const sql of instagramColumns) {
    try { db.exec(sql); } catch { /* column already exists */ }
  }
  try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_instagram_connections_user ON instagram_connections(user_id)'); } catch { /* legacy duplicates can be cleaned manually */ }
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
