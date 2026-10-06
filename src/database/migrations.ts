import type { DatabaseAdapter } from './types';

export const SCHEMA_VERSION = 2;

const migrations = [
  `CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    color TEXT NOT NULL,
    tracking_type TEXT NOT NULL CHECK (tracking_type IN ('count', 'timer')),
    goal REAL NOT NULL CHECK (goal > 0),
    unit TEXT NOT NULL,
    repeat_days TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0 CHECK (archived IN (0, 1)),
    archived_at INTEGER,
    reminder TEXT
  );
  CREATE TABLE IF NOT EXISTS task_revisions (
    task_id TEXT NOT NULL REFERENCES tasks(id),
    effective_date TEXT NOT NULL,
    goal REAL NOT NULL CHECK (goal > 0),
    repeat_days TEXT NOT NULL,
    PRIMARY KEY (task_id, effective_date)
  );
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    date TEXT NOT NULL,
    value REAL NOT NULL CHECK (value != 0),
    timestamp INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('count', 'timer')),
    operation_id TEXT NOT NULL UNIQUE
  );
  CREATE INDEX IF NOT EXISTS records_task_date ON records(task_id, date);
  CREATE INDEX IF NOT EXISTS records_timestamp ON records(timestamp DESC);
  CREATE TABLE IF NOT EXISTS timer_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    task_id TEXT NOT NULL REFERENCES tasks(id),
    start_time INTEGER NOT NULL,
    end_time INTEGER,
    duration REAL NOT NULL DEFAULT 0 CHECK (duration >= 0),
    status TEXT NOT NULL CHECK (status IN ('running', 'paused', 'finished')),
    start_timestamp INTEGER,
    paused_duration REAL NOT NULL DEFAULT 0,
    last_pause_timestamp INTEGER,
    segments TEXT NOT NULL DEFAULT '[]'
  );
  CREATE UNIQUE INDEX IF NOT EXISTS timer_one_active_per_task
    ON timer_sessions(task_id) WHERE status != 'finished';
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    value TEXT NOT NULL
  );`,
  `CREATE TABLE IF NOT EXISTS widget_operations (
    id TEXT PRIMARY KEY NOT NULL,
    timestamp INTEGER NOT NULL
  );`,
];

export async function migrateDatabase(database: DatabaseAdapter): Promise<void> {
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await database.execAsync('PRAGMA busy_timeout = 3000;');
  await database.execAsync('PRAGMA journal_mode = WAL;');
  const row = await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const current = row?.user_version ?? 0;
  if (current > SCHEMA_VERSION)
    throw new Error('This database requires a newer version of Daily+.');
  for (let index = current; index < SCHEMA_VERSION; index += 1) {
    await database.execAsync('BEGIN IMMEDIATE;');
    try {
      const migration = migrations[index];
      if (!migration) throw new Error('A database migration is missing.');
      await database.execAsync(migration);
      await database.execAsync(`PRAGMA user_version = ${index + 1};`);
      await database.execAsync('COMMIT;');
    } catch (error) {
      await database.execAsync('ROLLBACK;');
      throw error;
    }
  }
}
