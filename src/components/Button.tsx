import { useEffect } from 'react';
import {
  Pressable,
  ActivityIndicator,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme';
import type { IconName } from '@/types';
import { Icon } from './Icon';
import { Text } from './Text';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { motion } from '@/theme/motion';
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
type Props = {
  title: string;
  accessibilityLabel?: string;
  onPress: () => void | Promise<unknown>;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  icon?: IconName | LucideIcon;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};
export function Button({
  title,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  icon,
  disabled,
  loading,
  style,
}: Props) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const inactive = Boolean(disabled || loading);
  useEffect(() => {
    // Async actions can disable a pressed control before its release event arrives.
    if (inactive) scale.set(withSpring(1, motion.release));
  }, [inactive, scale]);
  const foreground =
    variant === 'primary' ? colors.white : variant === 'danger' ? colors.danger : colors.primary;
  const background =
    variant === 'primary'
      ? colors.primary
      : variant === 'ghost'
        ? 'transparent'
        : colors.primarySoft;
  const Component = typeof icon === 'string' ? null : icon;
  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: inactive, busy: Boolean(loading) }}
      disabled={inactive}
      onPressIn={() => {
        scale.set(withTiming(0.98, motion.press));
      }}
      onPressOut={() => {
        scale.set(withSpring(1, motion.release));
      }}
      onPress={() => {
        void onPress();
      }}
      style={[
        styles.button,
        { backgroundColor: background, opacity: disabled ? 0.4 : 1 },
        style,
        animatedStyle,
      ]}
    >
      <View style={styles.inner}>
        {loading ? (
          <ActivityIndicator color={foreground} />
        ) : icon ? (
          typeof icon === 'string' ? (
            <Icon name={icon} size={20} color={foreground} />
          ) : Component ? (
            <Component size={20} color={foreground} />
          ) : null
        ) : null}
        <Text style={{ fontWeight: '600' }} color={foreground}>
          {title}
        </Text>
      </View>
    </AnimatedPressable>
  );
}
const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  inner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
