import type { TaskInput } from '@/types';
import { taskColors } from '@/theme';
export { taskColors } from '@/theme';
export const templates = [
  {
    key: 'water',
    icon: 'droplets',
    color: taskColors[1],
    trackingType: 'count',
    goal: 8,
    unitKey: 'templates.cups',
  },
  {
    key: 'exercise',
    icon: 'activity',
    color: taskColors[0],
    trackingType: 'timer',
    goal: 30,
    unitKey: 'common.min',
  },
  {
    key: 'reading',
    icon: 'book-open',
    color: taskColors[3],
    trackingType: 'timer',
    goal: 20,
    unitKey: 'common.min',
  },
  {
    key: 'meditation',
    icon: 'flower',
    color: taskColors[4],
    trackingType: 'timer',
    goal: 10,
    unitKey: 'common.min',
  },
] as const;

export function templateInput(key: string, t: (key: string) => string): TaskInput | undefined {
  const template = templates.find((item) => item.key === key);
  if (!template) return undefined;
  return {
    name: t(`templates.${template.key}`),
    icon: template.icon,
    color: template.color,
    trackingType: template.trackingType,
    goal: template.goal,
    unit: template.trackingType === 'timer' ? 'min' : 'cups',
    repeatDays: [0, 1, 2, 3, 4, 5, 6],
    reminder: null,
  };
}
