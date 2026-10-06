import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { Plus, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button, Field, Text } from '@/components';
import { useTheme } from '@/theme';
import { useTaskStore } from '@/store/taskStore';
import { useRecordStore } from '@/store/recordStore';
import { useTimerStore } from '@/store/timerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { syncTaskReminder } from '@/services/notifications';
import { useActions } from '@/features/useActions';
import { useBack } from '@/features/useBack';
import { PageHeader } from '@/features/PageHeader';
import { ColorPicker, ChoiceGroup, IconPicker } from './Pickers';
import { ReminderFields } from './ReminderFields';
import { RepeatPicker } from './RepeatPicker';
import { taskColors } from './templates';
import type { IconName, Reminder, Task, TaskInput, TrackingType } from '@/types';
import { MAX_HABIT_VALUE, MIN_HABIT_VALUE } from '@/utils/validation';

const defaultReminder: Reminder = {
  enabled: false,
  mode: 'daily',
  hour: 18,
  minute: 0,
  intervalHours: 2,
};

export function TaskForm({ task }: { task?: Task }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const goBack = useBack();
  const { run, busy } = useActions();
  const records = useRecordStore((state) => state.records);
  const sessions = useTimerStore((state) => state.sessions);
  const settings = useSettingsStore((state) => state.settings);
  const [name, setName] = useState(task?.name ?? '');
  const [icon, setIcon] = useState<IconName>(task?.icon ?? 'leaf');
  const [trackingType, setTrackingType] = useState<TrackingType>(task?.trackingType ?? 'count');
  const [goal, setGoal] = useState(String(task?.goal ?? 1));
  const [unit, setUnit] = useState(task?.unit ?? t('form.defaultUnit'));
  const [color, setColor] = useState<string>(task?.color ?? taskColors[0]);
  const [repeatDays, setRepeatDays] = useState(task?.repeatDays ?? [0, 1, 2, 3, 4, 5, 6]);
  const [reminder, setReminder] = useState<Reminder>(task?.reminder ?? defaultReminder);
  const [time, setTime] = useState(
    `${String(task?.reminder?.hour ?? 18).padStart(2, '0')}:${String(task?.reminder?.minute ?? 0).padStart(2, '0')}`,
  );
  const [hours, setHours] = useState(String(task?.reminder?.intervalHours ?? 2));
  const [error, setError] = useState<string | null>(null);
  const trackingLocked =
    !!task &&
    (records.some((record) => record.taskId === task.id) ||
      sessions.some((session) => session.taskId === task.id));
  const changeType = (type: TrackingType) => {
    setTrackingType(type);
    setUnit(type === 'timer' ? 'min' : t('form.defaultUnit'));
    setGoal(type === 'timer' ? '20' : '1');
  };
  const submit = async () => {
    const numericGoal = Number(goal);
    const numericHours = Number(hours);
    const parsedTime = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    const hour = Number(parsedTime?.[1]);
    const minute = Number(parsedTime?.[2]);
    let validation: string | undefined;
    if (!name.trim() || name.trim().length > 80) validation = 'error.invalidName';
    else if (
      !Number.isFinite(numericGoal) ||
      numericGoal < MIN_HABIT_VALUE ||
      numericGoal > MAX_HABIT_VALUE
    )
      validation = 'error.invalidGoal';
    else if (!unit.trim() || unit.trim().length > 24) validation = 'error.invalidUnit';
    else if (!repeatDays.length) validation = 'error.invalidRepeat';
    else if (
      reminder.enabled &&
      reminder.mode === 'daily' &&
      (!parsedTime || hour > 23 || minute > 59)
    )
      validation = 'error.invalidTime';
    else if (
      reminder.enabled &&
      reminder.mode === 'interval' &&
      (!Number.isInteger(numericHours) || numericHours < 1 || numericHours > 24)
    )
      validation = 'error.invalidInterval';
    if (validation) {
      setError(t(validation));
      return;
    }
    setError(null);
    const input: TaskInput = {
      name: name.trim(),
      icon,
      color,
      trackingType,
      goal: numericGoal,
      unit: trackingType === 'timer' ? 'min' : unit.trim(),
      repeatDays: [...repeatDays].sort((a, b) => a - b),
      reminder: reminder.enabled
        ? {
            ...reminder,
            hour: reminder.mode === 'daily' ? hour : 9,
            minute: reminder.mode === 'daily' ? minute : 0,
            intervalHours: reminder.mode === 'interval' ? numericHours : 2,
          }
        : null,
    };
    await run('save-task', async () => {
      let savedTask: Task | undefined;
      if (task) {
        await useTaskStore.getState().update(task.id, input);
        savedTask = useTaskStore.getState().tasks.find((item) => item.id === task.id);
      } else savedTask = await useTaskStore.getState().create(input);
      if (savedTask) {
        try {
          await syncTaskReminder(savedTask, settings.notifications);
        } catch {
          Alert.alert(t('error.title'), t('error.reminder'));
        }
      }
      goBack();
    });
  };
  return (
    <View style={styles.form}>
      <PageHeader
        title={t(task ? 'form.edit' : 'form.create')}
        subtitle={t('form.introduction')}
        onBack={goBack}
      />
      <Field
        label={t('form.name')}
        value={name}
        onChangeText={setName}
        placeholder={t('form.namePlaceholder')}
        maxLength={80}
      />
      <IconPicker value={icon} onChange={setIcon} color={color} />
      <View style={styles.section}>
        <Text variant="headline">{t('form.tracking')}</Text>
        <ChoiceGroup<TrackingType>
          options={[
            { value: 'count', label: t('common.count') },
            { value: 'timer', label: t('common.timer') },
          ]}
          value={trackingType}
          onChange={changeType}
          disabled={trackingLocked}
        />
        {trackingLocked && (
          <Text variant="caption" color={colors.textSecondary}>
            {t('form.trackingLocked')}
          </Text>
        )}
      </View>
      <View style={styles.goalRow}>
        <View style={styles.goal}>
          <Field
            label={t('form.goal')}
            value={goal}
            onChangeText={setGoal}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.goal}>
          {trackingType === 'timer' || trackingLocked ? (
            <View style={styles.unitSection}>
              <Text variant="caption" color={colors.textSecondary}>
                {t('form.unit')}
              </Text>
              <View style={[styles.lockedUnit, { backgroundColor: colors.surfaceAlt }]}>
                <Text>{t(`units.${unit}`, { defaultValue: unit })}</Text>
              </View>
            </View>
          ) : (
            <Field
              label={t('form.unit')}
              value={unit}
              onChangeText={setUnit}
              placeholder={t('form.unitPlaceholder')}
              maxLength={24}
            />
          )}
        </View>
      </View>
      <ColorPicker value={color} onChange={setColor} />
      <RepeatPicker
        value={repeatDays}
        onChange={setRepeatDays}
        weekStartsOn={settings.weekStartsOn}
      />
      <ReminderFields
        reminder={reminder}
        onChange={setReminder}
        time={time}
        onTimeChange={setTime}
        hours={hours}
        onHoursChange={setHours}
        notifications={settings.notifications}
      />
      {!!error && (
        <Text accessibilityRole="alert" color={colors.danger}>
          {error}
        </Text>
      )}
      <Button
        title={t(task ? 'form.saveButton' : 'form.createButton')}
        icon={task ? Check : Plus}
        loading={busy === 'save-task'}
        onPress={() => void submit()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: 28 },
  section: { gap: 12 },
  unitSection: { gap: 8 },
  goalRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  goal: { flexGrow: 1, flexBasis: '40%', minWidth: 95 },
  lockedUnit: { minHeight: 54, borderRadius: 16, justifyContent: 'center', paddingHorizontal: 16 },
});
