import type { TimerSegment, TimerSession } from '../types';
import { getLocalDateKey } from './date';

export function timerPrimaryAction(session?: TimerSession): 'start' | 'pause' | 'resume' {
  return session?.status === 'running'
    ? 'pause'
    : session?.status === 'paused'
      ? 'resume'
      : 'start';
}

export function formatTimerClock(milliseconds: number): string {
  const seconds = Number.isFinite(milliseconds) ? Math.floor(Math.max(0, milliseconds) / 1000) : 0;
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((value) => String(value).padStart(2, '0'))
    .join(':');
}

export function elapsedMilliseconds(session: TimerSession, now = Date.now()): number {
  const running =
    session.status === 'running' && session.startTimestamp !== null
      ? Math.max(0, now - session.startTimestamp)
      : 0;
  return Math.max(0, session.duration + running);
}

/** Splits wall-clock segments at actual local midnight, including 23/25-hour days. */
export function splitTimerSegments(
  segments: readonly TimerSegment[],
): { date: string; milliseconds: number; timestamp: number }[] {
  const days = new Map<string, { date: string; milliseconds: number; timestamp: number }>();
  for (const segment of segments) {
    let cursor = segment.start;
    while (cursor < segment.end) {
      const date = new Date(cursor);
      const midnight = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();
      const end = Math.min(midnight, segment.end);
      const key = getLocalDateKey(cursor);
      const entry = days.get(key) ?? { date: key, milliseconds: 0, timestamp: cursor };
      entry.milliseconds += end - cursor;
      entry.timestamp = end - 1;
      days.set(key, entry);
      cursor = end;
    }
  }
  return [...days.values()].sort((left, right) => left.date.localeCompare(right.date));
}
