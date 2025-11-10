/**
 * 语言配置文件
 * 用于管理所有支持的语言和动态加载语言资源
 */

// Ant Design locale 导入
import zhCN from 'antd/locale/zh_CN';
import enUS from 'antd/locale/en_US';
import jaJP from 'antd/locale/ja_JP';
import type { Locale } from 'antd/lib/locale';

/**
 * 支持的语言类型
 */
export type SupportedLanguage = 'zh-CN' | 'en-US' | 'ja-JP';

/**
 * 语言配置接口
 */
export interface LanguageConfig {
  code: SupportedLanguage;
  name: string;
  nativeName: string;
  antdLocale: Locale;
  flag?: string; // 可选的国旗 emoji 或图标
}

/**
 * 所有支持的语言配置
 * 要添加新语言，只需在这里添加配置并创建对应的翻译文件
 */
export const SUPPORTED_LANGUAGES: LanguageConfig[] = [
  {
    code: 'zh-CN',
    name: 'Chinese',
    nativeName: '简体中文',
    antdLocale: zhCN,
    flag: '🇨🇳',
  },
  {
    code: 'en-US',
    name: 'English',
    nativeName: 'English',
    antdLocale: enUS,
    flag: '🇺🇸',
  },
  {
    code: 'ja-JP',
    name: 'Japanese',
    nativeName: '日本語',
    antdLocale: jaJP,
    flag: '🇯🇵',
  },
];

/**
 * 默认语言
 */
export const DEFAULT_LANGUAGE: SupportedLanguage = 'zh-CN';

/**
 * 根据语言代码获取语言配置
 */
export const getLanguageConfig = (code: string): LanguageConfig => {
  return (
    SUPPORTED_LANGUAGES.find((lang) => lang.code === code) ||
    SUPPORTED_LANGUAGES.find((lang) => lang.code === DEFAULT_LANGUAGE)!
  );
};

/**
 * 根据语言代码获取 Ant Design locale
 */
export const getAntdLocale = (code: string): Locale => {
  const config = getLanguageConfig(code);
  return config.antdLocale;
};

/**
 * 检查是否是支持的语言
 */
export const isSupportedLanguage = (code: string): code is SupportedLanguage => {
  return SUPPORTED_LANGUAGES.some((lang) => lang.code === code);
};
