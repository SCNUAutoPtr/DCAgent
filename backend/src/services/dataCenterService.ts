import { PrismaClient, DataCenter } from '@prisma/client';
import globalShortIdService from './globalShortIdService';

const prisma = new PrismaClient();

export interface CreateDataCenterInput {
  name: string;
  location?: string;
}

export interface UpdateDataCenterInput {
  name?: string;
  location?: string;
}

class DataCenterService {
  async getAllDataCenters(): Promise<DataCenter[]> {
    return prisma.dataCenter.findMany({
      include: {
        rooms: {
          include: {
            cabinets: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getDataCenterById(id: string): Promise<DataCenter | null> {
    return prisma.dataCenter.findUnique({
      where: { id },
      include: {
        rooms: {
          include: {
            cabinets: {
              include: {
                devices: true,
              },
            },
          },
        },
      },
    });
  }

  async getDataCenterByShortId(shortId: number): Promise<DataCenter | null> {
    return prisma.dataCenter.findUnique({
      where: { shortId },
      include: {
        rooms: {
          include: {
            cabinets: {
              include: {
                devices: true,
              },
            },
          },
        },
      },
    });
  }

  async createDataCenter(data: CreateDataCenterInput): Promise<DataCenter> {
    // 先创建实体
    const dataCenter = await prisma.dataCenter.create({
      data,
      include: {
        rooms: true,
      },
    });

    // 分配全局唯一的 shortId
    const shortId = await globalShortIdService.allocate('DataCenter', dataCenter.id);

    // 更新实体的 shortId
    return prisma.dataCenter.update({
      where: { id: dataCenter.id },
      data: { shortId },
      include: {
        rooms: true,
      },
    });
  }

  async updateDataCenter(id: string, data: UpdateDataCenterInput): Promise<DataCenter> {
    return prisma.dataCenter.update({
      where: { id },
      data,
      include: {
        rooms: true,
      },
    });
  }

  async deleteDataCenter(id: string): Promise<DataCenter> {
    // 先获取实体的 shortId
    const dataCenter = await prisma.dataCenter.findUnique({
      where: { id },
      select: { shortId: true },
    });

    // 删除实体
    const deleted = await prisma.dataCenter.delete({
      where: { id },
    });

    // 释放 shortId
    if (dataCenter?.shortId) {
      await globalShortIdService.release(dataCenter.shortId);
    }

    return deleted;
  }

  async searchDataCenters(query: string): Promise<DataCenter[]> {
    return prisma.dataCenter.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { location: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        rooms: true,
      },
    });
  }
}

export default new DataCenterService();
