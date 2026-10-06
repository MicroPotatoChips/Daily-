import { useCallback, useMemo } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { Plus, Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, EmptyState, ProgressRing, Screen, TaskCard, Text } from '@/components';
import { useTheme } from '@/theme';
import { useTaskStore } from '@/store/taskStore';
import { useRecordStore } from '@/store/recordStore';
import { useTimerStore } from '@/store/timerStore';
import { dateFromKey } from '@/utils/date';
import {
  getDailySummary,
  isTaskScheduled,
  indexedValue,
  indexRecordTotals,
} from '@/utils/progress';
import { useLocalDay } from '@/features/useLocalDay';
import { useActions } from '@/features/useActions';
import { templateInput } from '@/features/tasks/templates';
import { TemplateCards } from '@/features/tasks/TemplateCards';
import type { Task } from '@/types';
import { BrandArt } from '@/components/BrandArt';
import { timerPrimaryAction } from '@/utils/timer';

export default function HomeScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const { colors } = useTheme();
  const day = useLocalDay();
  const tasks = useTaskStore((state) => state.tasks);
  const revisions = useTaskStore((state) => state.revisions);
  const records = useRecordStore((state) => state.records);
  const sessions = useTimerStore((state) => state.sessions);
  const { busy, add, run, feedback } = useActions();
  const totals = useMemo(() => indexRecordTotals(records), [records]);
  const scheduled = useMemo(
    () => tasks.filter((task) => isTaskScheduled(task, day, revisions)),
    [tasks, day, revisions],
  );
  const summary = useMemo(
    () => getDailySummary(scheduled, records, day, revisions, totals),
    [scheduled, records, day, revisions, totals],
  );
  const sessionsByTask = useMemo(
    () =>
      new Map(
        sessions
          .filter((session) => session.status !== 'finished')
          .map((session) => [session.taskId, session]),
      ),
    [sessions],
  );
  // A timer started on a previous day stays directly controllable even on a rest day.
  const extraTimerTasks = tasks.filter(
    (task) =>
      !task.archived &&
      sessionsByTask.has(task.id) &&
      !scheduled.some((item) => item.id === task.id),
  );
  const hasTasks = tasks.some((task) => !task.archived);
  const locale = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';
  const dateLabel = dateFromKey(day).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
  const openTask = useCallback(
    (task: Task) => router.push({ pathname: '/task/[id]', params: { id: task.id } }),
    [router],
  );
  const selectTemplate = async (key: string) => {
    const input = templateInput(key, t);
    if (input) await run('template', () => useTaskStore.getState().create(input));
  };
  const timerAction = (taskId: string, action: 'start' | 'pause' | 'resume' | 'finish') =>
    run(taskId, async () => {
      await useTimerStore.getState()[action](taskId);
      await feedback(action === 'finish' ? 'success' : 'light');
    });
  const quickAction = (task: Task) => {
    if (task.trackingType === 'count') return add(task);
    const currentSession = useTimerStore
      .getState()
      .sessions.find((session) => session.taskId === task.id && session.status !== 'finished');
    return timerAction(task.id, timerPrimaryAction(currentSession));
  };
  const taskCard = (task: Task) => (
    <TaskCard
      task={task}
      value={indexedValue(totals, task.id, day)}
      session={sessionsByTask.get(task.id)}
      busy={busy === task.id}
      onPress={() => openTask(task)}
      onQuickAdd={() => quickAction(task)}
      onFinish={() => timerAction(task.id, 'finish')}
    />
  );
  const header = (
    <View>
      <View style={styles.brandRow}>
        <View style={styles.wordmarkRow}>
          <BrandArt width={39} height={39} />
          <Text variant="largeTitle">
            Daily
            <Text variant="largeTitle" color={colors.primary}>
              +
            </Text>
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('home.settings')}
          onPress={() => router.push('/settings')}
          style={[styles.settings, { backgroundColor: colors.surface }]}
        >
          <Settings size={22} color={colors.textPrimary} />
        </Pressable>
      </View>
      <Text color={colors.textSecondary} style={styles.date}>
        {dateLabel}
      </Text>
      <View style={[styles.hero, { backgroundColor: colors.primarySoft }]}>
        <View style={styles.heroCopy}>
          <Text variant="caption" color={colors.primary} style={styles.overline}>
            {t('home.progress')}
          </Text>
          <Text variant="title" style={styles.heroTitle}>
            {t('home.greeting')}
          </Text>
          <Text color={colors.textSecondary}>
            {t('home.completed', { done: summary.completedTasks, total: summary.totalTasks })}
          </Text>
        </View>
        <ProgressRing progress={summary.completionRate} size={104} strokeWidth={7}>
          <Text variant="title">
            {Math.round(summary.completionRate * 100)}
            <Text variant="caption" color={colors.textSecondary}>
              %
            </Text>
          </Text>
        </ProgressRing>
      </View>
      {extraTimerTasks.map((task) => (
        <View key={task.id} style={styles.extraTimer}>
          {taskCard(task)}
        </View>
      ))}
      <View style={styles.sectionTitle}>
        <Text variant="headline">{t('home.tasks')}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {scheduled.length.toString().padStart(2, '0')}
        </Text>
      </View>
    </View>
  );
  return (
    <Screen scroll={false}>
      <FlatList
        data={scheduled}
        keyExtractor={(task) => task.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        ListHeaderComponent={header}
        renderItem={({ item }) => <View style={styles.task}>{taskCard(item)}</View>}
        ListEmptyComponent={
          <View>
            <EmptyState
              title={t(hasTasks ? 'home.restTitle' : 'home.emptyTitle')}
              message={t(hasTasks ? 'home.restMessage' : 'home.emptyMessage')}
              illustration={hasTasks ? 'focus' : 'growth'}
            />
            {!hasTasks && (
              <TemplateCards
                onSelect={(key) => void selectTemplate(key)}
                busy={busy === 'template'}
              />
            )}
          </View>
        }
        ListFooterComponent={
          <View style={styles.footer}>
            <Button
              title={t('home.add')}
              icon={Plus}
              onPress={() => router.push('/create-task')}
              variant="secondary"
            />
            {summary.totalTasks > 0 && summary.completedTasks === summary.totalTasks && (
              <View style={[styles.celebration, { backgroundColor: colors.primarySoft }]}>
                <BrandArt kind="celebrate" height={126} />
                <Text color={colors.textSecondary} style={styles.complete}>
                  {t('home.allDone')}
                </Text>
              </View>
            )}
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  celebration: { borderRadius: 28, padding: 16, gap: 8 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  list: { paddingBottom: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  settings: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  date: { marginTop: 6, marginBottom: 26 },
  hero: { padding: 22, borderRadius: 32, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroCopy: { flex: 1, gap: 12 },
  heroTitle: { lineHeight: 33 },
  overline: { letterSpacing: 1.2, fontWeight: '600' },
  sectionTitle: {
    marginTop: 32,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  task: { marginBottom: 12 },
  footer: { gap: 20, marginTop: 18 },
  complete: { textAlign: 'center', lineHeight: 24, paddingHorizontal: 20 },
  extraTimer: { marginTop: 16 },
});
