import { useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Play, Pause, Check } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { TimerSession } from '@/types';
import { elapsedMilliseconds, formatTimerClock, timerPrimaryAction } from '@/utils/timer';
import { useTimerClock } from '@/features/useTimerClock';
import { useTheme } from '@/theme';
import { Button } from './Button';
import { Text } from './Text';
import Animated, { LinearTransition, ReduceMotion } from 'react-native-reanimated';
const timerLayout = LinearTransition.duration(220).reduceMotion(ReduceMotion.System);

export function Timer({
  session,
  onStart,
  onPause,
  onResume,
  onFinish,
}: {
  session?: TimerSession;
  onStart: () => void | Promise<unknown>;
  onPause: () => void | Promise<unknown>;
  onResume: () => void | Promise<unknown>;
  onFinish: () => void | Promise<unknown>;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const now = useTimerClock(session?.status === 'running');
  const [busy, setBusy] = useState(false);
  const actionLock = useRef(false);
  const active = session && session.status !== 'finished';
  const running = active && session.status === 'running';
  const clock = formatTimerClock(active ? elapsedMilliseconds(session, now) : 0);
  const primaryAction = timerPrimaryAction(session);
  const action = async (fn: () => void | Promise<unknown>) => {
    if (actionLock.current) return;
    actionLock.current = true;
    setBusy(true);
    try {
      await fn();
    } finally {
      actionLock.current = false;
      setBusy(false);
    }
  };
  return (
    <View style={[styles.box, { backgroundColor: colors.surface }]}>
      <Text variant="caption" color={colors.textSecondary} style={styles.center}>
        {t(active ? (running ? 'home.activeTimer' : 'home.pausedTimer') : 'timer.ready')}
      </Text>
      <Text style={styles.clock}>{clock}</Text>
      <Animated.View layout={timerLayout} style={styles.buttons}>
        <Button
          style={styles.button}
          title={t(`timer.${primaryAction}`)}
          icon={running ? Pause : Play}
          loading={busy}
          onPress={() =>
            action(
              primaryAction === 'pause' ? onPause : primaryAction === 'resume' ? onResume : onStart,
            )
          }
        />
        {active ? (
          <Button
            style={styles.button}
            title={t('timer.finish')}
            icon={Check}
            variant="secondary"
            disabled={busy}
            onPress={() => action(onFinish)}
          />
        ) : null}
      </Animated.View>
      <Text variant="caption" color={colors.textSecondary} style={styles.center}>
        {t(active && !running ? 'home.pausedTimer' : 'timer.backgroundHint')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { padding: 24, borderRadius: 28, gap: 16 },
  center: { textAlign: 'center' },
  clock: {
    fontSize: 40,
    lineHeight: 52,
    fontWeight: '500',
    letterSpacing: 1,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  buttons: { flexDirection: 'row', gap: 12 },
  button: { flex: 1 },
});
