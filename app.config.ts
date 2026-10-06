import type { ExpoConfig } from 'expo/config';
const config: ExpoConfig = {
  name: 'Daily+',
  slug: 'daily-plus',
  version: '1.2.0',
  scheme: 'dailyplus',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/icon.png',
  ios: {
    supportsTablet: true,
    buildNumber: '2',
    bundleIdentifier: 'com.dailyplus.app',
    icon: { light: './assets/icon.png', dark: './assets/icon-dark.png' },
  },
  android: {
    package: 'com.dailyplus.app',
    versionCode: 2,
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/monochrome-icon.png',
      backgroundColor: '#F6F7F2',
    },
  },
  web: { bundler: 'metro', output: 'single', favicon: './assets/favicon.png' },
  plugins: [
    'expo-router',
    'expo-sqlite',
    'expo-localization',
    'expo-notifications',
    [
      'expo-splash-screen',
      {
        image: './assets/splash.png',
        imageWidth: 180,
        resizeMode: 'contain',
        backgroundColor: '#F6F7F2',
        dark: { image: './assets/splash-dark.png', backgroundColor: '#131C17' },
      },
    ],
    ['./plugins/withDailyWidgets', { appGroupIdentifier: 'group.com.dailyplus.app' }],
  ],
  experiments: { typedRoutes: true },
};
export default config;
