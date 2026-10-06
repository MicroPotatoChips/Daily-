import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Text } from '@/components';
import { useTheme } from '@/theme';

export function PageHeader({
  title,
  subtitle,
  onBack,
  right,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      {onBack && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={onBack}
          style={[styles.back, { backgroundColor: colors.surface }]}
        >
          <ArrowLeft size={22} color={colors.textPrimary} />
        </Pressable>
      )}
      <View style={styles.heading}>
        <View style={styles.row}>
          <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {right}
        </View>
        {!!subtitle && (
          <Text color={colors.textSecondary} style={styles.subtitle}>
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 24, gap: 20 },
  heading: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1 },
  subtitle: { lineHeight: 24 },
  back: {
    minWidth: 48,
    minHeight: 48,
    alignSelf: 'flex-start',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
});
