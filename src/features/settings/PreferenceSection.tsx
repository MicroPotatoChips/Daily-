import type { ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { Text } from '@/components';
import { useTheme } from '@/theme';

export function PreferenceSection({ title, children }: { title: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: colors.surface }]}>
      <Text variant="headline">{title}</Text>
      {children}
    </View>
  );
}

export function TogglePreference({
  title,
  message,
  value,
  onChange,
  disabled,
}: {
  title: string;
  message: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.toggle}>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text variant="caption" color={colors.textSecondary}>
          {message}
        </Text>
      </View>
      <Switch
        accessibilityLabel={title}
        hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
        accessibilityState={{ disabled }}
        value={value}
        disabled={disabled}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { padding: 22, borderRadius: 28, gap: 18 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 54 },
  copy: { flex: 1, gap: 6 },
  title: { fontWeight: '500' },
});
