import { create } from 'zustand';
import { addRecord, getRecords } from '../database/recordRepository';
import type { HabitRecord, TrackingType } from '../types';

export interface RecordState {
  records: HabitRecord[];
  load(): Promise<void>;
  add(taskId: string, value: number, type: TrackingType, operationId?: string): Promise<void>;
}

export const useRecordStore = create<RecordState>((set, get) => ({
  records: [],
  async load() {
    set({ records: await getRecords() });
  },
  async add(taskId, value, type, operationId) {
    await addRecord(taskId, value, type, operationId);
    await get().load();
  },
}));
