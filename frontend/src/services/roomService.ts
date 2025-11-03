import api from './api';
import { Room } from '@/types';

export const roomService = {
  // 获取所有机房
  async getAll(dataCenterId?: string): Promise<Room[]> {
    const params = dataCenterId ? { dataCenterId } : {};
    const response = await api.get('/rooms', { params });
    return response.data;
  },

  // 获取机房详情
  async getById(id: string): Promise<Room> {
    const response = await api.post('/rooms/get', { id });
    return response.data;
  },

  // 创建机房
  async create(data: { name: string; floor?: string; dataCenterId: string }): Promise<Room> {
    const response = await api.post('/rooms/create', data);
    return response.data;
  },

  // 更新机房
  async update(id: string, data: { name?: string; floor?: string }): Promise<Room> {
    const response = await api.post('/rooms/update', { id, ...data });
    return response.data;
  },

  // 删除机房
  async delete(id: string): Promise<void> {
    await api.post('/rooms/delete', { id });
  },

  // 搜索机房
  async search(query: string): Promise<Room[]> {
    const response = await api.get('/rooms', { params: { search: query } });
    return response.data;
  },
};
