import { migrateDatabase } from './migrations';
import type { DatabaseAdapter } from './types';

let databasePromise: Promise<DatabaseAdapter> | null = null;
let injectedDatabase: DatabaseAdapter | null = null;
let queue: Promise<void> = Promise.resolve();

export function getDatabase(): Promise<DatabaseAdapter> {
  if (databasePromise) return databasePromise;
  const opening = openDatabase().catch((error: unknown) => {
    databasePromise = null;
    throw error;
  });
  databasePromise = opening;
  return opening;
}

async function openDatabase(): Promise<DatabaseAdapter> {
  const database: DatabaseAdapter = injectedDatabase ?? (await openExpoDatabase());
  await migrateDatabase(database);
  return database;
}

async function openExpoDatabase(): Promise<DatabaseAdapter> {
  const SQLite = await import('expo-sqlite');
  const { default: widget } = await import('../../modules/daily-widget');
  const directory = await widget?.getDatabaseDirectory();
  if (!directory) return SQLite.openDatabaseAsync('dailyplus.db');
  const shared = await SQLite.openDatabaseAsync('dailyplus.db', {}, directory);
  try {
    const version = await shared.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    if (version?.user_version === 0) {
      // SQLite's backup API includes committed WAL pages. Keep the old file as a recovery copy.
      const legacy = await SQLite.openDatabaseAsync('dailyplus.db');
      try {
        await SQLite.backupDatabaseAsync({ sourceDatabase: legacy, destDatabase: shared });
      } finally {
        await legacy.closeAsync();
      }
    }
    return shared;
  } catch (error) {
    await shared.closeAsync();
    throw error;
  }
}

export async function initializeDatabase(): Promise<void> {
  await getDatabase();
}

/** Changes committed through another native connection, including home-screen widgets. */
export function getExternalDataVersion(): Promise<number> {
  return withDatabase(async (database) => {
    const row = await database.getFirstAsync<{ data_version: number }>('PRAGMA data_version');
    return row?.data_version ?? 0;
  });
}

/** Serializes reads as well as writes so no caller observes a partial transaction. */
export function withDatabase<T>(operation: (database: DatabaseAdapter) => Promise<T>): Promise<T> {
  const result = queue.then(async () => operation(await getDatabase()));
  queue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function transaction<T>(
  database: DatabaseAdapter,
  operation: () => Promise<T>,
): Promise<T> {
  await database.execAsync('BEGIN IMMEDIATE;');
  try {
    const result = await operation();
    await database.execAsync('COMMIT;');
    return result;
  } catch (error) {
    await database.execAsync('ROLLBACK;');
    throw error;
  }
}

/** Test seam: callers inject a real SQLite connection, never an in-memory data mock. */
export function setDatabaseForTesting(database: DatabaseAdapter | null): void {
  injectedDatabase = database;
  databasePromise = null;
  queue = Promise.resolve();
}
