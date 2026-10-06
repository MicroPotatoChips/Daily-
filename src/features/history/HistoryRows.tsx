import { StyleSheet, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Icon, Text } from '@/components';
import { useTheme } from '@/theme';
import type { HabitRecord, Task } from '@/types';

export function HabitSummaryRow({
  task,
  value,
  goal,
}: {
  task: Task;
  value: number;
  goal: number;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const unit = t(`units.${task.unit}`, { defaultValue: task.unit });
  return (
    <View style={styles.summaryRow}>
      <View style={[styles.icon, { backgroundColor: `${task.color}18` }]}>
        <Icon name={task.icon} color={task.color} size={20} />
      </View>
      <View style={styles.copy}>
        <Text variant="body" style={styles.name}>
          {task.name}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          {Number(value.toFixed(1))} / {goal} {unit}
        </Text>
      </View>
      {value >= goal && (
        <View accessibilityLabel={t('task.completed')}>
          <Check color={colors.primary} size={21} />
        </View>
      )}
    </View>
  );
}

export function TimelineRow({ record, task }: { record: HabitRecord; task?: Task }) {
  const { t, i18n } = useTranslation();
  const { colors } = useTheme();
  const time = new Date(record.timestamp).toLocaleTimeString(
    i18n.language.startsWith('zh') ? 'zh-CN' : 'en-US',
    { hour: '2-digit', minute: '2-digit', hour12: false },
  );
  const value = `${record.value > 0 ? '+' : ''}${Number(record.value.toFixed(1))}`;
  const unit = task
    ? t(`units.${task.unit}`, { defaultValue: task.unit })
    : t(record.type === 'timer' ? 'common.min' : 'common.count');
  return (
    <View
      accessible
      accessibilityLabel={t('history.entry', {
        name: task?.name ?? t('task.archived'),
        value,
        unit,
        time,
      })}
      style={styles.timelineRow}
    >
      <View style={styles.track}>
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <View
          style={[
            styles.point,
            { backgroundColor: task?.color ?? colors.primary, borderColor: colors.background },
          ]}
        />
      </View>
      <View style={styles.copy}>
        <Text variant="body" style={styles.name}>
          {task?.name ?? t('task.archived')}
        </Text>
        <Text variant="caption" color={colors.textSecondary}>
          {time}
          {record.value < 0 ? ` · ${t('history.corrected')}` : ''}
        </Text>
      </View>
      <Text
        color={record.value < 0 ? colors.textSecondary : colors.textPrimary}
        style={styles.value}
      >
        {value}{' '}
        <Text variant="caption" color={colors.textSecondary}>
          {unit}
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  icon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 4 },
  name: { fontWeight: '500' },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 78 },
  track: { width: 18, alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  line: { width: 1, height: '100%', position: 'absolute' },
  point: { width: 12, height: 12, borderRadius: 6, borderWidth: 3 },
  value: {
    fontWeight: '500',
    flexShrink: 1,
    maxWidth: '42%',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});
