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
    shortIdA: number;
    shortIdB: number;
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

  // 获取线缆端点信息（包含完整层级）
  async getCableEndpoints(cableId: string): Promise<any> {
    const response = await api.post('/cables/endpoints', { id: cableId });
    return response.data;
  },

  // 根据shortId获取线缆信息
  async getByShortId(shortId: number): Promise<Cable> {
    const response = await api.post('/cables/by-shortid', { shortId });
    return response.data;
  },

  // 根据shortId获取线缆端点信息
  async getCableEndpointsByShortId(shortId: number): Promise<any> {
    const response = await api.post('/cables/endpoints-by-shortid', { shortId });
    return response.data;
  },

  // 搜索线缆
  async search(search: string): Promise<Cable[]> {
    const response = await api.get('/cables', { params: { search } });
    return response.data;
  },

  // 手动入库（通过扫码两端端口shortID）
  async manualInventory(data: {
    shortIdA: number;
    shortIdB: number;
    label?: string;
    type: string;
    length?: number;
    color?: string;
    notes?: string;
  }): Promise<Cable> {
    const response = await api.post('/cables/manual-inventory', data);
    return response.data;
  },

  // 检查单个shortID是否可用
  async checkShortId(shortId: number): Promise<{
    available: boolean;
    message: string;
    usedBy?: 'cable' | 'pool' | null;
    details?: any;
  }> {
    const response = await api.post('/cables/check-shortid', { shortId });
    return response.data;
  },

  // 批量检查多个shortID可用性
  async checkMultipleShortIds(shortIds: number[]): Promise<{
    hasConflict: boolean;
    message: string;
    conflicts?: any[];
    available?: any[];
  }> {
    const response = await api.post('/cables/check-multiple-shortids', { shortIds });
    return response.data;
  },

  // 单端连接
  async connectSinglePort(data: {
    portId: string;
    shortId: number;
    label?: string;
    type?: string;
    length?: number;
    color?: string;
    notes?: string;
  }): Promise<{
    cable: Cable;
    connectedEndpoint: any;
    otherEndpoint: any;
    peerInfo: any;
  }> {
    const response = await api.post('/cables/connect-single-port', data);
    return response.data;
  },

  // 断开端点连接
  async disconnectEndpoint(shortId: number): Promise<{
    message: string;
    endpoint: any;
    disconnectedPort: any;
  }> {
    const response = await api.post('/cables/disconnect-endpoint', { shortId });
    return response.data;
  },
};
