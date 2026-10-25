import i18n, { type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './locales/languages';

// Every locales/<lang>/<ns>.json is picked up automatically; zh-CN defines the namespaces.
const files = import.meta.glob<{ default: Record<string, unknown> }>('./locales/*/*.json', { eager: true });

const resources: Resource = {};
for (const [file, mod] of Object.entries(files)) {
  const m = /\.\/locales\/([^/]+)\/([^/]+)\.json$/.exec(file);
  if (!m) continue;
  (resources[m[1]] ??= {})[m[2]] = mod.default;
}

export const NAMESPACES = Object.keys(resources[DEFAULT_LANGUAGE] ?? {});

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES.map((l) => l.code),
    defaultNS: 'common',
    ns: NAMESPACES,
    interpolation: { escapeValue: false },
    detection: { order: ['localStorage', 'navigator'], caches: ['localStorage'], lookupLocalStorage: 'i18nextLng' },
    load: 'currentOnly',
    returnEmptyString: false,
  });

export default i18n;
