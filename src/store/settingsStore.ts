import { create } from 'zustand';
import type { Settings } from '@/types';
import { loadSettings, saveSettings } from '@/database/settingsRepository';
import { applyLanguage } from '@/locales';
export const defaultSettings: Settings = {
  language: 'system',
  theme: 'system',
  haptics: true,
  notifications: false,
  weekStartsOn: 1,
  onboarded: false,
};
interface SettingsState {
  settings: Settings;
  load: () => Promise<void>;
  update: (partial: Partial<Settings>) => Promise<void>;
}
let queue: Promise<void> = Promise.resolve();
export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: defaultSettings,
  load: async () => {
    const settings = { ...defaultSettings, ...(await loadSettings()) };
    await applyLanguage(settings.language);
    set({ settings });
  },
  update: (partial) => {
    const work = queue.then(async () => {
      const settings = { ...get().settings, ...partial };
      await saveSettings(settings);
      await applyLanguage(settings.language);
      set({ settings });
    });
    queue = work.catch(() => undefined);
    return work;
  },
}));
