import { Component, type ReactNode } from 'react';
import { View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { i18n } from '@/locales';
import { Text } from './Text';
import { Button } from './Button';
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    // A render failure must reveal the retry UI instead of leaving the native splash stuck.
    void SplashScreen.hideAsync().catch(() => undefined);
    if (__DEV__) console.error(error);
  }
  render() {
    return this.state.failed ? (
      <View style={{ flex: 1, justifyContent: 'center', padding: 32, gap: 20 }}>
        <Text variant="title">{i18n.t('error.title')}</Text>
        <Text>{i18n.t('error.message')}</Text>
        <Button title={i18n.t('common.retry')} onPress={() => this.setState({ failed: false })} />
      </View>
    ) : (
      this.props.children
    );
  }
}
