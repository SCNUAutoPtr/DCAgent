import { PrismaClient, Cabinet } from '@prisma/client';
import { shortIdPoolService } from './shortIdPoolService';

const prisma = new PrismaClient();

export interface CreateCabinetInput {
  name: string;
  shortId: number; // 必须提供shortID
  position?: string;
  height?: number;
  roomId: string;
}

export interface UpdateCabinetInput {
  name?: string;
  shortId?: number;
  position?: string;
  height?: number;
  roomId?: string;
  floorPlanPosition?: { x: number; y: number };
  floorPlanSize?: { width: number; depth: number };
}

class CabinetService {
  async getAllCabinets(): Promise<Cabinet[]> {
    return prisma.cabinet.findMany({
      include: {
        room: {
          include: {
            dataCenter: true,
          },
        },
        devices: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getCabinetById(id: string): Promise<Cabinet | null> {
    return prisma.cabinet.findUnique({
      where: { id },
      include: {
        room: {
          include: {
            dataCenter: true,
          },
        },
        devices: {
          include: {
            panels: {
              include: {
                ports: true,
              },
            },
          },
        },
      },
    });
  }

  async getCabinetByShortId(shortId: number): Promise<Cabinet | null> {
    return prisma.cabinet.findUnique({
      where: { shortId },
      include: {
        room: {
          include: {
            dataCenter: true,
          },
        },
        devices: {
          include: {
            panels: {
              include: {
                ports: true,
              },
            },
          },
        },
      },
    });
  }

  async getCabinetsByRoom(roomId: string): Promise<Cabinet[]> {
    return prisma.cabinet.findMany({
      where: { roomId },
      include: {
        devices: true,
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async createCabinet(data: CreateCabinetInput): Promise<Cabinet> {
    // 使用 shortIdPoolService 分配 shortId
    const allocatedShortId = await shortIdPoolService.allocateShortId('CABINET', '', data.shortId);

    // 从data中提取shortId，避免覆盖allocatedShortId
    const { shortId: _, ...cabinetData } = data;

    // 创建机柜
    const cabinet = await prisma.cabinet.create({
      data: {
        ...cabinetData,
        shortId: allocatedShortId,
      },
      include: {
        room: {
          include: {
            dataCenter: true,
          },
        },
        devices: true,
      },
    });

    // 更新 shortIdPool 中的 entityId
    await prisma.shortIdPool.updateMany({
      where: { shortId: allocatedShortId },
      data: { entityId: cabinet.id },
    });

    return cabinet;
  }

  async updateCabinet(id: string, data: UpdateCabinetInput): Promise<Cabinet> {
    // 如果要更新 shortId，需要处理 shortId 的分配和释放
    if (data.shortId !== undefined) {
      // 获取当前机柜的 shortId
      const currentCabinet = await prisma.cabinet.findUnique({
        where: { id },
        select: { shortId: true },
      });

      if (!currentCabinet) {
        throw new Error('Cabinet not found');
      }

      const oldShortId = currentCabinet.shortId;
      const newShortId = data.shortId;

      // 如果 shortId 发生了变化
      if (oldShortId !== newShortId) {
        // 分配新的 shortId
        await shortIdPoolService.allocateShortId('CABINET', id, newShortId);

        // 释放旧的 shortId
        if (oldShortId) {
          await shortIdPoolService.releaseShortId(oldShortId);
        }
      }
    }

    return prisma.cabinet.update({
      where: { id },
      data: {
        ...data,
        // Json 字段未传时保持原值，和 workstationService 保持一致
        floorPlanPosition: data.floorPlanPosition || undefined,
        floorPlanSize: data.floorPlanSize || undefined,
      },
      include: {
        room: {
          include: {
            dataCenter: true,
          },
        },
        devices: true,
      },
    });
  }

  async deleteCabinet(id: string): Promise<Cabinet> {
    // 先获取机柜的shortId
    const cabinet = await prisma.cabinet.findUnique({
      where: { id },
      select: { shortId: true },
    });

    // 删除机柜
    const deleted = await prisma.cabinet.delete({
      where: { id },
    });

    // 将shortID释放回池中
    if (cabinet?.shortId) {
      await shortIdPoolService.releaseShortId(cabinet.shortId);
    }

    return deleted;
  }

  async searchCabinets(query: string): Promise<Cabinet[]> {
    return prisma.cabinet.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { position: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        room: {
          include: {
            dataCenter: true,
          },
        },
        devices: true,
      },
    });
  }
}

export default new CabinetService();
