import api from './api';
import { Cabinet } from '@/types';

export const cabinetService = {
  // 获取所有机柜
  async getAll(roomId?: string): Promise<Cabinet[]> {
    const params = roomId ? { roomId } : {};
    const response = await api.get('/cabinets', { params });
    return response.data;
  },

  // 获取机柜详情
  async getById(id: string): Promise<Cabinet> {
    const response = await api.post('/cabinets/get', { id });
    return response.data;
  },

  // 创建机柜
  async create(data: { name: string; position?: string; height?: number; roomId: string }): Promise<Cabinet> {
    const response = await api.post('/cabinets/create', data);
    return response.data;
  },

  // 更新机柜
  async update(id: string, data: { name?: string; position?: string; height?: number }): Promise<Cabinet> {
    const response = await api.post('/cabinets/update', { id, ...data });
    return response.data;
  },

  // 删除机柜
  async delete(id: string): Promise<void> {
    await api.post('/cabinets/delete', { id });
  },

  // 搜索机柜
  async search(query: string): Promise<Cabinet[]> {
    const response = await api.get('/cabinets', { params: { search: query } });
    return response.data;
  },
};
