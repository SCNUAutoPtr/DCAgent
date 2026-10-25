// zh-CN is the reference: a key missing there (or misspelt) is a compile error.
// The other languages are checked against it by scripts/locale-parity.test.mjs.
import 'i18next';
import type cabinet from './locales/zh-CN/cabinet.json';
import type cable from './locales/zh-CN/cable.json';
import type common from './locales/zh-CN/common.json';
import type dashboard from './locales/zh-CN/dashboard.json';
import type dataCenter from './locales/zh-CN/dataCenter.json';
import type datacenter3d from './locales/zh-CN/datacenter3d.json';
import type device from './locales/zh-CN/device.json';
import type errors from './locales/zh-CN/errors.json';
import type ip from './locales/zh-CN/ip.json';
import type labels from './locales/zh-CN/labels.json';
import type management from './locales/zh-CN/management.json';
import type menu from './locales/zh-CN/menu.json';
import type observability from './locales/zh-CN/observability.json';
import type opticalModule from './locales/zh-CN/opticalModule.json';
import type panel from './locales/zh-CN/panel.json';
import type room from './locales/zh-CN/room.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      cabinet: typeof cabinet;
      cable: typeof cable;
      common: typeof common;
      dashboard: typeof dashboard;
      dataCenter: typeof dataCenter;
      datacenter3d: typeof datacenter3d;
      device: typeof device;
      errors: typeof errors;
      ip: typeof ip;
      labels: typeof labels;
      management: typeof management;
      menu: typeof menu;
      observability: typeof observability;
      opticalModule: typeof opticalModule;
      panel: typeof panel;
      room: typeof room;
    };
  }
}
