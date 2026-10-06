import type { Task, TaskInput, TaskRevision } from '../types';
import { getLocalDateKey } from '../utils/date';
import { generateId } from '../utils/id';
import { assertTimestamp, MAX_HABIT_VALUE, MIN_HABIT_VALUE } from '../utils/validation';
import { transaction, withDatabase } from './db';
import { revisionFromRow, taskFromRow, type RevisionRow, type TaskRow } from './mappers';
import { finishTimerOnDatabase } from './timerRepository';
import type { DatabaseAdapter } from './types';

const icons: Task['icon'][] = [
  'droplets',
  'activity',
  'book-open',
  'flower',
  'stretch',
  'moon',
  'apple',
  'heart',
  'sun',
  'coffee',
  'graduation-cap',
  'leaf',
];

function validatedInput(input: TaskInput): TaskInput {
  const name = input.name.trim();
  const unit = input.unit.trim();
  const repeatDays = [...new Set(input.repeatDays)].sort((a, b) => a - b);
  if (
    !name ||
    name.length > 80 ||
    !unit ||
    unit.length > 24 ||
    !Number.isFinite(input.goal) ||
    input.goal < MIN_HABIT_VALUE ||
    input.goal > MAX_HABIT_VALUE ||
    !icons.includes(input.icon) ||
    !/^#[0-9a-f]{6}$/i.test(input.color) ||
    !['timer', 'count'].includes(input.trackingType) ||
    (input.trackingType === 'timer' && unit !== 'min') ||
    !repeatDays.length ||
    repeatDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    throw new Error('Please check the task name, goal, and repeat days.');
  }
  const reminder = input.reminder;
  if (
    reminder &&
    (typeof reminder.enabled !== 'boolean' ||
      !['daily', 'interval'].includes(reminder.mode) ||
      !Number.isInteger(reminder.hour) ||
      reminder.hour < 0 ||
      reminder.hour > 23 ||
      !Number.isInteger(reminder.minute) ||
      reminder.minute < 0 ||
      reminder.minute > 59 ||
      !Number.isInteger(reminder.intervalHours) ||
      reminder.intervalHours < 1 ||
      reminder.intervalHours > 24)
  ) {
    throw new Error('Please check the reminder time.');
  }
  return { ...input, name, unit, repeatDays };
}

async function saveRevision(
  database: DatabaseAdapter,
  taskId: string,
  goal: number,
  days: number[],
  now: number,
): Promise<void> {
  await database.runAsync(
    `INSERT INTO task_revisions (task_id, effective_date, goal, repeat_days) VALUES (?, ?, ?, ?)
     ON CONFLICT (task_id, effective_date) DO UPDATE SET goal = excluded.goal, repeat_days = excluded.repeat_days`,
    taskId,
    getLocalDateKey(now),
    goal,
    JSON.stringify(days),
  );
}

export function getTasks(): Promise<Task[]> {
  return withDatabase(async (database) =>
    (
      await database.getAllAsync<TaskRow>('SELECT * FROM tasks ORDER BY created_at ASC, id ASC')
    ).map(taskFromRow),
  );
}

export function getTask(id: string): Promise<Task | null> {
  return withDatabase(async (database) => {
    const task = await database.getFirstAsync<TaskRow>('SELECT * FROM tasks WHERE id = ?', id);
    return task ? taskFromRow(task) : null;
  });
}

export function getTaskRevisions(): Promise<TaskRevision[]> {
  return withDatabase(async (database) =>
    (
      await database.getAllAsync<RevisionRow>(
        'SELECT * FROM task_revisions ORDER BY effective_date ASC, task_id ASC',
      )
    ).map(revisionFromRow),
  );
}

export function createTask(input: TaskInput, now = Date.now()): Promise<Task> {
  assertTimestamp(now);
  const valid = validatedInput(input);
  return withDatabase((database) =>
    transaction(database, async () => {
      const task: Task = {
        ...valid,
        id: generateId('task'),
        createdAt: now,
        archived: false,
        archivedAt: null,
      };
      await database.runAsync(
        `INSERT INTO tasks (id, name, icon, color, tracking_type, goal, unit, repeat_days, created_at, archived, archived_at, reminder)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        task.id,
        task.name,
        task.icon,
        task.color,
        task.trackingType,
        task.goal,
        task.unit,
        JSON.stringify(task.repeatDays),
        now,
        0,
        null,
        task.reminder ? JSON.stringify(task.reminder) : null,
      );
      await saveRevision(database, task.id, task.goal, task.repeatDays, now);
      return task;
    }),
  );
}

export function updateTask(id: string, input: TaskInput, now = Date.now()): Promise<void> {
  assertTimestamp(now);
  const valid = validatedInput(input);
  return withDatabase((database) =>
    transaction(database, async () => {
      const task = await database.getFirstAsync<TaskRow>('SELECT * FROM tasks WHERE id = ?', id);
      if (!task || task.archived) throw new Error('This task is no longer active.');
      if (task.tracking_type !== valid.trackingType || task.unit !== valid.unit) {
        const activity = await database.getFirstAsync<{ total: number }>(
          'SELECT (SELECT COUNT(*) FROM records WHERE task_id = ?) + (SELECT COUNT(*) FROM timer_sessions WHERE task_id = ?) AS total',
          id,
          id,
        );
        if (activity?.total)
          throw new Error(
            'Create a new task to change the tracking type or unit after recording activity.',
          );
      }
      await database.runAsync(
        `UPDATE tasks SET name = ?, icon = ?, color = ?, tracking_type = ?, goal = ?, unit = ?, repeat_days = ?, reminder = ? WHERE id = ?`,
        valid.name,
        valid.icon,
        valid.color,
        valid.trackingType,
        valid.goal,
        valid.unit,
        JSON.stringify(valid.repeatDays),
        valid.reminder ? JSON.stringify(valid.reminder) : null,
        id,
      );
      await saveRevision(database, id, valid.goal, valid.repeatDays, now);
    }),
  );
}

export function archiveTask(id: string, now = Date.now()): Promise<void> {
  assertTimestamp(now);
  return withDatabase((database) =>
    transaction(database, async () => {
      const task = await database.getFirstAsync<TaskRow>('SELECT * FROM tasks WHERE id = ?', id);
      if (!task || task.archived) return;
      await finishTimerOnDatabase(database, id, now);
      await database.runAsync(
        'UPDATE tasks SET archived = 1, archived_at = ? WHERE id = ?',
        now,
        id,
      );
      await saveRevision(database, id, task.goal, [], now);
    }),
  );
}

export function restoreTask(id: string, now = Date.now()): Promise<void> {
  assertTimestamp(now);
  return withDatabase((database) =>
    transaction(database, async () => {
      const task = await database.getFirstAsync<TaskRow>('SELECT * FROM tasks WHERE id = ?', id);
      if (!task || !task.archived) return;
      await database.runAsync('UPDATE tasks SET archived = 0, archived_at = NULL WHERE id = ?', id);
      await saveRevision(database, id, task.goal, JSON.parse(task.repeat_days) as number[], now);
    }),
  );
}

export const taskRepository = {
  getTasks,
  getTask,
  getTaskRevisions,
  createTask,
  updateTask,
  archiveTask,
  restoreTask,
};
