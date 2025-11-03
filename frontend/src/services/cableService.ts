import api from './api';
import { Cable, CableConnection } from '@/types';

export const cableService = {
  // 获取所有线缆
  async getAll(): Promise<Cable[]> {
    const response = await api.get('/cables');
    return response.data;
  },

  // 获取线缆详情
  async getById(id: string): Promise<Cable> {
    const response = await api.post('/cables/get', { id });
    return response.data;
  },

  // 创建线缆连接
  async create(data: {
    label?: string;
    type: string;
    length?: number;
    color?: string;
    notes?: string;
    portAId: string;
    portBId: string;
  }): Promise<Cable> {
    const response = await api.post('/cables/create', data);
    return response.data;
  },

  // 更新线缆
  async update(id: string, data: Partial<Cable>): Promise<Cable> {
    const response = await api.post('/cables/update', { id, ...data });
    return response.data;
  },

  // 删除线缆
  async delete(id: string): Promise<void> {
    await api.post('/cables/delete', { id });
  },

  // 查询端口连接
  async getPortConnection(portId: string): Promise<any> {
    const response = await api.post('/cables/port-connection', { portId });
    return response.data;
  },

  // 查询面板连接
  async getPanelConnections(panelId: string): Promise<CableConnection[]> {
    const response = await api.post('/cables/panel-connections', { panelId });
    return response.data;
  },

  // 查询网状拓扑
  async getNetworkTopology(panelId: string, depth?: number): Promise<any> {
    const body = depth ? { panelId, depth } : { panelId };
    const response = await api.post('/cables/network-topology', body);
    return response.data;
  },
};
