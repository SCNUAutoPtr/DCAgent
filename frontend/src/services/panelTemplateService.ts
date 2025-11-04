import api from './api';
import { PanelTemplate, PanelType } from '@/types';

export const panelTemplateService = {
  // 获取所有模板
  async getAll(type?: PanelType): Promise<PanelTemplate[]> {
    const params: any = {};
    if (type) params.type = type;
    const response = await api.get('/panel-templates', { params });
    return response.data;
  },

  // 获取模板详情
  async getById(id: string): Promise<PanelTemplate> {
    const response = await api.get(`/panel-templates/${id}`);
    return response.data;
  },

  // 创建模板
  async create(data: Partial<PanelTemplate>): Promise<PanelTemplate> {
    const response = await api.post('/panel-templates', data);
    return response.data;
  },

  // 更新模板
  async update(id: string, data: Partial<PanelTemplate>): Promise<PanelTemplate> {
    const response = await api.put(`/panel-templates/${id}`, data);
    return response.data;
  },

  // 删除模板
  async delete(id: string): Promise<void> {
    await api.delete(`/panel-templates/${id}`);
  },

  // 从模板创建面板
  async createPanelFromTemplate(
    templateId: string,
    deviceId: string,
    panelName?: string
  ): Promise<{ panel: any; ports: any[] }> {
    const response = await api.post(`/panel-templates/${templateId}/create-panel`, {
      deviceId,
      panelName,
    });
    return response.data;
  },

  // 解绑面板与模板
  async unbindPanel(panelId: string): Promise<any> {
    const response = await api.post(`/panel-templates/unbind/${panelId}`);
    return response.data;
  },

  // 初始化系统预设模板
  async initSystemTemplates(): Promise<void> {
    await api.post('/panel-templates/init-system-templates');
  },
};
