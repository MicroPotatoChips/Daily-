import { Alert, Linking, StyleSheet, View } from 'react-native';
import { RotateCcw, ShieldCheck } from 'lucide-react-native';
import Constants from 'expo-constants';
import { useTranslation } from 'react-i18next';
import { Button, Icon, Screen, Text } from '@/components';
import { useTheme } from '@/theme';
import { useTaskStore } from '@/store/taskStore';
import { useSettingsStore } from '@/store/settingsStore';
import {
  notificationsAvailable,
  setNotificationsEnabled,
  syncAllReminders,
} from '@/services/notifications';
import { useActions } from '@/features/useActions';
import { useBack } from '@/features/useBack';
import { PageHeader } from '@/features/PageHeader';
import { ChoiceGroup } from '@/features/tasks/Pickers';
import { PreferenceSection, TogglePreference } from '@/features/settings/PreferenceSection';
import type { Settings } from '@/types';
import { BrandArt } from '@/components/BrandArt';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const goBack = useBack();
  const settings = useSettingsStore((state) => state.settings);
  const tasks = useTaskStore((state) => state.tasks);
  const { run, busy } = useActions();
  const update = (input: Partial<Settings>) =>
    void run('settings', () => useSettingsStore.getState().update(input));
  const setNotifications = (enabled: boolean) =>
    void run('notifications', async () => {
      const granted = await setNotificationsEnabled(enabled);
      await useSettingsStore.getState().update({ notifications: enabled && granted });
      await syncAllReminders(useTaskStore.getState().tasks, enabled && granted);
      if (enabled && !granted)
        Alert.alert(t('settings.deniedTitle'), t('settings.deniedMessage'), [
          { text: t('common.cancel'), style: 'cancel' },
          {
            text: t('settings.openDevice'),
            onPress: () => void run('device-settings', () => Linking.openSettings()),
          },
        ]);
    });
  const archived = tasks.filter((task) => task.archived);
  return (
    <Screen>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} onBack={goBack} />
      <PreferenceSection title={t('settings.language')}>
        <ChoiceGroup<Settings['language']>
          value={settings.language}
          options={[
            { value: 'system', label: t('common.system') },
            { value: 'en', label: t('settings.english') },
            { value: 'zh-CN', label: t('settings.chinese') },
          ]}
          onChange={(language) => update({ language })}
          disabled={busy === 'settings'}
        />
      </PreferenceSection>
      <PreferenceSection title={t('settings.theme')}>
        <ChoiceGroup<Settings['theme']>
          value={settings.theme}
          options={[
            { value: 'system', label: t('common.system') },
            { value: 'light', label: t('settings.light') },
            { value: 'dark', label: t('settings.dark') },
          ]}
          onChange={(theme) => update({ theme })}
          disabled={busy === 'settings'}
        />
      </PreferenceSection>
      <PreferenceSection title={t('settings.preferences')}>
        <TogglePreference
          title={t('settings.haptics')}
          message={t('settings.hapticsHint')}
          value={settings.haptics}
          onChange={(haptics) => update({ haptics })}
          disabled={busy === 'settings'}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        <TogglePreference
          title={t('settings.notifications')}
          message={t(
            notificationsAvailable
              ? 'settings.notificationsHint'
              : 'settings.notificationsUnavailable',
          )}
          value={settings.notifications}
          onChange={setNotifications}
          disabled={busy === 'notifications' || !notificationsAvailable}
        />
      </PreferenceSection>
      <PreferenceSection title={t('settings.week')}>
        <ChoiceGroup<0 | 1>
          value={settings.weekStartsOn}
          options={[
            { value: 1, label: t('settings.monday') },
            { value: 0, label: t('settings.sunday') },
          ]}
          onChange={(weekStartsOn) => update({ weekStartsOn })}
          disabled={busy === 'settings'}
        />
      </PreferenceSection>
      <PreferenceSection title={t('settings.archive')}>
        {archived.length ? (
          archived.map((task) => (
            <View key={task.id} style={styles.archiveRow}>
              <View style={[styles.archiveIcon, { backgroundColor: `${task.color}18` }]}>
                <Icon name={task.icon} color={task.color} size={22} />
              </View>
              <Text style={styles.archiveName}>{task.name}</Text>
              <Button
                title={t('settings.restore')}
                icon={RotateCcw}
                variant="ghost"
                loading={busy === task.id}
                onPress={() => run(task.id, () => useTaskStore.getState().restore(task.id))}
              />
            </View>
          ))
        ) : (
          <Text variant="caption" color={colors.textSecondary}>
            {t('settings.noArchive')}
          </Text>
        )}
      </PreferenceSection>
      <View style={styles.about}>
        <View style={[styles.mark, { backgroundColor: colors.primarySoft }]}>
          <BrandArt width={52} height={52} />
        </View>
        <Text variant="title">Daily+</Text>
        <Text color={colors.textSecondary}>{t('settings.about')}</Text>
        <View style={styles.privacy}>
          <ShieldCheck size={16} color={colors.primary} />
          <Text variant="caption" color={colors.textSecondary} style={styles.privacyCopy}>
            {t('settings.privacy')}
          </Text>
        </View>
        <Text variant="caption" color={colors.textSecondary}>
          {t('settings.version', { version: Constants.expoConfig?.version ?? '1.0.0' })}
        </Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  divider: { height: StyleSheet.hairlineWidth, marginVertical: 3 },
  archiveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  archiveIcon: {
    width: 42,
    height: 42,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  archiveName: { flex: 1, minWidth: 70 },
  about: { alignItems: 'center', paddingTop: 20, gap: 12 },
  mark: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 8 },
  privacyCopy: { flexShrink: 1 },
});
