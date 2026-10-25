import type { PortType } from '@contracts/enums';
import { PORT_SIZE_MM } from '@contracts/portSizes';

/** Display info per port type; sizes come from the shared contracts. Descriptions: panel:portTypes.<TYPE>. */
export const PORT_TYPE_INFO: Record<PortType, { label: string; color: string; w: number; h: number }> = {
  RJ45: { label: 'RJ45', color: '#1890ff', ...PORT_SIZE_MM.RJ45 },
  SFP: { label: 'SFP', color: '#52c41a', ...PORT_SIZE_MM.SFP },
  SFP_PLUS: { label: 'SFP+', color: '#13c2c2', ...PORT_SIZE_MM.SFP_PLUS },
  SFP28: { label: 'SFP28', color: '#2f54eb', ...PORT_SIZE_MM.SFP28 },
  QSFP: { label: 'QSFP', color: '#722ed1', ...PORT_SIZE_MM.QSFP },
  QSFP28: { label: 'QSFP28', color: '#722ed1', ...PORT_SIZE_MM.QSFP28 },
  QSFP_DD: { label: 'QSFP-DD', color: '#eb2f96', ...PORT_SIZE_MM.QSFP_DD },
  CONSOLE: { label: 'Console', color: '#8c8c8c', ...PORT_SIZE_MM.CONSOLE },
  USB: { label: 'USB', color: '#1890ff', ...PORT_SIZE_MM.USB },
  POWER: { label: 'Power', color: '#f5222d', ...PORT_SIZE_MM.POWER },
  OTHER: { label: 'Other', color: '#8c8c8c', ...PORT_SIZE_MM.OTHER },
};
