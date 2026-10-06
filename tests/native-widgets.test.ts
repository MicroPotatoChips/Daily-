import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createWidgetSnapshot } from '../src/services/widgetSnapshot';
import { balancedReminderPlan, reminderSlots, REMINDER_LIMIT } from '../src/services/reminderPlan';
import type { HabitRecord, Task, TimerSession } from '../src/types';

const require = createRequire(import.meta.url);
type Section = Record<string, unknown>;
interface Project {
  hash: {
    project: { rootObject: string; rootObject_comment: string; objects: Record<string, Section> };
  };
  writeSync(): string;
  parseSync(): void;
}
interface WidgetHelpers {
  addWidgetTarget(project: Project, bundle: string, group: string, team?: string): string;
  applyAndroidManifest(manifest: unknown, packageName: string): unknown;
  copyAndroidSources(root: string, packageName: string): void;
  copyIosSources(root: string, group: string, version: string, build: string): void;
}
const helpers = (require('../plugins/withDailyWidgets') as { helpers: WidgetHelpers }).helpers;
const xcode = require('xcode') as { project(path: string): Project };
const task: Task = {
  id: 'water',
  name: 'Water',
  icon: 'droplets',
  color: '#538E7D',
  trackingType: 'count',
  goal: 8,
  unit: 'cups',
  repeatDays: [1, 3, 5],
  createdAt: new Date(2026, 8, 1).getTime(),
  archived: false,
  archivedAt: null,
  reminder: { enabled: true, mode: 'daily', hour: 18, minute: 30, intervalHours: 2 },
};

test('widget snapshot sums real records, retains revisions, and omits archived tasks', () => {
  const records: HabitRecord[] = [1, 2].map((value) => ({
    id: String(value),
    taskId: 'water',
    date: '2026-10-01',
    value,
    timestamp: value,
    type: 'count',
    operationId: String(value),
  }));
  const snapshot = createWidgetSnapshot(
    [task, { ...task, id: 'archived', archived: true }],
    records,
    [{ taskId: task.id, effectiveDate: '2026-10-01', goal: 9, repeatDays: [4] }],
    undefined,
    new Date(2026, 9, 1),
    'zh-CN',
  );
  assert.equal(snapshot.tasks.length, 1);
  assert.equal(snapshot.tasks[0]?.values['2026-10-01'], 3);
  assert.equal(snapshot.tasks[0]?.createdDate, '2026-09-01');
  assert.equal(snapshot.tasks[0]?.revisions[0]?.goal, 9);
  assert.equal(snapshot.language, 'zh-CN');
});

test('widget fallback keeps running and paused timers and drops finished sessions', () => {
  const now = new Date(2026, 9, 3, 10, 0);
  const session: TimerSession = {
    id: 'session-running',
    taskId: 'running',
    startTime: now.getTime() - 120000,
    endTime: null,
    status: 'running',
    duration: 60000,
    startTimestamp: now.getTime() - 30000,
    pausedDuration: 30000,
    lastPauseTimestamp: null,
    segments: [{ start: now.getTime() - 120000, end: now.getTime() - 60000 }],
  };
  const tasks = ['running', 'paused', 'finished', 'idle'].map((id) => ({
    ...task,
    id,
    trackingType: 'timer' as const,
  }));
  const sessions: TimerSession[] = [
    session,
    {
      ...session,
      id: 'session-paused',
      taskId: 'paused',
      status: 'paused',
      startTimestamp: null,
      duration: 90000,
      lastPauseTimestamp: now.getTime() - 5000,
    },
    {
      ...session,
      id: 'session-finished',
      taskId: 'finished',
      status: 'finished',
      startTimestamp: null,
      endTime: now.getTime(),
    },
  ];
  const snapshot = createWidgetSnapshot(tasks, [], [], undefined, now, 'zh-CN', sessions);
  const decoded = JSON.parse(JSON.stringify(snapshot)) as typeof snapshot;
  assert.deepEqual(decoded.tasks[0]?.timer, {
    id: 'session-running',
    status: 'running',
    duration: 60000,
    start_timestamp: now.getTime() - 30000,
    last_pause_timestamp: null,
  });
  assert.deepEqual(decoded.tasks[1]?.timer, {
    id: 'session-paused',
    status: 'paused',
    duration: 90000,
    start_timestamp: null,
    last_pause_timestamp: now.getTime() - 5000,
  });
  assert.equal(decoded.tasks[2]?.timer, null);
  assert.equal(decoded.tasks[3]?.timer, null);
});

test('reminders use selected weekdays and are removed on archive or disable', () => {
  assert.deepEqual(reminderSlots(task), [
    { weekday: 2, hour: 18, minute: 30 },
    { weekday: 4, hour: 18, minute: 30 },
    { weekday: 6, hour: 18, minute: 30 },
  ]);
  assert.deepEqual(reminderSlots({ ...task, archived: true }), []);
  assert.deepEqual(reminderSlots({ ...task, reminder: { ...task.reminder!, enabled: false } }), []);
});

test('interval reminders avoid overnight delivery and respect the global OS budget', () => {
  const intervalTask = {
    ...task,
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    reminder: { ...task.reminder!, mode: 'interval' as const, intervalHours: 1 },
  };
  const slots = reminderSlots(intervalTask);
  assert.equal(slots.length, 49);
  assert.ok(slots.every((slot) => slot.hour >= 8 && slot.hour <= 20));
  assert.equal(new Set(slots.map((slot) => slot.hour)).size, 7);
  const plan = balancedReminderPlan([intervalTask, { ...intervalTask, id: 'second' }]);
  assert.equal(plan.length, REMINDER_LIMIT);
  assert.equal(plan.filter(({ task: plannedTask }) => plannedTask.id === 'second').length, 28);
});

test('Android prebuild copies native provider/resources and manifest changes are idempotent', () => {
  const directory = mkdtempSync(join(tmpdir(), 'daily-widget-'));
  try {
    helpers.copyAndroidSources(directory, 'com.dailyplus.app');
    const provider = readFileSync(
      join(directory, 'app/src/main/java/com/dailyplus/app/DailyWidgetProvider.kt'),
      'utf8',
    );
    assert.match(provider, /package com\.dailyplus\.app/);
    assert.doesNotMatch(provider, /__PACKAGE__/);
    assert.doesNotMatch(provider, /quickAdd=1/);
    assert.match(provider, /PendingIntent\.getBroadcast/);
    const database = readFileSync(
      join(directory, 'app/src/main/java/com/dailyplus/app/DailyWidgetDatabase.kt'),
      'utf8',
    );
    assert.match(database, /package com\.dailyplus\.app/);
    assert.doesNotMatch(database, /__PACKAGE__/);
    assert.match(provider, /Intent\.ACTION_TIMEZONE_CHANGED/);
    assert.match(provider, /onAppWidgetOptionsChanged/);
    const row = readFileSync(
      join(directory, 'app/src/main/res/layout/daily_widget_row.xml'),
      'utf8',
    );
    assert.match(row, /daily_widget_task_timer/);
    assert.match(row, /daily_widget_task_status/);
    assert.match(row, /sans-serif-medium/);
    assert.match(
      readFileSync(
        join(directory, 'app/src/main/res/drawable/daily_widget_action_dark.xml'),
        'utf8',
      ),
      /#2B4635/,
    );
    assert.match(
      readFileSync(join(directory, 'app/src/main/res/xml/daily_widget_info.xml'), 'utf8'),
      /appwidget-provider/,
    );
    const manifest = {
      manifest: { $: {}, application: [{ $: { 'android:name': '.MainApplication' } }] },
    };
    helpers.applyAndroidManifest(manifest, 'com.dailyplus.app');
    const first = JSON.stringify(manifest);
    helpers.applyAndroidManifest(manifest, 'com.dailyplus.app');
    assert.equal(JSON.stringify(manifest), first);
    assert.match(first, /RECEIVE_BOOT_COMPLETED/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('iOS prebuild produces a parsed, embedded, signed widget target once', () => {
  const directory = mkdtempSync(join(tmpdir(), 'daily-ios-widget-'));
  try {
    helpers.copyIosSources(directory, 'group.com.dailyplus.app', '1.0.0', '1');
    assert.match(
      readFileSync(join(directory, 'DailyPlusWidget/DailyPlusWidget-Info.plist'), 'utf8'),
      /com\.apple\.widgetkit-extension/,
    );
    assert.match(
      readFileSync(join(directory, 'DailyPlusWidget/DailyPlusWidget.entitlements'), 'utf8'),
      /group.com.dailyplus.app/,
    );
    const projectFile = join(directory, 'project.pbxproj');
    const project = xcode.project(projectFile);
    project.hash = {
      project: {
        rootObject: '000000000000000000000001',
        rootObject_comment: 'Project object',
        objects: {
          PBXProject: {
            '000000000000000000000001': {
              isa: 'PBXProject',
              attributes: {},
              mainGroup: '000000000000000000000002',
              targets: [{ value: '000000000000000000000004', comment: 'Daily' }],
              buildConfigurationList: '000000000000000000000005',
            },
            '000000000000000000000001_comment': 'Project object',
          },
          PBXGroup: {
            '000000000000000000000002': {
              isa: 'PBXGroup',
              children: [{ value: '000000000000000000000003', comment: 'Products' }],
              sourceTree: '"<group>"',
            },
            '000000000000000000000002_comment': 'Main Group',
            '000000000000000000000003': {
              isa: 'PBXGroup',
              name: 'Products',
              children: [],
              sourceTree: '"<group>"',
            },
            '000000000000000000000003_comment': 'Products',
          },
          PBXNativeTarget: {
            '000000000000000000000004': {
              isa: 'PBXNativeTarget',
              name: 'Daily',
              buildConfigurationList: '000000000000000000000005',
              buildPhases: [],
              dependencies: [],
              productType: '"com.apple.product-type.application"',
            },
            '000000000000000000000004_comment': 'Daily',
          },
          XCConfigurationList: {
            '000000000000000000000005': {
              isa: 'XCConfigurationList',
              buildConfigurations: [
                { value: '000000000000000000000006', comment: 'Debug' },
                { value: '000000000000000000000007', comment: 'Release' },
              ],
              defaultConfigurationName: 'Release',
            },
            '000000000000000000000005_comment': 'Build configuration list',
          },
          XCBuildConfiguration: {
            '000000000000000000000006': {
              isa: 'XCBuildConfiguration',
              name: 'Debug',
              buildSettings: { PRODUCT_NAME: 'Daily' },
            },
            '000000000000000000000006_comment': 'Debug',
            '000000000000000000000007': {
              isa: 'XCBuildConfiguration',
              name: 'Release',
              buildSettings: { PRODUCT_NAME: 'Daily' },
            },
            '000000000000000000000007_comment': 'Release',
          },
          PBXFileReference: {},
          PBXBuildFile: {},
        },
      },
    };
    const targetId = helpers.addWidgetTarget(
      project,
      'com.dailyplus.app',
      'group.com.dailyplus.app',
      'ABC123',
    );
    assert.equal(
      helpers.addWidgetTarget(project, 'com.dailyplus.app', 'group.com.dailyplus.app'),
      targetId,
    );
    const generated = project.writeSync();
    assert.match(generated, /com\.apple\.product-type\.app-extension/);
    assert.match(generated, /DailyPlusWidget\/DailyPlusWidget.swift/);
    assert.match(generated, /DailyWidgetDatabase.swift/);
    assert.match(generated, /-lsqlite3/);
    assert.match(generated, /CODE_SIGN_ENTITLEMENTS/);
    assert.match(generated, /DEVELOPMENT_TEAM = ABC123/);
    assert.match(generated, /dstSubfolderSpec = 13/);
    assert.match(generated, /PBXTargetDependency/);
    writeFileSync(projectFile, generated);
    const parsed = xcode.project(projectFile);
    parsed.parseSync();
    assert.ok(parsed.hash.project.objects.PBXNativeTarget?.[targetId]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
