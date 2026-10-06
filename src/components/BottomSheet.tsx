import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '@/theme';
import { motion } from '@/theme/motion';

const sheetEntrance = FadeInDown.duration(motion.enter.duration)
  .easing(motion.enter.easing)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 12 }] })
  .reduceMotion(motion.enter.reduceMotion);

export function BottomSheet({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <Animated.View
      entering={sheetEntrance}
      style={[styles.sheet, { backgroundColor: colors.surface }]}
    >
      <View style={[styles.handle, { backgroundColor: colors.border }]} />
      {children}
    </Animated.View>
  );
}
const styles = StyleSheet.create({
  sheet: { borderRadius: 32, padding: 24, gap: 24 },
  handle: { width: 38, height: 4, borderRadius: 4, alignSelf: 'center', marginBottom: 8 },
});
