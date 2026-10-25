import type { DeviceType, ModuleStatus, PanelType } from '@contracts/enums';

/** antd Tag colours per enum value. */
export const DEVICE_TYPE_COLORS: Record<DeviceType, string> = {
  SERVER: 'blue',
  SWITCH: 'green',
  ROUTER: 'orange',
  FIREWALL: 'red',
  STORAGE: 'purple',
  PDU: 'cyan',
  OTHER: 'default',
};

export const PANEL_TYPE_COLORS: Record<PanelType, string> = {
  NETWORK: 'blue',
  POWER: 'red',
  CONSOLE: 'orange',
  USB: 'purple',
  OTHER: 'default',
};

export const MODULE_STATUS_COLORS: Record<ModuleStatus, string> = {
  IN_STOCK: 'default',
  INSTALLED: 'green',
  RESERVED: 'blue',
  FAULTY: 'red',
  SCRAPPED: 'gray',
};
