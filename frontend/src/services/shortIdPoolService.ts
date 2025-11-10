import api from './api';

export type EntityType = 'DATA_CENTER' | 'ROOM' | 'CABINET' | 'DEVICE' | 'PANEL' | 'PORT' | 'CABLE' | 'CABLE_ENDPOINT';
export type ShortIdPoolStatus = 'GENERATED' | 'PRINTED' | 'BOUND' | 'CANCELLED';

export interface ShortIdPoolRecord {
  id: string;
  shortId: number;
  entityType: EntityType;
  status: ShortIdPoolStatus;
  entityId?: string;
  boundAt?: string;
  printTaskId?: string;
  printTask?: {
    id: string;
    name: string;
    status: string;
  };
  printedAt?: string;
  batchNo?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PrintTask {
  id: string;
  name: string;
  entityType: EntityType;
  count: number;
  status: string;
  filePath?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
  completedAt?: string;
  updatedAt: string;
  _count?: {
    shortIds: number;
  };
}

export interface PoolStats {
  total: number;
  generated: number;
  printed: number;
  bound: number;
  cancelled: number;
  byType?: Record<string, number>;
}

export const shortIdPoolService = {
  // 批量生成shortID
  async generateShortIds(
    count: number,
    batchNo?: string
  ): Promise<{
    success: boolean;
    message: string;
    shortIds: number[];
  }> {
    const response = await api.post('/shortid-pool/generate', {
      count,
      batchNo,
    });
    return response.data;
  },

  // 创建打印任务
  async createPrintTask(
    name: string,
    count: number,
    createdBy?: string,
    notes?: string
  ): Promise<{
    success: boolean;
    message: string;
    printTask: PrintTask;
    shortIds: number[];
  }> {
    const response = await api.post('/shortid-pool/print-task/create', {
      name,
      count,
      createdBy,
      notes,
    });
    return response.data;
  },

  // 导出打印任务的shortID为CSV（返回下载URL）
  async exportPrintTask(taskId: string): Promise<Blob> {
    const response = await api.get(`/shortid-pool/print-task/${taskId}/export`, {
      responseType: 'blob',
    });
    return response.data;
  },

  // 标记打印任务为完成
  async completePrintTask(taskId: string, filePath?: string): Promise<{
    success: boolean;
    message: string;
    task: PrintTask;
  }> {
    const response = await api.post(`/shortid-pool/print-task/${taskId}/complete`, {
      filePath,
    });
    return response.data;
  },

  // 检查shortID是否存在
  async checkShortIdExists(shortId: number): Promise<{
    exists: boolean;
    usedBy: 'entity' | 'pool' | null;
    entityType?: EntityType;
    details?: any;
  }> {
    const response = await api.post('/shortid-pool/check', {
      shortId,
    });
    return response.data;
  },

  // 绑定shortID到实体
  async bindShortIdToEntity(
    shortId: number,
    entityType: EntityType,
    entityId: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.post('/shortid-pool/bind', {
      shortId,
      entityType,
      entityId,
    });
    return response.data;
  },

  // 标记shortID为报废
  async cancelShortId(
    shortId: number,
    reason?: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    const response = await api.post('/shortid-pool/cancel', {
      shortId,
      reason,
    });
    return response.data;
  },

  // 获取池统计信息
  async getPoolStats(entityType?: EntityType): Promise<PoolStats> {
    const response = await api.get('/shortid-pool/stats', {
      params: { entityType },
    });
    return response.data;
  },

  // 获取池记录（分页）
  async getPoolRecords(params: {
    page?: number;
    pageSize?: number;
    entityType?: EntityType;
    status?: ShortIdPoolStatus;
    batchNo?: string;
    search?: string;
  }): Promise<{
    records: ShortIdPoolRecord[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const response = await api.post('/shortid-pool/records', params);
    return response.data;
  },

  // 获取所有打印任务
  async getPrintTasks(params: {
    page?: number;
    pageSize?: number;
    entityType?: EntityType;
    status?: string;
  }): Promise<{
    records: PrintTask[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const response = await api.post('/shortid-pool/print-tasks', params);
    return response.data;
  },
};
