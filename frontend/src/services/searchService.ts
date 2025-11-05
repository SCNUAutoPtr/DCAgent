import api from './api';

export interface SearchResult {
  type: 'DataCenter' | 'Room' | 'Cabinet' | 'Device' | 'Cable' | 'Panel' | 'Port';
  id: string;
  shortId: number;
  name?: string;
  label?: string;
  description?: string;
  metadata?: any;
}

class SearchService {
  /**
   * 全局搜索
   */
  async globalSearch(query: string): Promise<SearchResult[]> {
    const response = await api.post('/search/global', { query });
    return response.data;
  }

  /**
   * 根据 shortId 查找实体
   */
  async findByShortId(shortId: number): Promise<SearchResult | null> {
    try {
      const response = await api.post('/search/by-shortid', { shortId });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * 获取线缆端点信息（用于扫描线缆插头）
   */
  async getCableEndpointsByShortId(shortId: number) {
    try {
      const response = await api.post('/cables/endpoints-by-shortid', { shortId });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }
}

export default new SearchService();
