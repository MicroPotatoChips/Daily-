import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EmptyState, Heatmap, Screen, Text } from '@/components';
import { useTheme } from '@/theme';
import { useTaskStore } from '@/store/taskStore';
import { useRecordStore } from '@/store/recordStore';
import { dateFromKey, recentDateKeys } from '@/utils/date';
import {
  getDailySummary,
  getTaskGoal,
  isTaskScheduled,
  indexedValue,
  indexRecordTotals,
} from '@/utils/progress';
import { useLocalDay } from '@/features/useLocalDay';
import { PageHeader } from '@/features/PageHeader';
import { HabitSummaryRow, TimelineRow } from '@/features/history/HistoryRows';
import type { HabitRecord } from '@/types';

type TimelineItem =
  { kind: 'day'; key: string; date: string } | { kind: 'record'; key: string; record: HabitRecord };

export default function HistoryScreen() {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const day = useLocalDay();
  const [selection, setSelectedDate] = useState<string | null>(null);
  const selectedDate = selection ?? day;
  const tasks = useTaskStore((state) => state.tasks);
  const revisions = useTaskStore((state) => state.revisions);
  const records = useRecordStore((state) => state.records);
  const locale = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';
  const totals = useMemo(() => indexRecordTotals(records), [records]);
  const summaries = useMemo(
    () =>
      recentDateKeys(30, day).map((date) =>
        getDailySummary(tasks, records, date, revisions, totals),
      ),
    [tasks, records, day, revisions, totals],
  );
  const selectedSummary = useMemo(
    () => getDailySummary(tasks, records, selectedDate, revisions, totals),
    [tasks, records, selectedDate, revisions, totals],
  );
  const selectedTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          isTaskScheduled(task, selectedDate, revisions) ||
          indexedValue(totals, task.id, selectedDate) !== 0,
      ),
    [tasks, selectedDate, revisions, totals],
  );
  const taskMap = useMemo(() => new Map(tasks.map((task) => [task.id, task])), [tasks]);
  const timeline = useMemo(() => {
    const items: TimelineItem[] = [];
    let date = '';
    [...records]
      .sort((a, b) => b.date.localeCompare(a.date) || b.timestamp - a.timestamp)
      .forEach((record) => {
        if (record.date !== date) {
          date = record.date;
          items.push({ kind: 'day', date, key: `day-${date}` });
        }
        items.push({ kind: 'record', record, key: record.id });
      });
    return items;
  }, [records]);
  const header = (
    <View>
      <PageHeader title={t('history.title')} subtitle={t('history.subtitle')} />
      <View style={[styles.activity, { backgroundColor: colors.surface }]}>
        <View style={styles.activityHeading}>
          <Text variant="headline">{t('history.activity')}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {dateFromKey(day).toLocaleDateString(locale, { month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <Heatmap summaries={summaries} onSelect={setSelectedDate} selectedDate={selectedDate} />
        <Text variant="caption" color={colors.textSecondary}>
          {t('history.selectDate')}
        </Text>
      </View>
      <View style={styles.selected}>
        <Text variant="title">
          {selectedDate === day
            ? t('common.today')
            : dateFromKey(selectedDate).toLocaleDateString(locale, {
                month: 'long',
                day: 'numeric',
              })}
        </Text>
        <Text color={colors.textSecondary}>
          {selectedSummary.totalTasks
            ? t('history.summary', {
                done: selectedSummary.completedTasks,
                total: selectedSummary.totalTasks,
              })
            : t('history.noScheduled')}
        </Text>
        {selectedTasks.length > 0 && (
          <View style={[styles.habits, { backgroundColor: colors.surface }]}>
            {selectedTasks.map((task) => (
              <HabitSummaryRow
                key={task.id}
                task={task}
                value={indexedValue(totals, task.id, selectedDate)}
                goal={getTaskGoal(task, selectedDate, revisions)}
              />
            ))}
          </View>
        )}
      </View>
      <View style={styles.timelineHeading}>
        <Text variant="headline">{t('history.timeline')}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {records.length.toString().padStart(2, '0')}
        </Text>
      </View>
    </View>
  );
  return (
    <Screen scroll={false}>
      <FlatList
        data={timeline}
        keyExtractor={(item) => item.key}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <EmptyState
            title={t('history.emptyTitle')}
            message={t('history.emptyMessage')}
            illustration="celebrate"
          />
        }
        renderItem={({ item }) =>
          item.kind === 'day' ? (
            <Text variant="caption" color={colors.textSecondary} style={styles.dayHeading}>
              {item.date === day
                ? t('common.today')
                : dateFromKey(item.date).toLocaleDateString(locale, {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
            </Text>
          ) : (
            <TimelineRow record={item.record} task={taskMap.get(item.record.taskId)} />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { paddingBottom: 24 },
  activity: { padding: 22, borderRadius: 32, gap: 18 },
  activityHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  selected: { marginTop: 32, gap: 8 },
  habits: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 26, marginTop: 12 },
  timelineHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 34,
    marginBottom: 8,
  },
  dayHeading: { marginTop: 20, marginBottom: 8, fontWeight: '600' },
});
