/**
 * 全局 ShortID 分配服务
 * 只为直接调用的实体资产（Room、Cabinet、Panel、Port）分配 shortId
 * 其他实体（DataCenter、Device、Cable）可通过有shortId的对象找到，不需要独立shortId
 */

import prisma from '../utils/prisma';

export type EntityType =
  | 'Room'
  | 'Cabinet'
  | 'Panel'
  | 'Port'
  | 'CableEndpoint';

class GlobalShortIdService {
  /**
   * 分配一个新的全局唯一 shortId
   * @param entityType 实体类型
   * @param entityId 实体的UUID
   * @param specifiedShortId 可选：指定要分配的shortId（用于线缆端点标签）
   * @returns 分配的 shortId
   */
  async allocate(entityType: EntityType, entityId: string, specifiedShortId?: number): Promise<number> {
    // 使用事务确保原子性
    const result = await prisma.$transaction(async (tx) => {
      let shortId: number;

      if (specifiedShortId !== undefined) {
        // 使用指定的 shortId（用于线缆端点标签）
        // 检查是否已被占用
        const existing = await tx.globalShortIdAllocation.findUnique({
          where: { shortId: specifiedShortId },
        });

        if (existing) {
          throw new Error(`ShortID ${specifiedShortId} 已被占用（类型：${existing.entityType}）`);
        }

        shortId = specifiedShortId;

        // 如果指定的 shortId 大于当前序列值，更新序列值
        const sequence = await tx.globalShortIdSequence.findFirst();
        if (sequence && shortId >= sequence.currentValue) {
          await tx.globalShortIdSequence.update({
            where: { id: sequence.id },
            data: { currentValue: shortId + 1 },
          });
        }
      } else {
        // 自动分配：获取并递增全局序列
        let sequence = await tx.globalShortIdSequence.findFirst();

        if (!sequence) {
          // 初始化序列（从1开始）
          sequence = await tx.globalShortIdSequence.create({
            data: {
              currentValue: 1,
            },
          });
        }

        shortId = sequence.currentValue;

        // 更新序列值
        await tx.globalShortIdSequence.update({
          where: { id: sequence.id },
          data: { currentValue: shortId + 1 },
        });
      }

      // 记录分配
      await tx.globalShortIdAllocation.create({
        data: {
          shortId,
          entityType,
          entityId,
        },
      });

      return shortId;
    });

    return result;
  }

  /**
   * 检查 shortId 是否已被使用
   */
  async isAllocated(shortId: number): Promise<boolean> {
    const allocation = await prisma.globalShortIdAllocation.findUnique({
      where: { shortId },
    });
    return allocation !== null;
  }

  /**
   * 查询 shortId 对应的实体信息
   * 先查 GlobalShortIdAllocation，如果没有或 entityId 为空则查 ShortIdPool（兼容旧数据）
   */
  async getEntityByShortId(shortId: number): Promise<{
    entityType: EntityType;
    entityId: string;
  } | null> {
    // 1. 优先查询新的全局分配表
    const allocation = await prisma.globalShortIdAllocation.findUnique({
      where: { shortId },
    });

    // 如果找到且 entityId 不为空，返回结果
    if (allocation && allocation.entityId) {
      return {
        entityType: allocation.entityType as EntityType,
        entityId: allocation.entityId,
      };
    }

    // 2. 如果新表没有或 entityId 为空，查询旧的 ShortIdPool 表（主要用于线缆端子）
    const poolRecord = await prisma.shortIdPool.findUnique({
      where: { shortId },
    });

    if (poolRecord && poolRecord.status === 'BOUND' && poolRecord.entityId) {
      return {
        entityType: poolRecord.entityType as EntityType,
        entityId: poolRecord.entityId,
      };
    }

    return null;
  }

  /**
   * 释放 shortId（删除实体时调用）
   */
  async release(shortId: number): Promise<void> {
    await prisma.globalShortIdAllocation.delete({
      where: { shortId },
    });
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
   */
  async getCurrentSequenceValue(): Promise<number> {
    const sequence = await prisma.globalShortIdSequence.findFirst();
    return sequence?.currentValue || 0;
  }
}

export default new GlobalShortIdService();
