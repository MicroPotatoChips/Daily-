import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import enBase from './en.json';
import zhBase from './zh-CN.json';
import { en, zh } from '@/features/translations';
import type { Settings } from '@/types';
const i18n = createInstance();
function merge(
  base: Record<string, unknown>,
  extra: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    const old = result[key];
    result[key] =
      old &&
      typeof old === 'object' &&
      !Array.isArray(old) &&
      value &&
      typeof value === 'object' &&
      !Array.isArray(value)
        ? merge(old as Record<string, unknown>, value as Record<string, unknown>)
        : value;
  }
  return result;
}
export function systemLanguage() {
  return getLocales()[0]?.languageCode === 'zh' ? 'zh-CN' : 'en';
}
void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: merge(enBase, en) },
    'zh-CN': { translation: merge(zhBase, zh) },
  },
  lng: systemLanguage(),
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});
export async function applyLanguage(language: Settings['language']) {
  await i18n.changeLanguage(language === 'system' ? systemLanguage() : language);
}
export { i18n };
export default i18n;
