import { useCallback, useEffect, useState } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { AppState, ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { initializeDatabase, getExternalDataVersion } from '@/database/db';
import { useTaskStore } from '@/store/taskStore';
import { useRecordStore } from '@/store/recordStore';
import { useTimerStore } from '@/store/timerStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from '@/theme';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Text } from '@/components/Text';
import { Button } from '@/components/Button';
import { syncWidgets, widgetsAvailable } from '@/services/widgets';
import { syncAllReminders, notificationsAvailable } from '@/services/notifications';
import { applyLanguage } from '@/locales';
import { useLocalDay } from '@/features/useLocalDay';
import { BrandArt } from '@/components/BrandArt';
import { useReducedMotion } from '@/features/useReducedMotion';

// Hold the native logo until durable settings and SQLite are ready. No artificial delay.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <AppRoot />
    </ErrorBoundary>
  );
}

function AppRoot() {
  const { colors, dark } = useTheme();
  const reducedMotion = useReducedMotion();
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const segments = useSegments();
  const settings = useSettingsStore((s) => s.settings);
  const tasks = useTaskStore((s) => s.tasks);
  const revisions = useTaskStore((s) => s.revisions);
  const records = useRecordStore((s) => s.records);
  const sessions = useTimerStore((s) => s.sessions);
  const day = useLocalDay();
  useEffect(() => {
    if (ready || failed) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready, failed]);
  const refresh = useCallback(async () => {
    await Promise.all([
      useTaskStore.getState().load(),
      useRecordStore.getState().load(),
      useTimerStore.getState().load(),
    ]);
  }, []);
  const loadApp = useCallback(async () => {
    await initializeDatabase();
    await useSettingsStore.getState().load();
    await refresh();
  }, [refresh]);
  const initialize = useCallback(async () => {
    setFailed(false);
    try {
      await loadApp();
      setReady(true);
    } catch (error) {
      if (__DEV__) console.error(error);
      setFailed(true);
    }
  }, [loadApp]);
  useEffect(() => {
    void loadApp()
      .then(() => setReady(true))
      .catch((error: unknown) => {
        if (__DEV__) console.error(error);
        setFailed(true);
      });
  }, [loadApp]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && ready) {
        void refresh().catch((e: unknown) => {
          if (__DEV__) console.error(e);
        });
        void applyLanguage(useSettingsStore.getState().settings.language);
      }
    });
    return () => sub.remove();
  }, [ready, refresh]);
  useEffect(() => {
    if (!ready || !widgetsAvailable) return;
    let stopped = false;
    let checking = false;
    let lastVersion: number | undefined;
    const check = async () => {
      if (stopped || checking || AppState.currentState !== 'active') return;
      checking = true;
      try {
        const version = await getExternalDataVersion();
        if (!stopped && version !== lastVersion) {
          await refresh();
          lastVersion = version;
        }
      } catch (error) {
        if (__DEV__) console.error(error);
      } finally {
        checking = false;
      }
    };
    // One cheap PRAGMA while visible also handles tablet split-screen widget actions.
    void check();
    const interval = setInterval(() => {
      void check();
    }, 3000);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [ready, refresh]);
  useEffect(() => {
    if (ready && !settings.onboarded && segments[0] !== 'onboarding') router.replace('/onboarding');
  }, [ready, settings.onboarded, segments]);
  useEffect(() => {
    if (ready)
      void syncWidgets(tasks, records, revisions, settings, sessions).catch((e: unknown) => {
        if (__DEV__) console.error(e);
      });
  }, [ready, tasks, records, revisions, settings, day, sessions]);
  useEffect(() => {
    if (ready)
      void syncAllReminders(tasks, settings.notifications).catch((e: unknown) => {
        if (__DEV__) console.error(e);
      });
  }, [ready, tasks, settings.notifications, settings.language]);
  useEffect(() => {
    if (!ready || !settings.onboarded || !notificationsAvailable) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const id: unknown = response?.notification.request.content.data?.taskId;
      if (typeof id === 'string' && useTaskStore.getState().tasks.some((task) => task.id === id)) {
        router.push({ pathname: '/task/[id]', params: { id } });
        void Notifications.clearLastNotificationResponseAsync();
      }
    };
    void Notifications.getLastNotificationResponseAsync()
      .then(open)
      .catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [ready, settings.onboarded]);
  return (
    <SafeAreaProvider>
      <StatusBar style={dark ? 'light' : 'dark'} />
      {!ready ? (
        <View
          style={{
            flex: 1,
            backgroundColor: colors.background,
            justifyContent: 'center',
            padding: 32,
            gap: 20,
          }}
        >
          {failed ? (
            <>
              <Text variant="title">{t('error.title')}</Text>
              <Text>{t('error.database')}</Text>
              <Button title={t('common.retry')} onPress={initialize} />
            </>
          ) : (
            <>
              <BrandArt width={150} height={150} />
              <Text variant="largeTitle" style={{ textAlign: 'center' }}>
                Daily+
              </Text>
              <ActivityIndicator size="small" color={colors.primary} />
            </>
          )}
        </View>
      ) : (
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: colors.background },
            animation: reducedMotion ? 'none' : 'fade_from_bottom',
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="task/[id]" />
          <Stack.Screen name="settings/index" />
          <Stack.Screen name="onboarding" options={{ gestureEnabled: false }} />
          <Stack.Screen
            name="create-task"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [1],
              sheetGrabberVisible: true,
              contentStyle: { backgroundColor: colors.background },
            }}
          />
        </Stack>
      )}
    </SafeAreaProvider>
  );
}
