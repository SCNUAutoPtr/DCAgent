import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import jaJP from 'antd/locale/ja_JP';
import type { Locale } from 'antd/lib/locale';

export type SupportedLanguage = 'zh-CN' | 'en-US' | 'ja-JP';

export interface LanguageConfig {
  code: SupportedLanguage;
  nativeName: string;
  antdLocale: Locale;
}

/**
 * To add a language: register it here and add locales/<code>/<ns>.json for every namespace.
 * nativeName is each language's own name and is shown untranslated on purpose.
 */
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  // eslint-disable-next-line no-restricted-syntax -- a language's own name is never translated
  { code: 'zh-CN', nativeName: '简体中文', antdLocale: zhCN },
  { code: 'en-US', nativeName: 'English', antdLocale: enUS },
  // eslint-disable-next-line no-restricted-syntax -- a language's own name is never translated
  { code: 'ja-JP', nativeName: '日本語', antdLocale: jaJP },
];

export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-CN';

export const getAntdLocale = (code: string): Locale =>
  (SUPPORTED_LANGUAGES.find((l) => l.code === code) ?? SUPPORTED_LANGUAGES[0]).antdLocale;
