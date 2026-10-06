import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BottomSheet, EmptyState, Screen } from '@/components';
import { useTaskStore } from '@/store/taskStore';
import { TaskForm } from '@/features/tasks/TaskForm';
import { useBack } from '@/features/useBack';

export default function CreateTaskScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { t } = useTranslation();
  const goBack = useBack();
  const task = useTaskStore((state) => state.tasks.find((item) => item.id === id));
  if (id && (!task || task.archived))
    return (
      <Screen>
        <EmptyState
          title={t('task.missingTitle')}
          message={t('task.missingMessage')}
          action={t('common.back')}
          onAction={goBack}
        />
      </Screen>
    );
  return (
    <Screen style={{ padding: 16, paddingBottom: 40 }}>
      <BottomSheet>
        <TaskForm task={task} />
      </BottomSheet>
    </Screen>
  );
}
