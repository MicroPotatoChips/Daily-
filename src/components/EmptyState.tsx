import { View, StyleSheet } from 'react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { Button } from './Button';
import { BrandArt, type ArtKind } from './BrandArt';
export function EmptyState({
  title,
  message,
  action,
  onAction,
  illustration = 'growth',
}: {
  title: string;
  message: string;
  action?: string;
  onAction?: () => void;
  illustration?: ArtKind;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.box, { backgroundColor: colors.surface }]}>
      <BrandArt kind={illustration} height={150} />
      <Text variant="title" style={styles.center}>
        {title}
      </Text>
      <Text color={colors.textSecondary} style={styles.center}>
        {message}
      </Text>
      {action && onAction ? <Button title={action} onPress={onAction} /> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  box: { padding: 28, borderRadius: 28, gap: 16 },
  center: { textAlign: 'center' },
});
