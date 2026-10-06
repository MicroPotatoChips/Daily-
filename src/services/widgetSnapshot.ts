import type { HabitRecord, Settings, Task, TaskRevision, TimerSession } from '@/types';
import { getLocalDateKey } from '@/utils/date';

export interface WidgetTask {
  id: string;
  name: string;
  icon: string;
  color: string;
  trackingType: 'count' | 'timer';
  goal: number;
  unit: string;
  repeatDays: number[];
  createdDate: string;
  values: Record<string, number>;
  revisions: { effectiveDate: string; goal: number; repeatDays: number[] }[];
  timer: {
    id: string;
    status: 'running' | 'paused';
    duration: number;
    start_timestamp: number | null;
    last_pause_timestamp: number | null;
  } | null;
}

export function createWidgetSnapshot(
  tasks: Task[],
  records: HabitRecord[],
  revisions: TaskRevision[] = [],
  settings?: Settings,
  now = new Date(),
  language = 'en',
  sessions: TimerSession[] = [],
) {
  const earliest = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
  const cutoff = getLocalDateKey(earliest);
  const values = new Map<string, Record<string, number>>();
  for (const record of records) {
    if (record.date < cutoff) continue;
    const totals = values.get(record.taskId) ?? {};
    totals[record.date] = (totals[record.date] ?? 0) + record.value;
    values.set(record.taskId, totals);
  }
  return {
    version: 1,
    generatedAt: now.getTime(),
    language,
    theme: settings?.theme ?? 'system',
    tasks: tasks
      .filter((task) => !task.archived)
      .map((task): WidgetTask => {
        const timer = sessions.find(
          (session) => session.taskId === task.id && session.status !== 'finished',
        );
        return {
          id: task.id,
          name: task.name,
          icon: task.icon,
          color: task.color,
          trackingType: task.trackingType,
          goal: task.goal,
          unit: task.unit,
          repeatDays: task.repeatDays,
          createdDate: getLocalDateKey(task.createdAt),
          values: values.get(task.id) ?? {},
          revisions: revisions
            .filter((revision) => revision.taskId === task.id)
            .map(({ effectiveDate, goal, repeatDays }) => ({ effectiveDate, goal, repeatDays })),
          timer:
            timer && timer.status !== 'finished'
              ? {
                  id: timer.id,
                  status: timer.status,
                  duration: timer.duration,
                  start_timestamp: timer.startTimestamp,
                  last_pause_timestamp: timer.lastPauseTimestamp,
                }
              : null,
        };
      }),
  };
}
