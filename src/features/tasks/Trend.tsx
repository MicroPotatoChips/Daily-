import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/store/settingsStore';
import { dateFromKey, getLocalDateKey, recentDateKeys } from '@/utils/date';
import { getTaskGoal, isTaskScheduled, indexedValue, indexRecordTotals } from '@/utils/progress';
import type { HabitRecord, Task, TaskRevision } from '@/types';

export function Trend({
  task,
  records,
  revisions,
  date,
}: {
  task: Task;
  records: HabitRecord[];
  revisions: TaskRevision[];
  date: string;
}) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const weekStartsOn = useSettingsStore((state) => state.settings.weekStartsOn);
  const [range, setRange] = useState<7 | 30>(7);
  const locale = i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US';
  const unit = t(`units.${task.unit}`, { defaultValue: task.unit });
  const totals = useMemo(() => indexRecordTotals(records), [records]);
  const days = useMemo(() => {
    const end = dateFromKey(date);
    let keys = recentDateKeys(30, date);
    if (range === 7) {
      const offset = (end.getDay() - weekStartsOn + 7) % 7;
      end.setDate(end.getDate() - offset + 6);
      keys = recentDateKeys(7, getLocalDateKey(end));
    }
    return keys.map((day) => ({
      date: day,
      value: indexedValue(totals, task.id, day),
      goal: getTaskGoal(task, day, revisions),
      scheduled: isTaskScheduled(task, day, revisions),
      future: day > date,
    }));
  }, [date, range, task, totals, revisions, weekStartsOn]);
  const hasActivity = days.some((day) => day.value > 0);
  return (
    <View style={[styles.box, { backgroundColor: colors.surface }]}>
      <Text variant="headline">{t('task.trend')}</Text>
      <View style={[styles.segment, { backgroundColor: colors.surfaceAlt }]}>
        {([7, 30] as const).map((count) => (
          <Pressable
            key={count}
            accessibilityRole="button"
            accessibilityState={{ selected: range === count }}
            onPress={() => setRange(count)}
            style={[styles.option, range === count && { backgroundColor: colors.surface }]}
          >
            <Text
              variant="caption"
              color={range === count ? colors.textPrimary : colors.textSecondary}
              style={styles.optionText}
            >
              {t(count === 7 ? 'task.thisWeek' : 'task.last30')}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={[styles.chart, range === 30 && { gap: 3 }]}>
        {days.map((day) => (
          <View
            key={day.date}
            style={styles.column}
            accessible
            accessibilityLabel={`${dateFromKey(day.date).toLocaleDateString(locale)}, ${Number(day.value.toFixed(1))} / ${day.goal} ${unit}`}
          >
            <View
              style={[
                styles.barTrack,
                { backgroundColor: colors.surfaceAlt, opacity: day.future ? 0.35 : 1 },
              ]}
            >
              <View
                style={[
                  styles.bar,
                  {
                    height: `${Math.min(100, (day.value / day.goal) * 100)}%`,
                    backgroundColor: task.color,
                    opacity: day.scheduled ? 1 : 0.45,
                  },
                ]}
              />
            </View>
          </View>
        ))}
      </View>
      <View style={styles.labels}>
        {range === 7 ? (
          days.map((day) => (
            <Text
              key={day.date}
              variant="caption"
              color={day.date === date ? colors.primary : colors.textSecondary}
              style={styles.day}
            >
              {dateFromKey(day.date).toLocaleDateString(locale, { weekday: 'narrow' })}
            </Text>
          ))
        ) : (
          <>
            <Text variant="caption" color={colors.textSecondary}>
              {days[0] &&
                dateFromKey(days[0].date).toLocaleDateString(locale, {
                  month: 'short',
                  day: 'numeric',
                })}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>
              {dateFromKey(date).toLocaleDateString(locale, { month: 'short', day: 'numeric' })}
            </Text>
          </>
        )}
      </View>
      <Text variant="caption" color={colors.textSecondary}>
        {t(hasActivity ? 'task.consistency' : 'task.noTrend')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { borderRadius: 28, padding: 22, gap: 20 },
  segment: { padding: 4, borderRadius: 16, flexDirection: 'row', gap: 4 },
  option: {
    flex: 1,
    minHeight: 44,
    padding: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { fontWeight: '600', textAlign: 'center' },
  chart: { flexDirection: 'row', gap: 5, height: 112 },
  column: { flex: 1, alignItems: 'center', gap: 10 },
  barTrack: {
    height: 112,
    width: '100%',
    borderRadius: 6,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bar: { width: '100%', borderRadius: 6, minHeight: 0 },
  labels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -12 },
  day: { flex: 1, textAlign: 'center', fontSize: 11, lineHeight: 16 },
});
