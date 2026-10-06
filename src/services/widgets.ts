import { Platform } from 'react-native';
import nativeWidget from '../../modules/daily-widget';
import { i18n } from '@/locales';
import type { HabitRecord, Settings, Task, TaskRevision, TimerSession } from '@/types';
import { createWidgetSnapshot } from './widgetSnapshot';

export const widgetsAvailable = Platform.OS !== 'web' && nativeWidget !== null;

export async function syncWidgets(
  tasks: Task[],
  records: HabitRecord[],
  revisions: TaskRevision[] = [],
  settings?: Settings,
  sessions: TimerSession[] = [],
): Promise<void> {
  if (!nativeWidget || Platform.OS === 'web') return;
  const SQLite = await import('expo-sqlite');
  await nativeWidget.setSnapshot(
    JSON.stringify(
      createWidgetSnapshot(
        tasks,
        records,
        revisions,
        settings,
        new Date(),
        i18n.language,
        sessions,
      ),
    ),
    (await nativeWidget.getDatabaseDirectory()) ?? String(SQLite.defaultDatabaseDirectory),
  );
}
