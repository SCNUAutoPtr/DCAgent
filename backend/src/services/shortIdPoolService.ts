import prisma from '../utils/prisma';
import { EntityType, ShortIdPoolStatus } from '@prisma/client';
import { ShortIdFormatter } from '../utils/shortIdFormatter';
import globalShortIdService from './globalShortIdService';

export class ShortIdPoolService {
  /**
   * 批量生成shortID到池中
   * @param count 生成数量
   * @param batchNo 批次号（可选）
   * @returns 生成的shortID列表
   */
  async generateShortIds(
    count: number,
    batchNo?: string
  ): Promise<number[]> {
    if (count <= 0 || count > 10000) {
      throw new Error('生成数量必须在 1-10000 之间');
    }

    // 1. 查找当前最大的shortID（从所有类型的Pool表和所有实体表中）
    // 注意：shortId是全局唯一的，需要查询所有表的最大值
    const maxPoolShortId = await prisma.shortIdPool.findFirst({
      orderBy: { shortId: 'desc' },
      select: { shortId: true },
    });

    // 从所有有shortId字段的实体表查找最大shortID（因为shortId是全局唯一的）
    const [cabinet, room, panel, cableEndpoint, globalAllocation] = await Promise.all([
      prisma.cabinet.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
      prisma.room.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
      prisma.panel.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
      prisma.cableEndpoint.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
      prisma.globalShortIdAllocation.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
    ]);

    const maxEntityShortId = Math.max(
      cabinet?.shortId || 0,
      room?.shortId || 0,
      panel?.shortId || 0,
      cableEndpoint?.shortId || 0,
      globalAllocation?.shortId || 0
    );

    const currentMax = Math.max(maxPoolShortId?.shortId || 0, maxEntityShortId);

    // 2. 从currentMax + 1开始生成连续的shortID
    const generatedIds: number[] = [];
    const poolRecords = [];

    for (let i = 1; i <= count; i++) {
      const newShortId = currentMax + i;
      generatedIds.push(newShortId);
      poolRecords.push({
        shortId: newShortId,
        status: ShortIdPoolStatus.GENERATED,
        batchNo: batchNo || `batch_${new Date().toISOString().split('T')[0]}`,
      });
    }

    // 3. 批量插入到池中
    await prisma.shortIdPool.createMany({
      data: poolRecords,
    });

    return generatedIds;
  }

  /**
   * 创建打印任务并生成shortID
   * @param name 任务名称
   * @param count 打印数量
   * @param createdBy 创建人
   * @param notes 备注
   * @returns 打印任务和shortID列表
   */
  async createPrintTask(
    name: string,
    count: number,
    createdBy?: string,
    notes?: string
  ) {
    // 1. 生成shortID
    const shortIds = await this.generateShortIds(count, name);

    // 2. 创建打印任务
    const printTask = await prisma.printTask.create({
      data: {
        name,
        count,
        status: 'PENDING',
        createdBy,
        notes,
      },
    });

    // 3. 关联shortID到打印任务，并标记为PRINTED
    await prisma.shortIdPool.updateMany({
      where: {
        shortId: { in: shortIds },
      },
      data: {
        printTaskId: printTask.id,
        status: ShortIdPoolStatus.PRINTED,
        printedAt: new Date(),
      },
    });

    return {
      printTask,
      shortIds,
    };
  }

  /**
   * 获取打印任务的shortID列表（用于导出CSV/Excel）
   */
  async getPrintTaskShortIds(taskId: string): Promise<{
    task: any;
    shortIds: number[];
  }> {
    const task = await prisma.printTask.findUnique({
      where: { id: taskId },
      include: {
        shortIds: {
          orderBy: { shortId: 'asc' },
        },
      },
    });

    if (!task) {
      throw new Error('打印任务不存在');
    }

    return {
      task,
      shortIds: task.shortIds.map((s) => s.shortId),
    };
  }

  /**
   * 标记打印任务为完成
   */
  async completePrintTask(taskId: string, filePath?: string) {
    return await prisma.printTask.update({
      where: { id: taskId },
      data: {
        status: 'COMPLETED',
        filePath,
        completedAt: new Date(),
      },
    });
  }

  /**
   * 检查shortID是否已被占用
   */
  async checkShortIdExists(
    shortId: number
  ): Promise<{
    exists: boolean;
    usedBy: 'entity' | 'pool' | null;
    entityType?: EntityType;
    details?: any;
  }> {
    // 检查Pool表
    const poolRecord = await prisma.shortIdPool.findFirst({
      where: { shortId },
      select: { id: true, status: true, entityType: true, entityId: true, notes: true, batchNo: true },
    });

    if (poolRecord) {
      return {
        exists: true,
        usedBy: 'pool',
        entityType: poolRecord.entityType || undefined,
        details: poolRecord,
      };
    }

    // 检查所有有 shortId 字段的实体表
    const [panel, cabinet, room] = await Promise.all([
      prisma.panel.findUnique({
        where: { shortId },
        select: { id: true, name: true, type: true },
      }),
      prisma.cabinet.findUnique({
        where: { shortId },
        select: { id: true, name: true },
      }),
      prisma.room.findUnique({
        where: { shortId },
        select: { id: true, name: true },
      }),
    ]);

    if (panel) {
      return { exists: true, usedBy: 'entity', entityType: 'PANEL', details: panel };
    }
    if (cabinet) {
      return { exists: true, usedBy: 'entity', entityType: 'CABINET', details: cabinet };
    }
    if (room) {
      return { exists: true, usedBy: 'entity', entityType: 'ROOM', details: room };
    }

    return {
      exists: false,
      usedBy: null,
    };
  }

  /**
   * 绑定shortID到实体
   */
  async bindShortIdToEntity(
    shortId: number,
    entityType: EntityType,
    entityId: string
  ) {
    await prisma.shortIdPool.updateMany({
      where: {
        shortId,
        status: { not: ShortIdPoolStatus.CANCELLED },
      },
      data: {
        entityType,
        entityId,
        status: ShortIdPoolStatus.BOUND,
        boundAt: new Date(),
      },
    });
  }

  /**
   * 标记shortID为报废
   */
  async cancelShortId(
    shortId: number,
    reason?: string
  ) {
    await prisma.shortIdPool.updateMany({
      where: { shortId },
      data: {
        status: ShortIdPoolStatus.CANCELLED,
        notes: reason || '已报废',
      },
    });
  }

  /**
   * 批量标记shortID为报废
   * @param shortIds shortID数组
   * @param reason 报废原因
   * @returns 报废结果
   */
  async cancelShortIds(
    shortIds: number[],
    reason?: string
  ): Promise<{
    success: number[];
    failed: Array<{ shortId: number; reason: string }>;
  }> {
    const result = {
      success: [] as number[],
      failed: [] as Array<{ shortId: number; reason: string }>,
    };

    // 批量查询所有shortID的状态
    const poolRecords = await prisma.shortIdPool.findMany({
      where: {
        shortId: { in: shortIds },
      },
    });

    const recordMap = new Map(poolRecords.map(r => [r.shortId, r]));

    // 检查每个shortID的状态
    for (const shortId of shortIds) {
      const record = recordMap.get(shortId);

      // 如果不存在或已经是报废状态，记录失败
      if (!record) {
        result.failed.push({
          shortId,
          reason: 'shortID不存在',
        });
        continue;
      }

      if (record.status === ShortIdPoolStatus.CANCELLED) {
        result.failed.push({
          shortId,
          reason: '已经是报废状态',
        });
        continue;
      }

      if (record.status === ShortIdPoolStatus.BOUND) {
        result.failed.push({
          shortId,
          reason: '已绑定到实体，无法直接报废',
        });
        continue;
      }

      result.success.push(shortId);
    }

    // 批量更新成功的shortID
    if (result.success.length > 0) {
      await prisma.shortIdPool.updateMany({
        where: {
          shortId: { in: result.success },
        },
        data: {
          status: ShortIdPoolStatus.CANCELLED,
          notes: reason || '批量报废',
        },
      });
    }

    return result;
  }

  /**
   * 使用范围表达式批量报废shortID
   * @param rangeExpr 范围表达式（例如 "1-5, 8, 10-12" 或 "E-00001-E-00005, E-00008"）
   * @param reason 报废原因
   * @returns 报废结果
   */
  async cancelShortIdsByRange(
    rangeExpr: string,
    reason?: string
  ): Promise<{
    totalRequested: number;
    success: number[];
    failed: Array<{ shortId: number; reason: string }>;
    parsedIds: number[];
  }> {
    // 解析范围表达式
    const parsedIds = ShortIdFormatter.parseRangeExpression(rangeExpr);

    if (parsedIds.length === 0) {
      throw new Error('没有解析到有效的shortID');
    }

    if (parsedIds.length > 1000) {
      throw new Error('一次最多报废1000个shortID');
    }

    // 批量报废
    const result = await this.cancelShortIds(parsedIds, reason);

    return {
      totalRequested: parsedIds.length,
      parsedIds,
      ...result,
    };
  }

  /**
   * 获取池统计信息
   */
  async getPoolStats(entityType?: EntityType): Promise<{
    total: number;
    generated: number;
    printed: number;
    bound: number;
    cancelled: number;
    byType?: Record<string, number>;
  }> {
    const where = entityType ? { entityType } : {};

    const [total, generated, printed, bound, cancelled] = await Promise.all([
      prisma.shortIdPool.count({ where }),
      prisma.shortIdPool.count({ where: { ...where, status: ShortIdPoolStatus.GENERATED } }),
      prisma.shortIdPool.count({ where: { ...where, status: ShortIdPoolStatus.PRINTED } }),
      prisma.shortIdPool.count({ where: { ...where, status: ShortIdPoolStatus.BOUND } }),
      prisma.shortIdPool.count({ where: { ...where, status: ShortIdPoolStatus.CANCELLED } }),
    ]);

    const result: any = { total, generated, printed, bound, cancelled };

    // 如果没有指定类型，统计各类型数量
    if (!entityType) {
      const byTypeRecords = await prisma.shortIdPool.groupBy({
        by: ['entityType'],
        _count: {
          _all: true,
        },
      });

      result.byType = byTypeRecords.reduce((acc, r) => {
        if (r.entityType) {
          acc[r.entityType] = r._count._all;
        }
        return acc;
      }, {} as Record<string, number>);
    }

    return result;
  }

  /**
   * 分配shortID给实体（统一入口）
   * 同时更新GlobalShortIdAllocation和ShortIdPool
   * @param entityType 实体类型
   * @param entityId 实体ID
   * @param specifiedShortId 指定的shortID（可选，如果不指定则从池中分配或自动生成）
   * @returns 分配的shortID
   */
  async allocateShortId(
    entityType: EntityType,
    entityId: string,
    specifiedShortId?: number
  ): Promise<number> {
    return await prisma.$transaction(async (tx) => {
      let shortId: number;

      if (specifiedShortId !== undefined) {
        // 使用指定的shortID
        // 1. 检查ShortIdPool中是否存在且可用
        const poolRecord = await tx.shortIdPool.findFirst({
          where: { shortId: specifiedShortId },
        });

        if (poolRecord) {
          // 池中存在，检查状态
          if (poolRecord.status === ShortIdPoolStatus.BOUND) {
            throw new Error(`ShortID ${specifiedShortId} 已被占用（状态：${poolRecord.status}）`);
          }
          if (poolRecord.status === ShortIdPoolStatus.CANCELLED) {
            throw new Error(`ShortID ${specifiedShortId} 已报废，不可使用`);
          }
        } else {
          // 池中不存在，创建记录
          await tx.shortIdPool.create({
            data: {
              shortId: specifiedShortId,
              status: ShortIdPoolStatus.GENERATED,
              batchNo: `manual_${new Date().toISOString().split('T')[0]}`,
            },
          });
        }

        shortId = specifiedShortId;
      } else {
        // 自动分配：从池中找一个GENERATED或PRINTED状态的shortID
        const availableRecord = await tx.shortIdPool.findFirst({
          where: {
            status: {
              in: [ShortIdPoolStatus.GENERATED, ShortIdPoolStatus.PRINTED],
            },
          },
          orderBy: { shortId: 'asc' },
        });

        if (availableRecord) {
          shortId = availableRecord.shortId;
        } else {
          // 池中没有可用的，自动生成一个新的
          const maxPoolShortId = await tx.shortIdPool.findFirst({
            orderBy: { shortId: 'desc' },
            select: { shortId: true },
          });

          const [cabinet, room, panel, cableEndpoint, globalAllocation] = await Promise.all([
            tx.cabinet.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
            tx.room.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
            tx.panel.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
            tx.cableEndpoint.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
            tx.globalShortIdAllocation.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
          ]);

          const currentMax = Math.max(
            maxPoolShortId?.shortId || 0,
            cabinet?.shortId || 0,
            room?.shortId || 0,
            panel?.shortId || 0,
            cableEndpoint?.shortId || 0,
            globalAllocation?.shortId || 0
          );

          shortId = currentMax + 1;

          // 创建池记录
          await tx.shortIdPool.create({
            data: {
              shortId,
              status: ShortIdPoolStatus.GENERATED,
              batchNo: `auto_${new Date().toISOString().split('T')[0]}`,
            },
          });
        }
      }

      // 更新ShortIdPool状态为BOUND
      await tx.shortIdPool.updateMany({
        where: { shortId },
        data: {
          entityType,
          entityId,
          status: ShortIdPoolStatus.BOUND,
          boundAt: new Date(),
        },
      });

      // 同时更新GlobalShortIdAllocation
      // 先检查是否已存在
      const existingAllocation = await tx.globalShortIdAllocation.findUnique({
        where: { shortId },
      });

      if (!existingAllocation) {
        // 转换EntityType到globalShortIdService的类型
        const globalEntityType = entityType as any;
        await tx.globalShortIdAllocation.create({
          data: {
            shortId,
            entityType: globalEntityType,
            entityId,
          },
        });

        // 更新全局序列
        const sequence = await tx.globalShortIdSequence.findFirst();
        if (sequence && shortId >= sequence.currentValue) {
          await tx.globalShortIdSequence.update({
            where: { id: sequence.id },
            data: { currentValue: shortId + 1 },
          });
        } else if (!sequence) {
          await tx.globalShortIdSequence.create({
            data: { currentValue: shortId + 1 },
          });
        }
      }

      return shortId;
    });
  }

  /**
   * 释放shortID（删除实体时调用）
   * 同时清理GlobalShortIdAllocation和重置ShortIdPool状态
   * @param shortId 要释放的shortID
   */
  async releaseShortId(shortId: number): Promise<void> {
    await prisma.$transaction(async (tx) => {
      // 1. 从GlobalShortIdAllocation中删除
      await tx.globalShortIdAllocation.deleteMany({
        where: { shortId },
      });

      // 2. 重置ShortIdPool状态为GENERATED（可重新使用）
      await tx.shortIdPool.updateMany({
        where: { shortId },
        data: {
          status: ShortIdPoolStatus.GENERATED,
          entityType: null,
          entityId: null,
          boundAt: null,
        },
      });
    });
  }

  /**
   * 获取池记录（分页）
   */
  async getPoolRecords(params: {
    page?: number;
    pageSize?: number;
    entityType?: EntityType;
    status?: ShortIdPoolStatus;
    batchNo?: string;
    search?: string; // 搜索shortID
  }) {
    const { page = 1, pageSize = 50, entityType, status, batchNo, search } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (entityType) where.entityType = entityType;
    if (status) where.status = status;
    if (batchNo) where.batchNo = batchNo;
    if (search) {
      const searchId = parseInt(search, 10);
      if (!isNaN(searchId)) {
        where.shortId = searchId;
      }
    }

    const [records, total] = await Promise.all([
      prisma.shortIdPool.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { shortId: 'desc' },
        include: {
          printTask: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
      }),
      prisma.shortIdPool.count({ where }),
    ]);

    return {
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /**
   * 获取所有打印任务
   */
  async getPrintTasks(params: {
    page?: number;
    pageSize?: number;
    status?: string;
  }) {
    const { page = 1, pageSize = 50, status } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;

    const [records, total] = await Promise.all([
      prisma.printTask.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: { shortIds: true },
          },
        },
      }),
      prisma.printTask.count({ where }),
    ]);

    return {
      records,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}

export const shortIdPoolService = new ShortIdPoolService();
