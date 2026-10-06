import type { Settings } from '../types';
import { withDatabase } from './db';

export function loadSettings(): Promise<Settings | null> {
  return withDatabase(async (database) => {
    const row = await database.getFirstAsync<{ value: string }>(
      'SELECT value FROM settings WHERE id = 1',
    );
    if (!row) return null;
    const settings: unknown = JSON.parse(row.value);
    if (!isSettings(settings)) throw new Error('Saved settings could not be loaded.');
    return settings;
  });
}

function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false;
  const settings = value as Record<string, unknown>;
  return (
    ['system', 'en', 'zh-CN'].includes(String(settings.language)) &&
    ['system', 'light', 'dark'].includes(String(settings.theme)) &&
    typeof settings.haptics === 'boolean' &&
    typeof settings.notifications === 'boolean' &&
    (settings.weekStartsOn === 0 || settings.weekStartsOn === 1) &&
    typeof settings.onboarded === 'boolean'
  );
}

export function saveSettings(settings: Settings): Promise<void> {
  if (!isSettings(settings)) throw new Error('Invalid settings.');
  return withDatabase(async (database) => {
    await database.runAsync(
      'INSERT INTO settings (id, value) VALUES (1, ?) ON CONFLICT (id) DO UPDATE SET value = excluded.value',
      JSON.stringify(settings),
    );
  });
}

export const settingsRepository = { loadSettings, saveSettings };
