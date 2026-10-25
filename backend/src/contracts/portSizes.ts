// Port cage sizes. Pure and dependency-free (the frontend imports values from here).
import type { PortType } from './enums';

/** Default cage size per port type, millimetres (front view). */
export const PORT_SIZE_MM: Record<PortType, { w: number; h: number }> = {
  RJ45: { w: 16, h: 14 },
  SFP: { w: 13.5, h: 8.5 },
  SFP_PLUS: { w: 13.5, h: 8.5 },
  SFP28: { w: 13.5, h: 8.5 },
  QSFP: { w: 18.5, h: 8.5 },
  QSFP28: { w: 18.5, h: 8.5 },
  QSFP_DD: { w: 18.5, h: 9.5 },
  CONSOLE: { w: 16, h: 14 },
  USB: { w: 14, h: 7 },
  POWER: { w: 20, h: 15 },
  OTHER: { w: 12, h: 12 },
};
