import type { DailySummary, HabitRecord, Task, TaskRevision } from '../types';
import { asDateKey, dateFromKey, getLocalDateKey, type DateInput } from './date';
import { VALUE_EPSILON } from './validation';

export type RecordTotals = ReadonlyMap<string, ReadonlyMap<string, number>>;

/** One pass per records update; screens can reuse this for every day and task. */
export function indexRecordTotals(records: readonly HabitRecord[]): RecordTotals {
  const totals = new Map<string, Map<string, number>>();
  for (const record of records) {
    let day = totals.get(record.date);
    if (!day) {
      day = new Map();
      totals.set(record.date, day);
    }
    day.set(record.taskId, (day.get(record.taskId) ?? 0) + record.value);
  }
  return totals;
}

function cleanTotal(value: number): number {
  return Math.abs(value) < VALUE_EPSILON ? 0 : value;
}

export function indexedValue(totals: RecordTotals, taskId: string, date: string): number {
  return cleanTotal(totals.get(date)?.get(taskId) ?? 0);
}

function revisionFor(
  task: Task,
  date: string,
  revisions: readonly TaskRevision[],
): TaskRevision | undefined {
  let chosen: TaskRevision | undefined;
  for (const revision of revisions) {
    if (
      revision.taskId === task.id &&
      revision.effectiveDate <= date &&
      (!chosen || revision.effectiveDate > chosen.effectiveDate)
    )
      chosen = revision;
  }
  return chosen;
}

export function isTaskScheduled(
  task: Task,
  date: DateInput,
  revisions: readonly TaskRevision[] = [],
): boolean {
  const key = asDateKey(date);
  if (key < getLocalDateKey(task.createdAt)) return false;
  if (task.archived && (!task.archivedAt || key >= getLocalDateKey(task.archivedAt))) return false;
  const days = revisionFor(task, key, revisions)?.repeatDays ?? task.repeatDays;
  return days.includes(dateFromKey(key).getDay());
}

export function getTaskGoal(
  task: Task,
  date: DateInput,
  revisions: readonly TaskRevision[] = [],
): number {
  return revisionFor(task, asDateKey(date), revisions)?.goal ?? task.goal;
}

export function valueForTask(
  records: readonly HabitRecord[],
  taskId: string,
  date: DateInput,
): number {
  const key = asDateKey(date);
  return cleanTotal(
    records.reduce(
      (total, record) =>
        record.taskId === taskId && record.date === key ? total + record.value : total,
      0,
    ),
  );
}

export function getDailySummary(
  tasks: readonly Task[],
  records: readonly HabitRecord[],
  date: DateInput,
  revisions: readonly TaskRevision[] = [],
  totals: RecordTotals = indexRecordTotals(records),
): DailySummary {
  const key = asDateKey(date);
  // Recorded activity remains visible when a task was archived or rescheduled that day.
  const scheduled = tasks.filter(
    (task) => isTaskScheduled(task, key, revisions) || indexedValue(totals, task.id, key) > 0,
  );
  const completedTasks = scheduled.filter(
    (task) =>
      indexedValue(totals, task.id, key) + VALUE_EPSILON >= getTaskGoal(task, key, revisions),
  ).length;
  return {
    date: key,
    completedTasks,
    totalTasks: scheduled.length,
    completionRate: scheduled.length ? completedTasks / scheduled.length : 0,
  };
}

export function heatmapIntensity(rate: number): 0 | 1 | 2 | 3 | 4 {
  if (!Number.isFinite(rate) || rate <= 0) return 0;
  if (rate <= 0.25) return 1;
  if (rate <= 0.5) return 2;
  if (rate <= 0.75) return 3;
  return 4;
}
