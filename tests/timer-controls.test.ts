import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TimerSession } from '../src/types';
import { elapsedMilliseconds, formatTimerClock, timerPrimaryAction } from '../src/utils/timer';

const session: TimerSession = {
  id: 'timer-controls',
  taskId: 'reading',
  startTime: 100_000,
  endTime: null,
  duration: 120_000,
  status: 'paused',
  startTimestamp: null,
  pausedDuration: 0,
  lastPauseTimestamp: 220_000,
  segments: [{ start: 100_000, end: 220_000 }],
};

test('quick timer controls resume a paused session and its displayed clock stays frozen', () => {
  assert.equal(timerPrimaryAction(session), 'resume');
  assert.equal(formatTimerClock(elapsedMilliseconds(session, 400_000)), '00:02:00');
  assert.equal(formatTimerClock(elapsedMilliseconds(session, 4_000_000)), '00:02:00');
  const resumed = { ...session, status: 'running' as const, startTimestamp: 400_000 };
  assert.equal(timerPrimaryAction(resumed), 'pause');
  assert.equal(formatTimerClock(elapsedMilliseconds(resumed, 461_000)), '00:03:01');
});

test('quick timer controls can start again after finish and keep full-hour clock formatting', () => {
  assert.equal(timerPrimaryAction(), 'start');
  assert.equal(timerPrimaryAction({ ...session, status: 'finished' }), 'start');
  assert.equal(formatTimerClock(25 * 3_600_000 + 61_000), '25:01:01');
  assert.equal(formatTimerClock(-1), '00:00:00');
  assert.equal(formatTimerClock(Number.NaN), '00:00:00');
});
