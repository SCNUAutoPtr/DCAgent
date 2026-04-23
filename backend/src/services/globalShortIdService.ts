/**
 * 全局 ShortID 分配服务（统一使用 ShortIDPool）
 * 只为直接调用的实体资产（Room、Cabinet、Panel、Port）分配 shortId
 * 其他实体（DataCenter、Device、Cable）可通过有shortId的对象找到，不需要独立shortId
 *
 * 本服务现在作为 shortIdPoolService 的包装层，保持 API 兼容性
 */

import prisma from '../utils/prisma';
import { shortIdPoolService } from './shortIdPoolService';

export type EntityType =
  | 'Room'
  | 'Cabinet'
  | 'Panel'
  | 'Port'
  | 'CableEndpoint';

// 映射到 ShortIDPool 的实体类型
const entityTypeMap: Record<EntityType, string> = {
  'Room': 'ROOM',
  'Cabinet': 'CABINET',
  'Panel': 'PANEL',
  'Port': 'PORT',
  'CableEndpoint': 'CABLE_ENDPOINT'
};

class GlobalShortIdService {
  /**
   * 分配一个新的全局唯一 shortId
   * @param entityType 实体类型
   * @param entityId 实体的UUID
   * @param specifiedShortId 可选：指定要分配的shortId（用于线缆端点标签）
   * @returns 分配的 shortId
   */
  async allocate(entityType: EntityType, entityId: string, specifiedShortId?: number): Promise<number> {
    const poolEntityType = entityTypeMap[entityType];
    return await shortIdPoolService.allocateShortId(poolEntityType as any, entityId, specifiedShortId);
  }

  /**
   * 检查 shortId 是否已被使用
   */
  async isAllocated(shortId: number): Promise<boolean> {
    const result = await shortIdPoolService.checkShortIdExists(shortId);
    return result.exists;
  }

  /**
   * 查询 shortId 对应的实体信息
   */
  async getEntityByShortId(shortId: number): Promise<{
    entityType: EntityType;
    entityId: string;
  } | null> {
    const poolRecord = await prisma.shortIdPool.findUnique({
      where: { shortId },
    });

    if (poolRecord && poolRecord.status === 'BOUND' && poolRecord.entityId) {
      // 将 ShortIDPool 的实体类型转换回 globalShortId 的类型
      const reverseMap: Record<string, EntityType> = {
        'ROOM': 'Room',
        'CABINET': 'Cabinet',
        'PANEL': 'Panel',
        'PORT': 'Port',
        'CABLE_ENDPOINT': 'CableEndpoint'
      };

      const mappedType = poolRecord.entityType ? reverseMap[poolRecord.entityType] : null;
      if (!mappedType) {
        return null;
      }

      return {
        entityType: mappedType,
        entityId: poolRecord.entityId,
      };
    }

    return null;
  }

  /**
   * 释放 shortId（删除实体时调用）
   */
  async release(shortId: number): Promise<void> {
    await shortIdPoolService.releaseShortId(shortId);
  }

  /**
   * 批量分配 shortId（用于数据迁移）
   */
  async batchAllocate(allocations: Array<{
    entityType: EntityType;
    entityId: string;
  }>): Promise<number[]> {
    const shortIds: number[] = [];

    for (const { entityType, entityId } of allocations) {
      const shortId = await this.allocate(entityType, entityId);
      shortIds.push(shortId);
    }

    return shortIds;
  }

  /**
   * 获取当前序列值（用于调试）
   * 从 ShortIDPool 中获取最大的 shortId + 1
   */
  async getCurrentSequenceValue(): Promise<number> {
    const maxRecord = await prisma.shortIdPool.findFirst({
      orderBy: { shortId: 'desc' }
    });
    return maxRecord ? maxRecord.shortId + 1 : 1;
  }
}

export default new GlobalShortIdService();
