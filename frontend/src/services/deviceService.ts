import api from './api';
import { Device } from '@/types';

export const deviceService = {
  // 获取所有设备
  async getAll(cabinetId?: string): Promise<Device[]> {
    const params = cabinetId ? { cabinetId } : {};
    const response = await api.get('/devices', { params });
    return response.data;
  },

  // 获取设备详情
  async getById(id: string): Promise<Device> {
    const response = await api.post('/devices/get', { id });
    return response.data;
  },

  // 创建设备
  async create(data: Partial<Device>): Promise<Device> {
    const response = await api.post('/devices/create', data);
    return response.data;
  },

  // 更新设备
  async update(id: string, data: Partial<Device>): Promise<Device> {
    const response = await api.post('/devices/update', { id, ...data });
    return response.data;
  },

  // 删除设备
  async delete(id: string): Promise<void> {
    await api.post('/devices/delete', { id });
  },

  // 搜索设备
  async search(query: string): Promise<Device[]> {
    const response = await api.get('/devices', { params: { search: query } });
    return response.data;
  },

  // 批量创建设备
  async bulkCreate(devices: Partial<Device>[]): Promise<any> {
    const response = await api.post('/devices/bulk-create', { devices });
    return response.data;
  },
};
