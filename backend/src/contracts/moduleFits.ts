// Which transceiver forms fit which port cage. Pure and dependency-free (the frontend imports values from here).
import type { PortType, TransceiverForm } from './enums';

/** Port form -> module forms that fit (backwards compatible cages). */
export const MODULE_FITS: Partial<Record<PortType, TransceiverForm[]>> = {
  SFP: ['SFP'],
  SFP_PLUS: ['SFP_PLUS', 'SFP'],
  SFP28: ['SFP28', 'SFP_PLUS', 'SFP'],
  QSFP: ['QSFP'],
  QSFP28: ['QSFP28', 'QSFP'],
  QSFP_DD: ['QSFP_DD', 'QSFP28', 'QSFP'],
  OTHER: ['SFP', 'SFP_PLUS', 'SFP28', 'QSFP', 'QSFP28', 'QSFP_DD', 'OTHER'],
};
