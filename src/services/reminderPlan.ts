import type { Task } from '@/types';

export interface ReminderSlot {
  weekday: number;
  hour: number;
  minute: number;
}
export const REMINDER_LIMIT = 56;

/** Recurring calendar slots keep weekday selection and local time across DST. */
export function reminderSlots(task: Task): ReminderSlot[] {
  const reminder = task.reminder;
  if (task.archived || !reminder?.enabled) return [];
  const days = [...new Set(task.repeatDays)]
    .filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    .sort();
  const minute = Math.max(0, Math.min(59, Math.trunc(reminder.minute)));
  if (!Number.isFinite(minute)) return [];
  const hours: number[] = [];
  if (reminder.mode === 'daily') {
    const hour = Math.max(0, Math.min(23, Math.trunc(reminder.hour)));
    if (Number.isFinite(hour)) hours.push(hour);
  } else {
    // Limit interval reminders to waking hours and at least two hours apart.
    const interval = Math.max(2, Math.min(12, Math.trunc(reminder.intervalHours)));
    if (!Number.isFinite(interval)) return [];
    for (let hour = 8; hour <= 20; hour += interval) hours.push(hour);
  }
  return hours.flatMap((hour) => days.map((day) => ({ weekday: day + 1, hour, minute })));
}

export function balancedReminderPlan(tasks: Task[]): { task: Task; slot: ReminderSlot }[] {
  const plans = tasks.map((task) => ({ task, slots: reminderSlots(task) }));
  const result: { task: Task; slot: ReminderSlot }[] = [];
  const longest = Math.max(0, ...plans.map((plan) => plan.slots.length));
  for (let index = 0; index < longest && result.length < REMINDER_LIMIT; index++) {
    for (const plan of plans) {
      const slot = plan.slots[index];
      if (slot && result.length < REMINDER_LIMIT) result.push({ task: plan.task, slot });
    }
  }
  return result;
}
