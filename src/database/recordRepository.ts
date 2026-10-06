import type { HabitRecord, TrackingType } from '../types';
import { getLocalDateKey } from '../utils/date';
import { generateId } from '../utils/id';
import {
  assertTimestamp,
  MAX_HABIT_VALUE,
  MIN_HABIT_VALUE,
  VALUE_EPSILON,
} from '../utils/validation';
import { transaction, withDatabase } from './db';
import { recordFromRow, type RecordRow, type TaskRow } from './mappers';
import type { DatabaseAdapter } from './types';

export async function insertRecordOnDatabase(
  database: DatabaseAdapter,
  record: HabitRecord,
): Promise<HabitRecord> {
  const previous = await database.getFirstAsync<RecordRow>(
    'SELECT * FROM records WHERE operation_id = ?',
    record.operationId,
  );
  if (previous) {
    if (
      previous.task_id !== record.taskId ||
      previous.value !== record.value ||
      previous.type !== record.type
    ) {
      throw new Error('This operation has already been used for another record.');
    }
    return recordFromRow(previous);
  }
  await database.runAsync(
    'INSERT INTO records (id, task_id, date, value, timestamp, type, operation_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    record.id,
    record.taskId,
    record.date,
    record.value,
    record.timestamp,
    record.type,
    record.operationId,
  );
  return record;
}

export async function addRecord(
  taskId: string,
  value: number,
  type: TrackingType,
  operationId = generateId('operation'),
  timestamp = Date.now(),
): Promise<HabitRecord> {
  assertTimestamp(timestamp);
  if (
    !Number.isFinite(value) ||
    Math.abs(value) < MIN_HABIT_VALUE ||
    Math.abs(value) > MAX_HABIT_VALUE ||
    typeof operationId !== 'string' ||
    !operationId.trim() ||
    operationId.length > 240
  ) {
    throw new Error('The record must have a nonzero value and a valid timestamp.');
  }
  return withDatabase((database) =>
    transaction(database, async () => {
      // A retry remains idempotent even after the task has been archived.
      const existing = await database.getFirstAsync<RecordRow>(
        'SELECT * FROM records WHERE operation_id = ?',
        operationId,
      );
      if (existing)
        return insertRecordOnDatabase(database, {
          id: existing.id,
          taskId,
          date: existing.date,
          value,
          timestamp,
          type,
          operationId,
        });
      const task = await database.getFirstAsync<TaskRow>(
        'SELECT * FROM tasks WHERE id = ?',
        taskId,
      );
      if (!task || task.archived) throw new Error('This task is no longer active.');
      if (task.tracking_type !== type)
        throw new Error('The record does not match the task tracking type.');
      const date = getLocalDateKey(timestamp);
      if (value < 0) {
        const total = await database.getFirstAsync<{ value: number }>(
          'SELECT COALESCE(SUM(value), 0) AS value FROM records WHERE task_id = ? AND date = ?',
          taskId,
          date,
        );
        if ((total?.value ?? 0) + value < -VALUE_EPSILON)
          throw new Error('A correction cannot make the daily total negative.');
      }
      return insertRecordOnDatabase(database, {
        id: generateId('record'),
        taskId,
        date,
        value,
        timestamp,
        type,
        operationId,
      });
    }),
  );
}

export function getRecords(): Promise<HabitRecord[]> {
  return withDatabase(async (database) =>
    (
      await database.getAllAsync<RecordRow>(
        'SELECT * FROM records ORDER BY timestamp DESC, id DESC',
      )
    ).map(recordFromRow),
  );
}

export function getRecordsForTask(taskId: string): Promise<HabitRecord[]> {
  return withDatabase(async (database) =>
    (
      await database.getAllAsync<RecordRow>(
        'SELECT * FROM records WHERE task_id = ? ORDER BY timestamp DESC, id DESC',
        taskId,
      )
    ).map(recordFromRow),
  );
}

export const recordRepository = { addRecord, getRecords, getRecordsForTask };
