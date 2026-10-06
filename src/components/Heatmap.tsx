import { memo } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { DailySummary } from '@/types';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/store/settingsStore';
import { dateFromKey } from '@/utils/date';
import { Text } from './Text';
export const Heatmap = memo(function Heatmap({
  summaries,
  onSelect,
  selectedDate,
}: {
  summaries: DailySummary[];
  onSelect: (date: string) => void;
  selectedDate?: string;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const weekStartsOn = useSettingsStore((state) => state.settings.weekStartsOn);
  const first = summaries[0];
  const offset = first ? (dateFromKey(first.date).getDay() - weekStartsOn + 7) % 7 : 0;
  return (
    <View style={styles.container}>
      <View style={styles.grid}>
        {Array.from({ length: 7 }, (_, index) => (
          <Text key={index} variant="caption" color={colors.textSecondary} style={styles.weekday}>
            {t(`form.days.${(index + weekStartsOn) % 7}`)}
          </Text>
        ))}
      </View>
      <View style={styles.grid}>
        {Array.from({ length: offset }, (_, index) => (
          <View
            key={`padding-${index}`}
            style={styles.cell}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
        ))}
        {summaries.map((day) => (
          <Pressable
            key={day.date}
            accessibilityRole="button"
            accessibilityLabel={`${day.date}, ${Math.round(day.completionRate * 100)}%`}
            accessibilityState={{ selected: selectedDate === day.date }}
            onPress={() => onSelect(day.date)}
            style={styles.cell}
          >
            <View
              style={[
                styles.dot,
                {
                  backgroundColor: colors.surfaceAlt,
                  borderColor: selectedDate === day.date ? colors.textPrimary : 'transparent',
                  borderWidth: 2,
                },
              ]}
            >
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: colors.primary,
                    opacity: day.completionRate === 0 ? 0 : Math.ceil(day.completionRate * 4) / 4,
                  },
                ]}
              />
            </View>
          </Pressable>
        ))}
      </View>
      <View style={styles.legend}>
        <Text variant="caption" color={colors.textSecondary}>
          {t('history.less')}
        </Text>
        {[0, 0.25, 0.5, 0.75, 1].map((n) => (
          <View key={n} style={[styles.swatch, { backgroundColor: colors.surfaceAlt }]}>
            <View style={[styles.fill, { backgroundColor: colors.primary, opacity: n }]} />
          </View>
        ))}
        <Text variant="caption" color={colors.textSecondary}>
          {t('history.more')}
        </Text>
      </View>
    </View>
  );
});
const styles = StyleSheet.create({
  container: { gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center' },
  cell: { width: `${100 / 7}%`, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 29, height: 29, borderRadius: 8, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderRadius: 5 },
  legend: { flexDirection: 'row', gap: 6, justifyContent: 'flex-end', alignItems: 'center' },
  swatch: { width: 13, height: 13, borderRadius: 4, overflow: 'hidden' },
});
