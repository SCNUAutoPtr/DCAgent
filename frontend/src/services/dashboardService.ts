import api from './api';
import { DeviceType } from '@/types';

export interface DashboardRecentDevice {
  id: string;
  name: string;
  type: DeviceType;
  model?: string | null;
  uPosition?: number | null;
  cabinetId: string;
  cabinetName?: string | null;
  roomName?: string | null;
  createdAt: string;
}

export interface DashboardOverview {
  counts: {
    dataCenters: number;
    rooms: number;
    cabinets: number;
    devices: number;
    panels: number;
    ports: number;
    cables: number;
  };
  ports: {
    total: number;
    occupied: number;
    available: number;
    reserved: number;
    faulty: number;
    occupancyRate: number;
  };
  cables: {
    total: number;
    notInventoried: number;
    inventoried: number;
    inUse: number;
  };
  recentDevices: DashboardRecentDevice[];
}

export const dashboardService = {
  // 获取仪表板总览数据
  async getOverview(): Promise<DashboardOverview> {
    const response = await api.get('/dashboard/overview');
    return response.data;
  },
};
