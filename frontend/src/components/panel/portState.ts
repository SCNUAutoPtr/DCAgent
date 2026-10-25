import type { PortAdminState } from '@contracts/enums';

export type PortVisualState = 'FREE' | 'CONNECTED' | 'RESERVED' | 'FAULTY';

export const PORT_STATE_COLORS: Record<PortVisualState, string> = {
  FREE: '#52c41a',
  CONNECTED: '#f5222d',
  RESERVED: '#faad14',
  FAULTY: '#8c8c8c',
};

export function portVisualState(p: { adminState?: PortAdminState; connected?: boolean }): PortVisualState {
  if (p.adminState === 'FAULTY') return 'FAULTY';
  if (p.connected) return 'CONNECTED';
  if (p.adminState === 'RESERVED') return 'RESERVED';
  return 'FREE';
}
