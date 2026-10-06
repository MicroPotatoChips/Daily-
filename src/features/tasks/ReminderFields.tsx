import { StyleSheet, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Field, Text } from '@/components';
import { useTheme } from '@/theme';
import { ChoiceGroup } from './Pickers';
import type { Reminder } from '@/types';

export function ReminderFields({
  reminder,
  onChange,
  time,
  onTimeChange,
  hours,
  onHoursChange,
  notifications,
}: {
  reminder: Reminder;
  onChange: (reminder: Reminder) => void;
  time: string;
  onTimeChange: (value: string) => void;
  hours: string;
  onHoursChange: (value: string) => void;
  notifications: boolean;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <View style={styles.copy}>
          <Text variant="headline">{t('form.reminders')}</Text>
          <Text variant="caption" color={colors.textSecondary}>
            {t('form.reminderDescription')}
          </Text>
        </View>
        <Switch
          accessibilityLabel={t('form.reminders')}
          hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
          value={reminder.enabled}
          onValueChange={(enabled) => onChange({ ...reminder, enabled })}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor={colors.surface}
        />
      </View>
      {reminder.enabled && (
        <View style={styles.section}>
          <ChoiceGroup<'daily' | 'interval'>
            options={[
              { value: 'daily', label: t('form.daily') },
              { value: 'interval', label: t('form.interval') },
            ]}
            value={reminder.mode}
            onChange={(mode) => onChange({ ...reminder, mode })}
          />
          {reminder.mode === 'daily' ? (
            <Field
              label={t('form.time')}
              value={time}
              onChangeText={onTimeChange}
              placeholder="18:00"
              keyboardType="numbers-and-punctuation"
            />
          ) : (
            <Field
              label={t('form.hours')}
              value={hours}
              onChangeText={onHoursChange}
              keyboardType="number-pad"
            />
          )}
          {!notifications && (
            <Text variant="caption" color={colors.textSecondary}>
              {t('form.notificationHint')}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 16 },
  heading: { flexDirection: 'row', alignItems: 'center', minHeight: 48, gap: 12 },
  copy: { flex: 1, gap: 6 },
});
