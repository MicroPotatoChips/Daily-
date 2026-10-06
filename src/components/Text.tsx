import { Text as NativeText, type TextProps, type TextStyle } from 'react-native';
import { typography, useTheme } from '@/theme';
type Props = TextProps & { variant?: keyof typeof typography; color?: TextStyle['color'] };
export function Text({ variant = 'body', color, style, ...props }: Props) {
  const { colors } = useTheme();
  return (
    <NativeText
      {...props}
      style={[typography[variant], { color: color ?? colors.textPrimary }, style]}
    />
  );
}
