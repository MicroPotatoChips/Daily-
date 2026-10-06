import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, beforeEach, test } from 'node:test';
import { getDatabase, initializeDatabase, setDatabaseForTesting } from '../src/database/db';
import { SCHEMA_VERSION } from '../src/database/migrations';
import { addRecord, getRecords, getRecordsForTask } from '../src/database/recordRepository';
import { loadSettings, saveSettings } from '../src/database/settingsRepository';
import {
  archiveTask,
  createTask,
  getTask,
  getTaskRevisions,
  getTasks,
  restoreTask,
  updateTask,
} from '../src/database/taskRepository';
import {
  finishTimer,
  getTimerSessions,
  pauseTimer,
  resumeTimer,
  startTimer,
} from '../src/database/timerRepository';
import type { DatabaseAdapter, SqlValue } from '../src/database/types';
import type { Settings, TaskInput } from '../src/types';
import { dateFromKey, getLocalDateKey, recentDateKeys } from '../src/utils/date';
import {
  getDailySummary,
  getTaskGoal,
  heatmapIntensity,
  isTaskScheduled,
  indexRecordTotals,
  indexedValue,
  valueForTask,
} from '../src/utils/history';
import { elapsedMilliseconds, splitTimerSegments } from '../src/utils/timer';

// The production app uses the device zone; make this process's calendar assertions deterministic.
process.env.TZ = 'Asia/Shanghai';

class RealSqliteAdapter implements DatabaseAdapter {
  readonly connection: DatabaseSync;
  failNextRecord = false;
  constructor(path = ':memory:') {
    this.connection = new DatabaseSync(path);
  }
  async execAsync(sql: string): Promise<void> {
    this.connection.exec(sql);
  }
  async runAsync(
    sql: string,
    ...params: SqlValue[]
  ): Promise<{ changes: number; lastInsertRowId: number }> {
    if (this.failNextRecord && sql.startsWith('INSERT INTO records')) {
      this.failNextRecord = false;
      throw new Error('Injected disk write failure');
    }
    const result = this.connection.prepare(sql).run(...params);
    return { changes: Number(result.changes), lastInsertRowId: Number(result.lastInsertRowid) };
  }
  async getFirstAsync<T>(sql: string, ...params: SqlValue[]): Promise<T | null> {
    const row = this.connection.prepare(sql).get(...params);
    return row ? (row as unknown as T) : null;
  }
  async getAllAsync<T>(sql: string, ...params: SqlValue[]): Promise<T[]> {
    return this.connection.prepare(sql).all(...params) as unknown as T[];
  }
  close(): void {
    this.connection.close();
  }
}

let database: RealSqliteAdapter;
beforeEach(() => {
  database = new RealSqliteAdapter();
  setDatabaseForTesting(database);
});
afterEach(() => {
  database.close();
  setDatabaseForTesting(null);
});

const countInput: TaskInput = {
  name: 'Water',
  icon: 'droplets',
  color: '#4C9BB0',
  trackingType: 'count',
  goal: 8,
  unit: 'cups',
  repeatDays: [0, 1, 2, 3, 4, 5, 6],
  reminder: null,
};
const timerInput: TaskInput = {
  ...countInput,
  name: 'Exercise',
  icon: 'activity',
  trackingType: 'timer',
  goal: 30,
  unit: 'min',
};
const at = (key: string, hour = 12, minute = 0): number => {
  const date = dateFromKey(key);
  date.setHours(hour, minute, 0, 0);
  return date.getTime();
};

test('schema migrations are durable, versioned, idempotent, and contain no demo data', async () => {
  await initializeDatabase();
  assert.equal((await getDatabase()).getFirstAsync instanceof Function, true);
  assert.deepEqual(await getTasks(), []);
  assert.deepEqual(await getRecords(), []);
  assert.equal(
    (await database.getFirstAsync<{ user_version: number }>('PRAGMA user_version'))?.user_version,
    SCHEMA_VERSION,
  );
  setDatabaseForTesting(database);
  await initializeDatabase();
  assert.deepEqual(await getTasks(), []);
});

test('a newer schema fails safely and initialization can be retried', async () => {
  await database.execAsync('PRAGMA user_version = 99');
  await assert.rejects(initializeDatabase(), /newer version/);
  await database.execAsync('PRAGMA user_version = 0');
  await initializeDatabase();
  assert.deepEqual(await getTasks(), []);
});

test('local date keys do not accidentally use the UTC calendar day', () => {
  const timestamp = Date.parse('2026-09-30T16:30:00Z');
  assert.equal(getLocalDateKey(timestamp), '2026-10-01');
  assert.equal(dateFromKey('2024-02-29').getDate(), 29);
  assert.throws(() => dateFromKey('2026-02-30'), /Invalid/);
  assert.throws(() => dateFromKey('10/01/2026'), /Invalid/);
  assert.deepEqual(recentDateKeys(3, '2026-03-01'), ['2026-02-27', '2026-02-28', '2026-03-01']);
  assert.deepEqual(recentDateKeys(0, '2026-10-01'), []);
});

test('task creation saves reminder and a dated baseline revision', async () => {
  const reminder = {
    enabled: true,
    mode: 'daily' as const,
    hour: 18,
    minute: 30,
    intervalHours: 2,
  };
  const task = await createTask(
    { ...countInput, name: ' Water ', repeatDays: [2, 1, 2], reminder },
    at('2026-10-01'),
  );
  assert.equal(task.name, 'Water');
  assert.deepEqual(task.repeatDays, [1, 2]);
  assert.deepEqual((await getTask(task.id))?.reminder, reminder);
  assert.deepEqual(await getTaskRevisions(), [
    { taskId: task.id, effectiveDate: '2026-10-01', goal: 8, repeatDays: [1, 2] },
  ]);
  assert.equal(await getTask('missing'), null);
});

test('invalid tasks and inconsistent timer units are rejected', () => {
  assert.throws(() => createTask({ ...countInput, goal: 0 }), /check/);
  assert.throws(() => createTask({ ...countInput, repeatDays: [] }), /check/);
  assert.throws(() => createTask({ ...countInput, repeatDays: [7] }), /check/);
  assert.throws(() => createTask({ ...timerInput, unit: 'hours' }), /check/);
});

test('record operation IDs are idempotent under concurrent retries', async () => {
  const task = await createTask(countInput, at('2026-10-01'));
  const results = await Promise.all(
    Array.from({ length: 8 }, () =>
      addRecord(task.id, 1, 'count', 'same-click', at('2026-10-01', 13)),
    ),
  );
  assert.equal(new Set(results.map((record) => record.id)).size, 1);
  assert.equal((await getRecords()).length, 1);
  assert.equal(valueForTask(await getRecords(), task.id, '2026-10-01'), 1);
  await assert.rejects(addRecord(task.id, 2, 'count', 'same-click'), /already been used/);
});

test('manual corrections persist while preventing a negative daily total', async () => {
  const task = await createTask(countInput, at('2026-10-01'));
  await addRecord(task.id, 3, 'count', 'add-three', at('2026-10-01', 13));
  await addRecord(task.id, -2, 'count', 'correct-two', at('2026-10-01', 14));
  await addRecord(task.id, -2, 'count', 'correct-two', at('2026-10-01', 14));
  assert.equal(valueForTask(await getRecords(), task.id, '2026-10-01'), 1);
  await assert.rejects(
    addRecord(task.id, -2, 'count', 'too-much', at('2026-10-01', 15)),
    /negative/,
  );
  await assert.rejects(addRecord(task.id, -1, 'count', 'wrong-day', at('2026-10-02')), /negative/);
  await assert.rejects(addRecord(task.id, 0, 'count', 'zero', at('2026-10-01')), /nonzero/);
  const corrections = await Promise.allSettled([
    addRecord(task.id, -1, 'count', 'last-one-a', at('2026-10-01', 16)),
    addRecord(task.id, -1, 'count', 'last-one-b', at('2026-10-01', 16)),
  ]);
  assert.equal(corrections.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(valueForTask(await getRecords(), task.id, '2026-10-01'), 0);
});

test('goals and repeat days use the revision effective on the selected date', async () => {
  const original = await createTask(countInput, at('2026-09-28'));
  await addRecord(original.id, 8, 'count', 'yesterday', at('2026-09-30'));
  await updateTask(original.id, { ...countInput, goal: 12, repeatDays: [4] }, at('2026-10-01'));
  const task = await getTask(original.id);
  assert.ok(task);
  const revisions = await getTaskRevisions();
  assert.equal(getTaskGoal(task, '2026-09-30', revisions), 8);
  assert.equal(getTaskGoal(task, '2026-10-01', revisions), 12);
  assert.equal(isTaskScheduled(task, '2026-09-30', revisions), true);
  assert.equal(isTaskScheduled(task, '2026-10-02', revisions), false);
  assert.equal(isTaskScheduled(task, '2026-09-27', revisions), false);
  assert.equal(
    getDailySummary([task], await getRecords(), '2026-09-30', revisions).completionRate,
    1,
  );
});

test('same-day edits replace the dated revision without duplicating it', async () => {
  const task = await createTask(countInput, at('2026-10-01', 8));
  await updateTask(task.id, { ...countInput, goal: 10 }, at('2026-10-01', 9));
  await updateTask(task.id, { ...countInput, goal: 12 }, at('2026-10-01', 10));
  assert.equal((await getTaskRevisions()).length, 1);
  assert.equal((await getTaskRevisions())[0]?.goal, 12);
});

test('tracking type and unit changes cannot corrupt existing activity', async () => {
  const task = await createTask(countInput, at('2026-10-01'));
  await addRecord(task.id, 1, 'count', 'record', at('2026-10-01'));
  await assert.rejects(updateTask(task.id, timerInput), /tracking type or unit/);
  await assert.rejects(updateTask(task.id, { ...countInput, unit: 'ml' }), /tracking type or unit/);
  assert.equal((await getTask(task.id))?.unit, 'cups');
});

test('archiving keeps records and historical schedules, and restore preserves the archived gap', async () => {
  const original = await createTask(countInput, at('2026-09-28'));
  await addRecord(original.id, 8, 'count', 'past', at('2026-09-30'));
  await addRecord(original.id, 8, 'count', 'archive-day', at('2026-10-01', 8));
  await archiveTask(original.id, at('2026-10-01', 10));
  const archived = await getTask(original.id);
  assert.ok(archived?.archived);
  assert.equal((await getRecordsForTask(original.id)).length, 2);
  assert.equal(isTaskScheduled(archived, '2026-09-30', await getTaskRevisions()), true);
  assert.equal(isTaskScheduled(archived, '2026-10-02', await getTaskRevisions()), false);
  assert.equal(
    getDailySummary([archived], await getRecords(), '2026-10-01', await getTaskRevisions())
      .completedTasks,
    1,
  );
  await assert.rejects(addRecord(original.id, 1, 'count', 'archived'), /no longer active/);
  await addRecord(original.id, 8, 'count', 'past', at('2026-09-30')); // Safe replay after archive.
  await restoreTask(original.id, at('2026-10-03'));
  const restored = await getTask(original.id);
  assert.ok(restored);
  assert.equal(isTaskScheduled(restored, '2026-10-02', await getTaskRevisions()), false);
  assert.equal(isTaskScheduled(restored, '2026-10-03', await getTaskRevisions()), true);
});

test('completion rates and all heatmap buckets come from durable records', async () => {
  const first = await createTask({ ...countInput, goal: 2 }, at('2026-10-01'));
  await createTask({ ...countInput, name: 'Fruit', goal: 1 }, at('2026-10-01'));
  await addRecord(first.id, 2, 'count', 'complete', at('2026-10-01'));
  assert.deepEqual(
    getDailySummary(await getTasks(), await getRecords(), '2026-10-01', await getTaskRevisions()),
    {
      date: '2026-10-01',
      completedTasks: 1,
      totalTasks: 2,
      completionRate: 0.5,
    },
  );
  assert.equal(getDailySummary([], [], '2026-10-01').completionRate, 0);
  assert.deepEqual([0, 0.25, 0.5, 0.75, 1].map(heatmapIntensity), [0, 1, 2, 3, 4]);
  assert.equal(heatmapIntensity(NaN), 0);
  assert.equal(heatmapIntensity(2), 4);
});

test('running timers recover elapsed time after five minutes away without UI intervals', async () => {
  const task = await createTask(timerInput, at('2026-10-01'));
  const start = at('2026-10-01', 13);
  await Promise.all([startTimer(task.id, start), startTimer(task.id, start)]);
  setDatabaseForTesting(database); // Simulate a fresh service/store initialization.
  const sessions = await getTimerSessions();
  assert.equal(sessions.length, 1);
  const session = sessions[0];
  assert.ok(session);
  assert.equal(elapsedMilliseconds(session, start + 300_000), 300_000);
  await finishTimer(task.id, start + 300_000);
  assert.equal((await getRecords())[0]?.value, 5);
});

test('pause and resume exclude background pause time and survive repository recreation', async () => {
  const task = await createTask(timerInput, at('2026-10-01'));
  const start = at('2026-10-01', 13);
  await startTimer(task.id, start);
  await pauseTimer(task.id, start + 120_000);
  await pauseTimer(task.id, start + 130_000); // Repeated pause cannot add another segment.
  setDatabaseForTesting(database);
  let session = (await getTimerSessions())[0];
  assert.ok(session);
  assert.equal(elapsedMilliseconds(session, start + 600_000), 120_000);
  await resumeTimer(task.id, start + 600_000);
  await resumeTimer(task.id, start + 610_000);
  await finishTimer(task.id, start + 780_000);
  session = (await getTimerSessions())[0];
  assert.ok(session);
  assert.equal(session.duration, 300_000);
  assert.equal(session.pausedDuration, 480_000);
  assert.equal(session.status, 'finished');
  assert.equal((await getRecords())[0]?.value, 5);
});

test('a timer crossing midnight writes each local day and excludes paused gaps', async () => {
  const task = await createTask(timerInput, at('2026-10-01'));
  await startTimer(task.id, at('2026-10-01', 23, 58));
  await pauseTimer(task.id, at('2026-10-01', 23, 59));
  await resumeTimer(task.id, at('2026-10-02', 0, 1));
  await finishTimer(task.id, at('2026-10-02', 0, 3));
  const records = await getRecords();
  assert.equal(valueForTask(records, task.id, '2026-10-01'), 1);
  assert.equal(valueForTask(records, task.id, '2026-10-02'), 2);
  assert.equal(records.length, 2);
});

test('a contiguous segment is split at local midnight and timestamps match their date', () => {
  const days = splitTimerSegments([
    { start: at('2026-10-01', 23, 58), end: at('2026-10-02', 0, 3) },
  ]);
  assert.deepEqual(
    days.map((day) => [day.date, day.milliseconds]),
    [
      ['2026-10-01', 120_000],
      ['2026-10-02', 180_000],
    ],
  );
  for (const day of days) assert.equal(getLocalDateKey(day.timestamp), day.date);
});

test('midnight splitting follows 23-hour and 25-hour daylight-saving days', () => {
  process.env.TZ = 'America/New_York';
  try {
    const spring = splitTimerSegments([
      { start: new Date(2026, 2, 8).getTime(), end: new Date(2026, 2, 9).getTime() },
    ]);
    const autumn = splitTimerSegments([
      { start: new Date(2026, 10, 1).getTime(), end: new Date(2026, 10, 2).getTime() },
    ]);
    assert.deepEqual(
      spring.map((day) => [day.date, day.milliseconds]),
      [['2026-03-08', 23 * 60 * 60_000]],
    );
    assert.deepEqual(
      autumn.map((day) => [day.date, day.milliseconds]),
      [['2026-11-01', 25 * 60 * 60_000]],
    );
    assert.deepEqual(recentDateKeys(3, '2026-03-09'), ['2026-03-07', '2026-03-08', '2026-03-09']);
  } finally {
    process.env.TZ = 'Asia/Shanghai';
  }
});

test('timezone changes preserve saved calendar keys while new records use the current local day', async () => {
  const timestamp = Date.parse('2026-10-01T00:30:00+08:00');
  const task = await createTask(countInput, timestamp);
  await addRecord(task.id, 1, 'count', 'china', timestamp);
  process.env.TZ = 'America/Los_Angeles';
  try {
    assert.equal(getLocalDateKey(timestamp), '2026-09-30');
    assert.equal((await getRecords())[0]?.date, '2026-10-01');
    await addRecord(task.id, 1, 'count', 'usa', timestamp);
    const records = await getRecords();
    assert.equal(valueForTask(records, task.id, '2026-10-01'), 1);
    assert.equal(valueForTask(records, task.id, '2026-09-30'), 1);
  } finally {
    process.env.TZ = 'Asia/Shanghai';
  }
});

test('concurrent Finish retries are atomic and create only one timer record', async () => {
  const task = await createTask(timerInput, at('2026-10-01'));
  const start = at('2026-10-01', 13);
  await startTimer(task.id, start);
  await Promise.all(Array.from({ length: 8 }, () => finishTimer(task.id, start + 60_000)));
  assert.equal((await getRecords()).length, 1);
  assert.equal((await getTimerSessions())[0]?.status, 'finished');
});

test('a failed timer record write rolls back Finish and a retry commits once', async () => {
  const task = await createTask(timerInput, at('2026-10-01'));
  const start = at('2026-10-01', 13);
  await startTimer(task.id, start);
  database.failNextRecord = true;
  await assert.rejects(finishTimer(task.id, start + 60_000), /disk write failure/);
  assert.equal((await getTimerSessions())[0]?.status, 'running');
  assert.equal((await getRecords()).length, 0);
  await finishTimer(task.id, start + 60_000);
  assert.equal((await getRecords()).length, 1);
});

test('archiving finishes an active timer in the archive transaction', async () => {
  const task = await createTask(timerInput, at('2026-10-01'));
  const start = at('2026-10-01', 13);
  await startTimer(task.id, start);
  await archiveTask(task.id, start + 60_000);
  assert.equal((await getTask(task.id))?.archived, true);
  assert.equal((await getTimerSessions())[0]?.status, 'finished');
  assert.equal((await getRecords())[0]?.value, 1);
});

test('settings, tasks, records, and a running timer survive closing and reopening the SQLite file', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'dailyplus-sqlite-'));
  const path = join(directory, 'daily.db');
  database.close();
  database = new RealSqliteAdapter(path);
  setDatabaseForTesting(database);
  try {
    assert.equal(await loadSettings(), null);
    const settings: Settings = {
      language: 'zh-CN',
      theme: 'dark',
      haptics: false,
      notifications: false,
      weekStartsOn: 1,
      onboarded: true,
    };
    const task = await createTask(timerInput, at('2026-10-01'));
    await saveSettings(settings);
    await addRecord(task.id, 2, 'timer', 'manual-time', at('2026-10-01'));
    await startTimer(task.id, at('2026-10-01', 13));
    database.close();
    database = new RealSqliteAdapter(path);
    setDatabaseForTesting(database);
    assert.deepEqual(await loadSettings(), settings);
    assert.equal((await getTasks()).length, 1);
    assert.equal((await getRecords()).length, 1);
    const session = (await getTimerSessions())[0];
    assert.ok(session);
    assert.equal(elapsedMilliseconds(session, at('2026-10-01', 13, 5)), 300_000);
    await finishTimer(task.id, at('2026-10-01', 13, 5));
    assert.equal(valueForTask(await getRecords(), task.id, '2026-10-01'), 7);
  } finally {
    database.close();
    database = new RealSqliteAdapter();
    setDatabaseForTesting(database);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('decimal corrections can reach zero without being rejected by floating-point residue', async () => {
  const task = await createTask(countInput, at('2026-10-01'));
  await addRecord(task.id, 0.3, 'count', 'fraction-add', at('2026-10-01'));
  await addRecord(task.id, -0.1, 'count', 'fraction-minus-one', at('2026-10-01'));
  await addRecord(task.id, -0.2, 'count', 'fraction-minus-two', at('2026-10-01'));
  assert.equal(valueForTask(await getRecords(), task.id, '2026-10-01'), 0);
  await assert.rejects(
    addRecord(task.id, -0.01, 'count', 'below-zero', at('2026-10-01')),
    /negative/,
  );
});

test('non-finite and oversized inputs cannot poison saved activity or timers', async () => {
  const task = await createTask(timerInput, at('2026-10-01'));
  for (const value of [NaN, Infinity, -Infinity, 1_000_001]) {
    await assert.rejects(addRecord(task.id, value, 'timer'), /nonzero/);
  }
  for (const timestamp of [NaN, Infinity, -1, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => startTimer(task.id, timestamp), /timestamp/);
    assert.throws(() => pauseTimer(task.id, timestamp), /timestamp/);
    assert.throws(() => resumeTimer(task.id, timestamp), /timestamp/);
    await assert.rejects(finishTimer(task.id, timestamp), /timestamp/);
  }
  await assert.rejects(addRecord(task.id, 1, 'timer', 'x'.repeat(241)), /nonzero/);
  assert.equal((await getTimerSessions()).length, 0);
  assert.equal((await getRecords()).length, 0);
});

test('backward clock changes do not create overlapping committed timer segments', async () => {
  const task = await createTask(timerInput, at('2026-10-01'));
  const start = at('2026-10-01', 13);
  await startTimer(task.id, start);
  await pauseTimer(task.id, start + 120_000);
  await resumeTimer(task.id, start + 60_000);
  await finishTimer(task.id, start + 180_000);
  assert.equal(valueForTask(await getRecords(), task.id, '2026-10-01'), 3);
});

test('indexed history matches direct totals for corrections, revisions and unscheduled activity', async () => {
  const task = await createTask(countInput, at('2026-10-01'));
  await addRecord(task.id, 8, 'count', 'complete-one', at('2026-10-01'));
  await updateTask(task.id, { ...countInput, goal: 10, repeatDays: [4] }, at('2026-10-02'));
  await addRecord(task.id, 3, 'count', 'unscheduled-add', at('2026-10-02'));
  await addRecord(task.id, -1, 'count', 'unscheduled-correction', at('2026-10-02'));
  const tasks = await getTasks(),
    records = await getRecords(),
    revisions = await getTaskRevisions();
  const totals = indexRecordTotals(records);
  for (const date of recentDateKeys(30, '2026-10-02')) {
    assert.equal(indexedValue(totals, task.id, date), valueForTask(records, task.id, date));
    assert.deepEqual(
      getDailySummary(tasks, records, date, revisions, totals),
      getDailySummary(tasks, records, date, revisions),
    );
  }
  assert.equal(getDailySummary(tasks, records, '2026-10-02', revisions, totals).totalTasks, 1);
});

test('schema v1 upgrades without changing saved habits, records, or timer state', async () => {
  const task = await createTask(countInput);
  await addRecord(task.id, 2, 'count', 'before-widget-upgrade');
  await database.execAsync('DROP TABLE widget_operations; PRAGMA user_version = 1');
  setDatabaseForTesting(database);
  await initializeDatabase();
  assert.equal((await getRecordsForTask(task.id))[0]?.value, 2);
  assert.equal((await getTask(task.id))?.name, task.name);
  await database.runAsync(
    'INSERT INTO widget_operations (id,timestamp) VALUES (?,?)',
    'first-action',
    1,
  );
  await assert.rejects(
    database.runAsync(
      'INSERT INTO widget_operations (id,timestamp) VALUES (?,?)',
      'first-action',
      2,
    ),
  );
});

test('native widget writes are visible to repositories without replaying or overwriting snapshots', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'daily-shared-widget-'));
  const path = join(directory, 'shared.db');
  const shared = new RealSqliteAdapter(path);
  let native: DatabaseSync | undefined;
  try {
    setDatabaseForTesting(shared);
    const task = await createTask(countInput);
    const before = shared.connection.prepare('PRAGMA data_version').get()?.data_version;
    native = new DatabaseSync(path);
    native.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=3000; BEGIN IMMEDIATE');
    const now = Date.now();
    native
      .prepare(
        "INSERT INTO records (id,task_id,date,value,timestamp,type,operation_id) VALUES (?,?,?,1,?,'count',?)",
      )
      .run('native-record', task.id, getLocalDateKey(now), now, 'native-action');
    native
      .prepare('INSERT INTO widget_operations (id,timestamp) VALUES (?,?)')
      .run('native-action', now);
    native.exec('COMMIT');
    assert.notEqual(shared.connection.prepare('PRAGMA data_version').get()?.data_version, before);
    assert.equal((await getRecordsForTask(task.id))[0]?.value, 1);
    // An ordinary app write preserves the native record and adds a separate operation.
    await addRecord(task.id, 2, 'count', 'app-action');
    assert.equal(
      (await getRecordsForTask(task.id)).reduce((sum, record) => sum + record.value, 0),
      3,
    );
    native.exec('BEGIN IMMEDIATE');
    native
      .prepare(
        "INSERT INTO records (id,task_id,date,value,timestamp,type,operation_id) VALUES (?,?,?,1,?,'count',?)",
      )
      .run('rolled-back', task.id, getLocalDateKey(now), now, 'failed-native-action');
    assert.throws(() =>
      native!
        .prepare('INSERT INTO widget_operations (id,timestamp) VALUES (?,?)')
        .run('native-action', now),
    );
    native.exec('ROLLBACK');
    assert.equal((await getRecordsForTask(task.id)).length, 2);
  } finally {
    native?.close();
    shared.close();
    setDatabaseForTesting(database);
    rmSync(directory, { recursive: true, force: true });
  }
});

test('an app can resume and finish a native paused timer without duplicate sessions or records', async () => {
  const task = await createTask({
    ...countInput,
    trackingType: 'timer',
    unit: 'min',
    goal: 20,
  });
  const start = new Date(2026, 9, 3, 10).getTime();
  const pausedAt = start + 120_000;
  await database.runAsync(
    "INSERT INTO timer_sessions (id,task_id,start_time,status,duration,last_pause_timestamp,segments) VALUES (?,?,?,'paused',?,?,?)",
    'native-timer',
    task.id,
    start,
    120_000,
    pausedAt,
    JSON.stringify([{ start, end: pausedAt }]),
  );
  await resumeTimer(task.id, pausedAt + 60_000);
  await finishTimer(task.id, pausedAt + 240_000);
  await finishTimer(task.id, pausedAt + 241_000);
  const records = await getRecordsForTask(task.id);
  assert.equal(records.length, 1);
  assert.equal(records[0]?.value, 5);
  assert.equal(records[0]?.operationId, 'timer:native-timer:2026-10-03');
  assert.equal((await getTimerSessions()).length, 1);
});
