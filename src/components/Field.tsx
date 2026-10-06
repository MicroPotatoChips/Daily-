import { View, TextInput, StyleSheet, type KeyboardTypeOptions } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
export function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  keyboardType?: KeyboardTypeOptions;
  placeholder?: string;
  maxLength?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <Text variant="caption" color={colors.textSecondary}>
        {label}
      </Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        placeholder={placeholder}
        maxLength={maxLength}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.primary}
        style={[styles.input, { backgroundColor: colors.surfaceAlt, color: colors.textPrimary }]}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: 8 },
  input: { minHeight: 54, borderRadius: 16, paddingHorizontal: 16, fontSize: 16 },
});
