import { PrismaClient, Cabinet } from '@prisma/client';
import globalShortIdService from './globalShortIdService';

const prisma = new PrismaClient();

export interface CreateCabinetInput {
  name: string;
  position?: string;
  height?: number;
  roomId: string;
}

export interface UpdateCabinetInput {
  name?: string;
  position?: string;
  height?: number;
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
    // 先创建实体
    const cabinet = await prisma.cabinet.create({
      data,
      include: {
        room: {
          include: {
            dataCenter: true,
          },
        },
        devices: true,
      },
    });

    // 分配全局唯一的 shortId
    const shortId = await globalShortIdService.allocate('Cabinet', cabinet.id);

    // 更新实体的 shortId
    return prisma.cabinet.update({
      where: { id: cabinet.id },
      data: { shortId },
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

  async updateCabinet(id: string, data: UpdateCabinetInput): Promise<Cabinet> {
    return prisma.cabinet.update({
      where: { id },
      data,
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
    // 先获取实体的 shortId
    const cabinet = await prisma.cabinet.findUnique({
      where: { id },
      select: { shortId: true },
    });

    // 删除实体
    const deleted = await prisma.cabinet.delete({
      where: { id },
    });

    // 释放 shortId
    if (cabinet?.shortId) {
      await globalShortIdService.release(cabinet.shortId);
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
