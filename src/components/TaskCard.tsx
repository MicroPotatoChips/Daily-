import { memo, useEffect, useRef } from 'react';
import { Pressable, View, StyleSheet } from 'react-native';
import { Plus, Play, Pause, Check } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withSequence,
  withSpring,
  LinearTransition,
  FadeIn,
  ReduceMotion,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import type { Task, TimerSession } from '@/types';
import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { Text } from './Text';
import { Button } from './Button';
import { motion } from '@/theme/motion';
import { useTimerClock } from '@/features/useTimerClock';
import { elapsedMilliseconds, formatTimerClock, timerPrimaryAction } from '@/utils/timer';

const cardLayout = LinearTransition.duration(240).reduceMotion(ReduceMotion.System);
const timerEnter = FadeIn.duration(180).reduceMotion(ReduceMotion.System);

export const TaskCard = memo(function TaskCard({
  task,
  value,
  session,
  onPress,
  onQuickAdd,
  onFinish,
  busy,
}: {
  task: Task;
  value: number;
  session?: TimerSession;
  onPress: () => void;
  onQuickAdd: () => void | Promise<unknown>;
  onFinish?: () => void | Promise<unknown>;
  busy?: boolean;
}) {
  const { colors, dark } = useTheme();
  const { t } = useTranslation();
  const progress = useSharedValue(Math.min(1, Math.max(0, value / task.goal)));
  const scale = useSharedValue(1);
  const complete = value >= task.goal;
  const wasComplete = useRef(complete);
  const completionScale = useSharedValue(1);
  const active = task.trackingType === 'timer' && session && session.status !== 'finished';
  const running = Boolean(active && session.status === 'running');
  const now = useTimerClock(running);
  const clock = active ? formatTimerClock(elapsedMilliseconds(session, now)) : '';
  const primaryAction = timerPrimaryAction(session);
  const actionLabel = t(task.trackingType === 'count' ? 'task.quickAdd' : `timer.${primaryAction}`);
  const timerStatus = t(running ? 'home.activeTimer' : 'home.pausedTimer');

  useEffect(() => {
    progress.value = withTiming(Math.min(1, Math.max(0, value / task.goal)), motion.progress);
    // Celebrate only a newly saved completion, never an attempted write or list mounting.
    if (complete && !wasComplete.current) {
      completionScale.value = withSequence(
        withTiming(1.08, motion.press),
        withSpring(1, motion.release),
      );
    }
    wasComplete.current = complete;
  }, [value, task.goal, progress, complete, completionScale]);
  useEffect(() => {
    if (busy) scale.value = withSpring(1, motion.release);
  }, [busy, scale]);
  const barStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.value }] }));
  const animation = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value * completionScale.value }],
  }));
  const unit = t(`units.${task.unit}`, { defaultValue: task.unit });
  const accent = dark ? colors.primary : task.color;
  return (
    <Animated.View layout={cardLayout} style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${task.name}, ${value.toFixed(1)} / ${task.goal} ${unit}`}
          onPress={onPress}
          style={styles.main}
        >
          <View
            style={[styles.icon, { backgroundColor: dark ? colors.surfaceAlt : `${task.color}14` }]}
          >
            <Icon name={task.icon} color={accent} size={25} />
          </View>
          <View style={styles.content}>
            <Text variant="headline">{task.name}</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {complete
                ? t('task.completed')
                : `${Math.round(value * 10) / 10} / ${task.goal} ${unit}`}
            </Text>
            <View style={[styles.track, { backgroundColor: colors.surfaceAlt }]}>
              <Animated.View style={[styles.bar, { backgroundColor: accent }, barStyle]} />
            </View>
          </View>
        </Pressable>
        <Animated.View style={animation}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${task.name}: ${actionLabel}`}
            accessibilityState={{ disabled: Boolean(busy), busy: Boolean(busy) }}
            disabled={busy}
            onPress={() => {
              void onQuickAdd();
            }}
            onPressIn={() => {
              scale.value = withTiming(0.96, motion.press);
            }}
            onPressOut={() => {
              scale.value = withSpring(1, motion.release);
            }}
            style={[
              styles.quick,
              {
                backgroundColor: complete || active ? colors.primarySoft : colors.surfaceAlt,
                opacity: busy ? 0.4 : 1,
              },
            ]}
          >
            {task.trackingType === 'timer' ? (
              running ? (
                <Pause color={accent} size={20} />
              ) : (
                <Play color={accent} size={20} />
              )
            ) : complete ? (
              <Check color={accent} size={21} />
            ) : (
              <Plus color={accent} size={22} />
            )}
          </Pressable>
        </Animated.View>
      </View>
      {active && (
        <Animated.View
          entering={timerEnter}
          style={[styles.timerRow, { borderTopColor: colors.surfaceAlt }]}
        >
          <View style={styles.timerReadout}>
            <Text variant="caption" color={running ? accent : colors.textSecondary}>
              {timerStatus}
            </Text>
            <Text style={styles.clock}>{clock}</Text>
          </View>
          {onFinish && (
            <Button
              title={t('timer.finish')}
              accessibilityLabel={`${task.name}: ${t('timer.finish')}`}
              icon={Check}
              variant="secondary"
              disabled={busy}
              onPress={onFinish}
              style={styles.finish}
            />
          )}
        </Animated.View>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  card: { borderRadius: 24, padding: 16, gap: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 64 },
  icon: { width: 48, height: 48, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, gap: 3 },
  track: { height: 4, borderRadius: 3, marginTop: 7, overflow: 'hidden' },
  bar: { height: 4, width: '100%', borderRadius: 3, transformOrigin: 'left' },
  quick: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  timerReadout: { flex: 1, gap: 2 },
  clock: { fontSize: 20, lineHeight: 26, fontWeight: '500', fontVariant: ['tabular-nums'] },
  finish: { minHeight: 44, paddingVertical: 10, paddingHorizontal: 14 },
});
