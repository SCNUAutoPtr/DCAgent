import api from './api';
import { DataCenter } from '@/types';

export const dataCenterService = {
  // 获取所有数据中心
  async getAll(): Promise<DataCenter[]> {
    const response = await api.get('/datacenters');
    return response.data;
  },

  // 获取数据中心详情
  async getById(id: string): Promise<DataCenter> {
    const response = await api.post('/datacenters/get', { id });
    return response.data;
  },

  // 创建数据中心
  async create(data: { name: string; location?: string }): Promise<DataCenter> {
    const response = await api.post('/datacenters/create', data);
    return response.data;
  },

  // 更新数据中心
  async update(id: string, data: { name?: string; location?: string }): Promise<DataCenter> {
    const response = await api.post('/datacenters/update', { id, ...data });
    return response.data;
  },

  // 删除数据中心
  async delete(id: string): Promise<void> {
    await api.post('/datacenters/delete', { id });
  },

  // 搜索数据中心
  async search(query: string): Promise<DataCenter[]> {
    const response = await api.get('/datacenters', { params: { search: query } });
    return response.data;
  },
};
