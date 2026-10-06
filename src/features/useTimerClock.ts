import { useCallback, useState } from 'react';
import { AppState, type NativeEventSubscription } from 'react-native';
import { useFocusEffect } from 'expo-router';

// All visible running timers share one repaint clock. SQLite timestamps remain authoritative.
const listeners = new Set<(now: number) => void>();
let interval: ReturnType<typeof setInterval> | undefined;
let appStateSubscription: NativeEventSubscription | undefined;

function publish() {
  const now = Date.now();
  listeners.forEach((listener) => listener(now));
}

function updateClock() {
  if (interval) clearInterval(interval);
  interval = undefined;
  publish();
  if (
    listeners.size > 0 &&
    AppState.currentState !== 'background' &&
    AppState.currentState !== 'inactive'
  ) {
    interval = setInterval(publish, 1000);
  }
}

function subscribe(listener: (now: number) => void) {
  listeners.add(listener);
  listener(Date.now());
  if (listeners.size === 1) {
    appStateSubscription = AppState.addEventListener('change', updateClock);
    updateClock();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (interval) clearInterval(interval);
      interval = undefined;
      appStateSubscription?.remove();
      appStateSubscription = undefined;
    }
  };
}

export function useTimerClock(running: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useFocusEffect(useCallback(() => (running ? subscribe(setNow) : undefined), [running]));
  return now;
}
