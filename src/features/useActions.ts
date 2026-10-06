import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';
import { useRecordStore } from '@/store/recordStore';
import { useTaskStore } from '@/store/taskStore';
import { useSettingsStore } from '@/store/settingsStore';
import { getLocalDateKey } from '@/utils/date';
import { getTaskGoal, valueForTask } from '@/utils/progress';
import type { Task } from '@/types';

export function useActions() {
  const { t } = useTranslation();
  const locked = useRef(new Set<string>());
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async (id: string, action: () => Promise<unknown>) => {
      if (locked.current.has(id)) return false;
      locked.current.add(id);
      setBusy(id);
      try {
        await action();
        return true;
      } catch {
        Alert.alert(t('error.title'), t('error.message'));
        return false;
      } finally {
        locked.current.delete(id);
        setBusy([...locked.current].at(-1) ?? null);
      }
    },
    [t],
  );
  const feedback = useCallback(async (kind: 'light' | 'complete' | 'success') => {
    if (!useSettingsStore.getState().settings.haptics) return;
    try {
      if (kind === 'success')
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      else
        await Haptics.impactAsync(
          kind === 'complete'
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light,
        );
    } catch {
      /* Haptics may be unavailable on a simulator. */
    }
  }, []);
  const add = useCallback(
    async (task: Task, value = 1, operationId?: string) =>
      run(task.id, async () => {
        const date = getLocalDateKey();
        const before = valueForTask(useRecordStore.getState().records, task.id, date);
        const goal = getTaskGoal(task, date, useTaskStore.getState().revisions);
        await useRecordStore.getState().add(task.id, value, task.trackingType, operationId);
        await feedback(before < goal && before + value >= goal ? 'complete' : 'light');
      }),
    [feedback, run],
  );
  return { busy, run, feedback, add };
}
