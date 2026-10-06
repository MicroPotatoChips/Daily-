export type TrackingType = 'count' | 'timer';
export type IconName =
  | 'droplets'
  | 'activity'
  | 'book-open'
  | 'flower'
  | 'stretch'
  | 'moon'
  | 'apple'
  | 'heart'
  | 'sun'
  | 'coffee'
  | 'graduation-cap'
  | 'leaf';
export interface Reminder {
  enabled: boolean;
  mode: 'daily' | 'interval';
  hour: number;
  minute: number;
  intervalHours: number;
}
export interface Task {
  id: string;
  name: string;
  icon: IconName;
  color: string;
  trackingType: TrackingType;
  goal: number;
  unit: string;
  repeatDays: number[];
  createdAt: number;
  archived: boolean;
  archivedAt: number | null;
  reminder: Reminder | null;
}
export type TaskInput = Omit<Task, 'id' | 'createdAt' | 'archived' | 'archivedAt'>;
export interface HabitRecord {
  id: string;
  taskId: string;
  date: string;
  value: number;
  timestamp: number;
  type: TrackingType;
  operationId: string;
}
export interface TaskRevision {
  taskId: string;
  effectiveDate: string;
  goal: number;
  repeatDays: number[];
}
export interface TimerSegment {
  start: number;
  end: number;
}
export interface TimerSession {
  id: string;
  taskId: string;
  startTime: number;
  endTime: number | null;
  duration: number;
  status: 'running' | 'paused' | 'finished';
  startTimestamp: number | null;
  pausedDuration: number;
  lastPauseTimestamp: number | null;
  segments: TimerSegment[];
}
export interface DailySummary {
  date: string;
  completedTasks: number;
  totalTasks: number;
  completionRate: number;
}
export interface Settings {
  language: 'system' | 'en' | 'zh-CN';
  theme: 'system' | 'light' | 'dark';
  haptics: boolean;
  notifications: boolean;
  weekStartsOn: 0 | 1;
  onboarded: boolean;
}
