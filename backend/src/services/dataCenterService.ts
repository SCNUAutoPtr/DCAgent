import { PrismaClient, DataCenter } from '@prisma/client';

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

  async createDataCenter(data: CreateDataCenterInput): Promise<DataCenter> {
    return prisma.dataCenter.create({
      data,
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
    return prisma.dataCenter.delete({
      where: { id },
    });
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
