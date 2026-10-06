import { useColorScheme } from 'react-native';
import { useSettingsStore } from '@/store/settingsStore';
import { palettes } from './colors';
export { spacing } from './spacing';
export { radius } from './radius';
export { typography } from './typography';
export { shadows } from './shadows';
export { taskColors } from './colors';
export function useTheme() {
  const system = useColorScheme();
  const mode = useSettingsStore((s) => s.settings.theme);
  const dark = (mode === 'system' ? system : mode) === 'dark';
  return { dark, colors: dark ? palettes.dark : palettes.light };
}
