import { Tabs } from 'expo-router';
import { View, Platform, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { House, ChartNoAxesColumnIncreasing } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { typography, useTheme } from '@/theme';
import { useReducedMotion } from '@/features/useReducedMotion';

export default function TabLayout() {
  const { colors, dark } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        animation: reducedMotion ? 'none' : 'fade',
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          position: 'absolute',
          bottom: Math.max(16, insets.bottom),
          left: 24,
          right: 24,
          height: 64,
          borderRadius: 24,
          borderTopWidth: 0,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : colors.glass,
          elevation: 4,
          paddingBottom: 8,
          paddingTop: 8,
          marginHorizontal: 28,
        },
        tabBarItemStyle: { minHeight: 48 },
        tabBarLabelStyle: {
          ...typography.caption,
          fontSize: 12,
          lineHeight: 16,
          fontWeight: '600',
          marginTop: 3,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              tint={dark ? 'dark' : 'light'}
              intensity={75}
              style={[StyleSheet.absoluteFill, styles.glass]}
            />
          ) : (
            <View
              style={[StyleSheet.absoluteFill, styles.glass, { backgroundColor: colors.glass }]}
            />
          ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('nav.home'),
          tabBarIcon: ({ color }) => <House color={color} size={22} strokeWidth={1.8} />,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('nav.history'),
          tabBarIcon: ({ color }) => (
            <ChartNoAxesColumnIncreasing color={color} size={22} strokeWidth={1.8} />
          ),
        }}
      />
    </Tabs>
  );
}
const styles = StyleSheet.create({ glass: { borderRadius: 24, overflow: 'hidden' } });
