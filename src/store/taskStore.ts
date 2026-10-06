import { create } from 'zustand';
import {
  archiveTask,
  createTask,
  getTaskRevisions,
  getTasks,
  restoreTask,
  updateTask,
} from '../database/taskRepository';
import type { Task, TaskInput, TaskRevision } from '../types';
import { useRecordStore } from './recordStore';
import { useTimerStore } from './timerStore';

export interface TaskState {
  tasks: Task[];
  revisions: TaskRevision[];
  load(): Promise<void>;
  create(input: TaskInput): Promise<Task>;
  update(id: string, input: TaskInput): Promise<void>;
  archive(id: string): Promise<void>;
  restore(id: string): Promise<void>;
}

export const useTaskStore = create<TaskState>((set, get) => ({
  tasks: [],
  revisions: [],
  async load() {
    const [tasks, revisions] = await Promise.all([getTasks(), getTaskRevisions()]);
    set({ tasks, revisions });
  },
  async create(input) {
    const task = await createTask(input);
    await get().load();
    return task;
  },
  async update(id, input) {
    await updateTask(id, input);
    await get().load();
  },
  async archive(id) {
    await archiveTask(id);
    await Promise.all([
      get().load(),
      useRecordStore.getState().load(),
      useTimerStore.getState().load(),
    ]);
  },
  async restore(id) {
    await restoreTask(id);
    await get().load();
  },
}));
