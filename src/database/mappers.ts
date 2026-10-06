import type {
  HabitRecord,
  Reminder,
  Task,
  TaskRevision,
  TimerSegment,
  TimerSession,
} from '../types';

export interface TaskRow {
  id: string;
  name: string;
  icon: Task['icon'];
  color: string;
  tracking_type: Task['trackingType'];
  goal: number;
  unit: string;
  repeat_days: string;
  created_at: number;
  archived: number;
  archived_at: number | null;
  reminder: string | null;
}
export interface RecordRow {
  id: string;
  task_id: string;
  date: string;
  value: number;
  timestamp: number;
  type: HabitRecord['type'];
  operation_id: string;
}
export interface RevisionRow {
  task_id: string;
  effective_date: string;
  goal: number;
  repeat_days: string;
}
export interface TimerRow {
  id: string;
  task_id: string;
  start_time: number;
  end_time: number | null;
  duration: number;
  status: TimerSession['status'];
  start_timestamp: number | null;
  paused_duration: number;
  last_pause_timestamp: number | null;
  segments: string;
}

export function taskFromRow(row: TaskRow): Task {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    trackingType: row.tracking_type,
    goal: row.goal,
    unit: row.unit,
    repeatDays: JSON.parse(row.repeat_days) as number[],
    createdAt: row.created_at,
    archived: row.archived === 1,
    archivedAt: row.archived_at,
    reminder: row.reminder ? (JSON.parse(row.reminder) as Reminder) : null,
  };
}

export function recordFromRow(row: RecordRow): HabitRecord {
  return {
    id: row.id,
    taskId: row.task_id,
    date: row.date,
    value: row.value,
    timestamp: row.timestamp,
    type: row.type,
    operationId: row.operation_id,
  };
}

export function revisionFromRow(row: RevisionRow): TaskRevision {
  return {
    taskId: row.task_id,
    effectiveDate: row.effective_date,
    goal: row.goal,
    repeatDays: JSON.parse(row.repeat_days) as number[],
  };
}

export function timerFromRow(row: TimerRow): TimerSession {
  return {
    id: row.id,
    taskId: row.task_id,
    startTime: row.start_time,
    endTime: row.end_time,
    duration: row.duration,
    status: row.status,
    startTimestamp: row.start_timestamp,
    pausedDuration: row.paused_duration,
    lastPauseTimestamp: row.last_pause_timestamp,
    segments: JSON.parse(row.segments) as TimerSegment[],
  };
}
