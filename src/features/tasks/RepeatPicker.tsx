import { Pressable, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components';
import { useTheme } from '@/theme';

export function RepeatPicker({
  value,
  onChange,
  weekStartsOn,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  weekStartsOn: 0 | 1;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const days = weekStartsOn === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6];
  return (
    <View style={styles.section}>
      <View style={styles.heading}>
        <Text variant="headline">{t('form.repeat')}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => onChange([0, 1, 2, 3, 4, 5, 6])}
          style={styles.everyDay}
        >
          <Text variant="caption" color={colors.primary}>
            {t('common.everyDay')}
          </Text>
        </Pressable>
      </View>
      <View style={styles.week}>
        {days.map((day) => (
          <Pressable
            key={day}
            accessibilityRole="button"
            accessibilityLabel={t(`form.fullDays.${day}`)}
            accessibilityState={{ selected: value.includes(day) }}
            onPress={() =>
              onChange(value.includes(day) ? value.filter((item) => item !== day) : [...value, day])
            }
            style={[
              styles.day,
              { backgroundColor: value.includes(day) ? colors.primarySoft : colors.surfaceAlt },
            ]}
          >
            <Text
              variant="caption"
              color={value.includes(day) ? colors.primary : colors.textSecondary}
            >
              {t(`form.days.${day}`)}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  heading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  everyDay: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  week: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  day: {
    minWidth: 44,
    minHeight: 44,
    paddingHorizontal: 8,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
