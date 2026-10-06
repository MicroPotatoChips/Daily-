import type { TimerSession } from '../types';
import { generateId } from '../utils/id';
import { splitTimerSegments } from '../utils/timer';
import { assertTimestamp } from '../utils/validation';
import { transaction, withDatabase } from './db';
import { timerFromRow, type TaskRow, type TimerRow } from './mappers';
import { insertRecordOnDatabase } from './recordRepository';
import type { DatabaseAdapter } from './types';

async function activeSession(
  database: DatabaseAdapter,
  taskId: string,
): Promise<TimerSession | null> {
  const row = await database.getFirstAsync<TimerRow>(
    "SELECT * FROM timer_sessions WHERE task_id = ? AND status != 'finished'",
    taskId,
  );
  return row ? timerFromRow(row) : null;
}

async function saveSession(database: DatabaseAdapter, session: TimerSession): Promise<void> {
  await database.runAsync(
    `UPDATE timer_sessions SET end_time = ?, duration = ?, status = ?, start_timestamp = ?,
      paused_duration = ?, last_pause_timestamp = ?, segments = ? WHERE id = ?`,
    session.endTime,
    session.duration,
    session.status,
    session.startTimestamp,
    session.pausedDuration,
    session.lastPauseTimestamp,
    JSON.stringify(session.segments),
    session.id,
  );
}

function closeRunningSegment(session: TimerSession, now: number): void {
  if (session.status !== 'running' || session.startTimestamp === null) return;
  const end = Math.max(session.startTimestamp, now);
  if (end > session.startTimestamp) {
    session.segments.push({ start: session.startTimestamp, end });
    session.duration += end - session.startTimestamp;
  }
  session.startTimestamp = null;
}

/** Called inside the same transaction when archiving a task or finishing normally. */
export async function finishTimerOnDatabase(
  database: DatabaseAdapter,
  taskId: string,
  now: number,
): Promise<TimerSession | null> {
  assertTimestamp(now);
  const session = await activeSession(database, taskId);
  if (!session) return null;
  closeRunningSegment(session, now);
  if (session.lastPauseTimestamp !== null)
    session.pausedDuration += Math.max(0, now - session.lastPauseTimestamp);
  session.lastPauseTimestamp = null;
  session.status = 'finished';
  session.endTime = Math.max(session.startTime, session.segments.at(-1)?.end ?? 0, now);
  await saveSession(database, session);
  for (const day of splitTimerSegments(session.segments)) {
    await insertRecordOnDatabase(database, {
      id: `timer_record_${session.id}_${day.date}`,
      taskId,
      date: day.date,
      value: day.milliseconds / 60_000,
      timestamp: day.timestamp,
      type: 'timer',
      operationId: `timer:${session.id}:${day.date}`,
    });
  }
  return session;
}

export function getTimerSessions(): Promise<TimerSession[]> {
  return withDatabase(async (database) =>
    (
      await database.getAllAsync<TimerRow>(
        'SELECT * FROM timer_sessions ORDER BY start_time DESC, id DESC',
      )
    ).map(timerFromRow),
  );
}

export function startTimer(taskId: string, now = Date.now()): Promise<TimerSession> {
  assertTimestamp(now);
  return withDatabase((database) =>
    transaction(database, async () => {
      const task = await database.getFirstAsync<TaskRow>(
        'SELECT * FROM tasks WHERE id = ?',
        taskId,
      );
      if (!task || task.archived || task.tracking_type !== 'timer')
        throw new Error('This task cannot start a timer.');
      const existing = await activeSession(database, taskId);
      if (existing) return existing;
      const session: TimerSession = {
        id: generateId('timer'),
        taskId,
        startTime: now,
        endTime: null,
        duration: 0,
        status: 'running',
        startTimestamp: now,
        pausedDuration: 0,
        lastPauseTimestamp: null,
        segments: [],
      };
      await database.runAsync(
        `INSERT INTO timer_sessions (id, task_id, start_time, end_time, duration, status,
        start_timestamp, paused_duration, last_pause_timestamp, segments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        session.id,
        taskId,
        now,
        null,
        0,
        'running',
        now,
        0,
        null,
        '[]',
      );
      return session;
    }),
  );
}

export function pauseTimer(taskId: string, now = Date.now()): Promise<void> {
  assertTimestamp(now);
  return withDatabase((database) =>
    transaction(database, async () => {
      const session = await activeSession(database, taskId);
      if (!session || session.status === 'paused') return;
      closeRunningSegment(session, now);
      session.status = 'paused';
      session.lastPauseTimestamp = now;
      await saveSession(database, session);
    }),
  );
}

export function resumeTimer(taskId: string, now = Date.now()): Promise<void> {
  assertTimestamp(now);
  return withDatabase((database) =>
    transaction(database, async () => {
      const session = await activeSession(database, taskId);
      if (!session || session.status === 'running') return;
      if (session.lastPauseTimestamp !== null)
        session.pausedDuration += Math.max(0, now - session.lastPauseTimestamp);
      session.status = 'running';
      session.lastPauseTimestamp = null;
      // A backward wall-clock change must never create overlapping saved segments.
      session.startTimestamp = Math.max(now, session.segments.at(-1)?.end ?? session.startTime);
      await saveSession(database, session);
    }),
  );
}

export function finishTimer(taskId: string, now = Date.now()): Promise<TimerSession | null> {
  return withDatabase((database) =>
    transaction(database, () => finishTimerOnDatabase(database, taskId, now)),
  );
}

export const timerRepository = {
  getTimerSessions,
  startTimer,
  pauseTimer,
  resumeTimer,
  finishTimer,
};
