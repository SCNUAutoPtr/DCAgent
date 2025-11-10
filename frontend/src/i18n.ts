import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES } from './locales/languages';
import { NAMESPACES } from './locales';

// 导入翻译资源
import zhCN_common from './locales/zh-CN/common.json';
import zhCN_menu from './locales/zh-CN/menu.json';
import zhCN_dataCenter from './locales/zh-CN/dataCenter.json';
import zhCN_room from './locales/zh-CN/room.json';
import zhCN_cabinet from './locales/zh-CN/cabinet.json';
import zhCN_device from './locales/zh-CN/device.json';
import zhCN_dashboard from './locales/zh-CN/dashboard.json';
import zhCN_panel from './locales/zh-CN/panel.json';
import zhCN_cable from './locales/zh-CN/cable.json';
import zhCN_opticalModule from './locales/zh-CN/opticalModule.json';
import zhCN_management from './locales/zh-CN/management.json';

import enUS_common from './locales/en-US/common.json';
import enUS_menu from './locales/en-US/menu.json';
import enUS_dataCenter from './locales/en-US/dataCenter.json';
import enUS_room from './locales/en-US/room.json';
import enUS_cabinet from './locales/en-US/cabinet.json';
import enUS_device from './locales/en-US/device.json';
import enUS_dashboard from './locales/en-US/dashboard.json';
import enUS_panel from './locales/en-US/panel.json';
import enUS_cable from './locales/en-US/cable.json';
import enUS_opticalModule from './locales/en-US/opticalModule.json';
import enUS_management from './locales/en-US/management.json';

import jaJP_common from './locales/ja-JP/common.json';
import jaJP_menu from './locales/ja-JP/menu.json';
import jaJP_dataCenter from './locales/ja-JP/dataCenter.json';
import jaJP_room from './locales/ja-JP/room.json';
import jaJP_cabinet from './locales/ja-JP/cabinet.json';
import jaJP_device from './locales/ja-JP/device.json';
import jaJP_dashboard from './locales/ja-JP/dashboard.json';
import jaJP_panel from './locales/ja-JP/panel.json';
import jaJP_cable from './locales/ja-JP/cable.json';
import jaJP_opticalModule from './locales/ja-JP/opticalModule.json';
import jaJP_management from './locales/ja-JP/management.json';

// 配置 i18n
i18n
  // 检测用户语言
  .use(LanguageDetector)
  // 传递 i18n 实例给 react-i18next
  .use(initReactI18next)
  // 初始化 i18next
  .init({
    // 默认语言
    fallbackLng: DEFAULT_LANGUAGE,
    // 支持的语言列表
    supportedLngs: SUPPORTED_LANGUAGES.map((lang) => lang.code),
    // 调试模式（开发环境）
    debug: import.meta.env.DEV,
    // 语言资源（初始加载的资源）
    resources: {
      'zh-CN': {
        common: zhCN_common,
        menu: zhCN_menu,
        dataCenter: zhCN_dataCenter,
        room: zhCN_room,
        cabinet: zhCN_cabinet,
        device: zhCN_device,
        dashboard: zhCN_dashboard,
        panel: zhCN_panel,
        cable: zhCN_cable,
        opticalModule: zhCN_opticalModule,
        management: zhCN_management,
      },
      'en-US': {
        common: enUS_common,
        menu: enUS_menu,
        dataCenter: enUS_dataCenter,
        room: enUS_room,
        cabinet: enUS_cabinet,
        device: enUS_device,
        dashboard: enUS_dashboard,
        panel: enUS_panel,
        cable: enUS_cable,
        opticalModule: enUS_opticalModule,
        management: enUS_management,
      },
      'ja-JP': {
        common: jaJP_common,
        menu: jaJP_menu,
        dataCenter: jaJP_dataCenter,
        room: jaJP_room,
        cabinet: jaJP_cabinet,
        device: jaJP_device,
        dashboard: jaJP_dashboard,
        panel: jaJP_panel,
        cable: jaJP_cable,
        opticalModule: jaJP_opticalModule,
        management: jaJP_management,
      },
    },
    // 默认命名空间
    defaultNS: 'common',
    // 命名空间（从配置中获取）
    ns: [...NAMESPACES],
    // 插值配置
    interpolation: {
      escapeValue: false, // React 已经安全处理了
    },
    // 语言检测配置
    detection: {
      // 检测顺序：localStorage -> navigator
      order: ['localStorage', 'navigator'],
      // 缓存用户语言选择
      caches: ['localStorage'],
      // localStorage key
      lookupLocalStorage: 'i18nextLng',
    },
    // 当命名空间未加载时的行为
    load: 'currentOnly',
    // 非严格模式，允许部分翻译缺失
    returnEmptyString: false,
  });

export default i18n;
