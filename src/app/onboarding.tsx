import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { ArrowRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button, Screen, Text } from '@/components';
import { useTheme } from '@/theme';
import { useSettingsStore } from '@/store/settingsStore';
import { useActions } from '@/features/useActions';

import { BrandArt } from '@/components/BrandArt';

const pageArtwork = ['growth', 'focus', 'celebrate'] as const;

export default function OnboardingScreen() {
  const [page, setPage] = useState(0);
  const { t } = useTranslation();
  const { colors } = useTheme();
  const router = useRouter();
  const { run, busy } = useActions();

  const start = () =>
    run('onboard', async () => {
      await useSettingsStore.getState().update({ onboarded: true });
      router.replace('/(tabs)');
    });
  return (
    <Screen style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.wordmarkRow}>
          <BrandArt width={34} height={34} />
          <Text variant="headline" color={colors.primary} style={styles.wordmark}>
            Daily+
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => void start()}
          disabled={busy === 'onboard'}
          style={styles.skip}
        >
          <Text variant="caption" color={colors.textSecondary}>
            {t('onboarding.skip')}
          </Text>
        </Pressable>
      </View>
      <View
        style={[styles.illustration, { backgroundColor: colors.primarySoft }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <BrandArt kind={pageArtwork[page] ?? 'growth'} height={270} />
      </View>
      <View style={styles.copy}>
        <Text variant="largeTitle" style={styles.title} accessibilityRole="header">
          {t(`onboarding.title${page + 1}`)}
        </Text>
        <Text color={colors.textSecondary} style={styles.description}>
          {t(`onboarding.message${page + 1}`)}
        </Text>
      </View>
      <View style={styles.footer}>
        <View
          style={styles.dots}
          accessible
          accessibilityLabel={t('onboarding.page', { page: page + 1 })}
        >
          {[0, 1, 2].map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  width: index === page ? 24 : 7,
                  backgroundColor: index === page ? colors.primary : colors.border,
                },
              ]}
            />
          ))}
        </View>
        <Button
          title={t(page === 2 ? 'onboarding.start' : 'onboarding.next')}
          icon={ArrowRight}
          loading={busy === 'onboard'}
          onPress={() => (page === 2 ? start() : setPage((current) => current + 1))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { paddingBottom: 40, gap: 28, flexGrow: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  wordmarkRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  wordmark: { letterSpacing: 0.3 },
  skip: { minHeight: 44, justifyContent: 'center', flexShrink: 1 },
  illustration: {
    height: 290,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginTop: 4,
  },
  copy: { gap: 16 },
  title: { fontSize: 36, lineHeight: 44, letterSpacing: -1.2 },
  description: { lineHeight: 27, maxWidth: 380 },
  footer: { marginTop: 'auto', gap: 24, paddingTop: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 7 },
  dot: { height: 7, borderRadius: 4 },
});
