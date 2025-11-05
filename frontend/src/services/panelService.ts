import api from './api';
import { Panel, PanelType } from '@/types';

export const panelService = {
  // 获取所有面板
  async getAll(deviceId?: string, type?: PanelType): Promise<Panel[]> {
    const params: any = {};
    if (deviceId) params.deviceId = deviceId;
    if (type) params.type = type;
    const response = await api.get('/panels', { params });
    return response.data;
  },

  // 获取面板详情
  async getById(id: string): Promise<Panel> {
    const response = await api.post('/panels/get', { id });
    return response.data;
  },

  // 创建面板
  async create(data: Partial<Panel>): Promise<Panel> {
    const response = await api.post('/panels/create', data);
    return response.data;
  },

  // 更新面板
  async update(id: string, data: Partial<Panel>): Promise<Panel> {
    const response = await api.post('/panels/update', { id, ...data });
    return response.data;
  },

  // 删除面板
  async delete(id: string): Promise<void> {
    await api.post('/panels/delete', { id });
  },

  // 搜索面板
  async search(query: string): Promise<Panel[]> {
    const response = await api.get('/panels', { params: { search: query } });
    return response.data;
  },

  // 按设备获取面板
  async getByDevice(deviceId: string): Promise<Panel[]> {
    return this.getAll(deviceId);
  },

  // 按类型获取面板
  async getByType(type: PanelType): Promise<Panel[]> {
    return this.getAll(undefined, type);
  },

  // 根据shortId获取面板
  async getByShortId(shortId: number): Promise<Panel> {
    const response = await api.post('/panels/by-shortid', { shortId });
    return response.data;
  },
};
