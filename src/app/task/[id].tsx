import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Archive, Check, Pencil, Plus, RotateCcw } from 'lucide-react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, Field, Icon, ProgressRing, Screen, Text, Timer } from '@/components';
import { useTheme } from '@/theme';
import { useTaskStore } from '@/store/taskStore';
import { useRecordStore } from '@/store/recordStore';
import { useTimerStore } from '@/store/timerStore';
import { getTaskGoal, valueForTask } from '@/utils/progress';
import { useLocalDay } from '@/features/useLocalDay';
import { useActions } from '@/features/useActions';
import { useBack } from '@/features/useBack';
import { PageHeader } from '@/features/PageHeader';
import { Trend } from '@/features/tasks/Trend';
import { parseQuickAddRequest } from '@/utils/deepLink';
import { MAX_HABIT_VALUE, MIN_HABIT_VALUE, VALUE_EPSILON } from '@/utils/validation';

export default function TaskDetailScreen() {
  const { id, quickAdd, operationId } = useLocalSearchParams<{
    id: string;
    quickAdd?: string;
    operationId?: string;
  }>();
  const router = useRouter();
  const goBack = useBack();
  const { t } = useTranslation();
  const { colors } = useTheme();
  const day = useLocalDay();
  const tasks = useTaskStore((state) => state.tasks);
  const revisions = useTaskStore((state) => state.revisions);
  const records = useRecordStore((state) => state.records);
  const sessions = useTimerStore((state) => state.sessions);
  const task = tasks.find((item) => item.id === id);
  const { busy, add, run, feedback } = useActions();
  const [manual, setManual] = useState(false);
  const [amount, setAmount] = useState('1');
  const linkRequest = parseQuickAddRequest({ id, quickAdd, operationId });
  const dismissLink = () => router.setParams({ quickAdd: undefined, operationId: undefined });
  if (!task)
    return (
      <Screen>
        <PageHeader title={t('task.missingTitle')} onBack={goBack} />
        <EmptyState
          title={t('task.missingTitle')}
          message={t('task.missingMessage')}
          action={t('task.backHome')}
          onAction={() => router.replace('/(tabs)')}
        />
      </Screen>
    );
  const value = valueForTask(records, id, day);
  const goal = getTaskGoal(task, day, revisions);
  const unit = t(`units.${task.unit}`, { defaultValue: task.unit });
  const session = sessions.find((item) => item.taskId === id && item.status !== 'finished');
  const saveManual = async () => {
    const numeric = Number(amount);
    if (
      !Number.isFinite(numeric) ||
      Math.abs(numeric) < MIN_HABIT_VALUE ||
      Math.abs(numeric) > MAX_HABIT_VALUE ||
      value + numeric < -VALUE_EPSILON
    ) {
      Alert.alert(t('error.title'), t('error.invalidAmount'));
      return;
    }
    if (await add(task, numeric)) {
      setManual(false);
      setAmount('1');
    }
  };
  const archive = () =>
    Alert.alert(t('task.archiveTitle'), t('task.archiveMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('task.archive'),
        style: 'destructive',
        onPress: () =>
          void run(id, async () => {
            await useTaskStore.getState().archive(id);
            goBack();
          }),
      },
    ]);
  const timerAction = (action: 'start' | 'pause' | 'resume' | 'finish') =>
    run(id, async () => {
      await useTimerStore.getState()[action](id);
      if (action === 'start' || action === 'finish')
        await feedback(action === 'finish' ? 'success' : 'light');
    });
  return (
    <Screen>
      <PageHeader
        title={task.name}
        subtitle={task.archived ? t('task.archived') : t('common.today')}
        onBack={goBack}
        right={
          !task.archived ? (
            <Button
              title={t('task.edit')}
              icon={Pencil}
              variant="ghost"
              onPress={() => router.push({ pathname: '/create-task', params: { id } })}
            />
          ) : undefined
        }
      />
      <View style={styles.progress}>
        <ProgressRing
          progress={Math.min(1, value / goal)}
          size={220}
          strokeWidth={11}
          color={task.color}
        >
          <View style={styles.ringInner}>
            <View style={[styles.taskIcon, { backgroundColor: `${task.color}18` }]}>
              <Icon name={task.icon} size={28} color={task.color} />
            </View>
            <Text variant="largeTitle" style={styles.number}>
              {Number(value.toFixed(1))}
            </Text>
            <Text color={colors.textSecondary}>
              / {goal} {unit}
            </Text>
          </View>
        </ProgressRing>
        <View style={styles.status}>
          {value >= goal && <Check size={17} color={colors.primary} />}
          <Text color={value >= goal ? colors.primary : colors.textSecondary} style={styles.center}>
            {t(value >= goal ? 'task.completed' : 'task.consistency')}
          </Text>
        </View>
      </View>
      {task.archived ? (
        <View style={styles.archived}>
          <Text color={colors.textSecondary} style={styles.center}>
            {t('task.archivedHint')}
          </Text>
          <Button
            title={t('task.restore')}
            icon={RotateCcw}
            loading={busy === id}
            onPress={() => run(id, () => useTaskStore.getState().restore(id))}
          />
        </View>
      ) : (
        <View style={styles.actions}>
          {linkRequest?.taskId === task.id && task.trackingType === 'count' && (
            <View style={[styles.manual, { backgroundColor: colors.primarySoft }]}>
              <Text variant="headline">{t('task.linkTitle')}</Text>
              <Text>{t('task.linkMessage', { name: task.name, unit })}</Text>
              <Button
                title={t('task.linkConfirm')}
                loading={busy === id}
                onPress={async () => {
                  if (await add(task, 1, linkRequest.operationId)) dismissLink();
                }}
              />
              <Button
                title={t('common.cancel')}
                variant="ghost"
                disabled={busy === id}
                onPress={dismissLink}
              />
            </View>
          )}
          {task.trackingType === 'timer' ? (
            <Timer
              session={session}
              onStart={() => timerAction('start')}
              onPause={() => timerAction('pause')}
              onResume={() => timerAction('resume')}
              onFinish={() => timerAction('finish')}
            />
          ) : (
            <Button
              title={t('task.quickAdd')}
              icon={Plus}
              loading={busy === id}
              onPress={() => add(task)}
            />
          )}
          <Button
            title={t('task.manual')}
            variant="ghost"
            onPress={() => setManual((current) => !current)}
          />
          {manual && (
            <View style={[styles.manual, { backgroundColor: colors.surface }]}>
              <Field
                label={t('task.amount', { unit })}
                value={amount}
                onChangeText={setAmount}
                keyboardType="numbers-and-punctuation"
              />
              <Text variant="caption" color={colors.textSecondary}>
                {t('task.correctionHint')}
              </Text>
              <Button
                title={t('task.record')}
                loading={busy === id}
                onPress={() => void saveManual()}
              />
            </View>
          )}
        </View>
      )}
      <Trend task={task} records={records} revisions={revisions} date={day} />
      {!task.archived && (
        <Button title={t('task.archive')} icon={Archive} variant="ghost" onPress={archive} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { alignItems: 'center', paddingTop: 0, paddingBottom: 10, gap: 22 },
  ringInner: { alignItems: 'center', gap: 5, maxWidth: 178 },
  taskIcon: {
    width: 54,
    height: 54,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 5,
  },
  number: { fontSize: 43, lineHeight: 52, fontVariant: ['tabular-nums'] },
  status: { flexDirection: 'row', gap: 6, alignItems: 'center', maxWidth: '100%' },
  actions: { gap: 10 },
  archived: { gap: 18 },
  center: { textAlign: 'center', lineHeight: 24, flexShrink: 1 },
  manual: { padding: 22, borderRadius: 26, gap: 16 },
});
