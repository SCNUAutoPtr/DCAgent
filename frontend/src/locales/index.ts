/**
 * 翻译资源动态加载器
 * 自动加载所有语言的翻译文件
 */

import type { Resource } from 'i18next';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from './languages';

/**
 * 命名空间列表
 * 添加新的翻译模块时，在这里注册命名空间
 */
export const NAMESPACES = [
  'common',
  'menu',
  'dashboard',
  'dataCenter',
  'room',
  'cabinet',
  'device',
  'panel',
  'cable',
  'opticalModule',
  'management',
  // 添加新的命名空间...
] as const;

export type Namespace = (typeof NAMESPACES)[number];

/**
 * 动态导入翻译文件
 */
const importTranslation = async (language: SupportedLanguage, namespace: string) => {
  try {
    const module = await import(`./${language}/${namespace}.json`);
    return module.default;
  } catch (error) {
    console.warn(`Translation file not found: ${language}/${namespace}.json`);
    return {};
  }
};

/**
 * 加载所有语言的所有命名空间
 */
export const loadAllTranslations = async (): Promise<Resource> => {
  const resources: Resource = {};

  for (const lang of SUPPORTED_LANGUAGES) {
    resources[lang.code] = {};

    for (const namespace of NAMESPACES) {
      const translation = await importTranslation(lang.code, namespace);
      resources[lang.code][namespace] = translation;
    }
  }

  return resources;
};

/**
 * 同步加载翻译资源（用于初始化）
 * 使用动态 import 的同步版本
 */
export const getInitialResources = (): Resource => {
  const resources: Resource = {};

  // 中文资源
  resources['zh-CN'] = {
    common: require('./zh-CN/common.json'),
    menu: require('./zh-CN/menu.json'),
    dataCenter: require('./zh-CN/dataCenter.json'),
    panel: require('./zh-CN/panel.json'),
  };

  // 英文资源
  resources['en-US'] = {
    common: require('./en-US/common.json'),
    menu: require('./en-US/menu.json'),
    dataCenter: require('./en-US/dataCenter.json'),
    panel: require('./en-US/panel.json'),
  };

  return resources;
};
