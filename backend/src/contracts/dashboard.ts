import type { DeviceType, ModuleStatus } from './enums';
import type { SubnetUsage } from './ip';

export interface DashboardOverview {
  counts: {
    dataCenters: number;
    rooms: number;
    cabinets: number;
    devices: number;
    panels: number;
    ports: number;
    cables: number;
    workstations: number;
    opticalModules: number;
  };
  devicesByType: Record<DeviceType, number>;
  opticalModules: Record<ModuleStatus, number>;
  ports: { total: number; connected: number; free: number; reserved: number; faulty: number; usageRate: number };
  cables: { STOCK: number; IN_USE: number };
  /** cabinets, panels and cable ends without a label: must be 0 */
  labelsMissing: number;
  /** GENERATED labels bound to an entity: stuck on paper only after printing */
  labelsToPrint: number;
  workstations: { total: number; online: number };
  observationUnmatched: number;
  subnets: { id: string; name: string; network: string; usage: SubnetUsage }[];
  recentDevices: { id: string; name: string; type: DeviceType; location: string; createdAt: string }[];
}
