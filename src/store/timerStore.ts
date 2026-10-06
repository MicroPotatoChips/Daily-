import { create } from 'zustand';
import { timerService } from '../services/TimerService';
import type { TimerSession } from '../types';
import { useRecordStore } from './recordStore';

export interface TimerState {
  sessions: TimerSession[];
  load(): Promise<void>;
  start(taskId: string): Promise<void>;
  pause(taskId: string): Promise<void>;
  resume(taskId: string): Promise<void>;
  finish(taskId: string): Promise<void>;
}

export const useTimerStore = create<TimerState>((set, get) => ({
  sessions: [],
  async load() {
    set({ sessions: await timerService.recover() });
  },
  async start(taskId) {
    await timerService.start(taskId);
    await get().load();
  },
  async pause(taskId) {
    await timerService.pause(taskId);
    await get().load();
  },
  async resume(taskId) {
    await timerService.resume(taskId);
    await get().load();
  },
  async finish(taskId) {
    await timerService.finish(taskId);
    await Promise.all([get().load(), useRecordStore.getState().load()]);
  },
}));
