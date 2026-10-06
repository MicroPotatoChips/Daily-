import {
  finishTimer,
  getTimerSessions,
  pauseTimer,
  resumeTimer,
  startTimer,
} from '../database/timerRepository';
import type { TimerSession } from '../types';
import { elapsedMilliseconds } from '../utils/timer';

/** Timers persist each transition. UI intervals only repaint timestamp-derived elapsed time. */
export class TimerService {
  recover(): Promise<TimerSession[]> {
    return getTimerSessions();
  }
  start(taskId: string): Promise<TimerSession> {
    return startTimer(taskId);
  }
  pause(taskId: string): Promise<void> {
    return pauseTimer(taskId);
  }
  resume(taskId: string): Promise<void> {
    return resumeTimer(taskId);
  }
  finish(taskId: string): Promise<TimerSession | null> {
    return finishTimer(taskId);
  }
  elapsed(session: TimerSession, now = Date.now()): number {
    return elapsedMilliseconds(session, now);
  }
}

export const timerService = new TimerService();
