import { PrismaClient, Cabinet } from '@prisma/client';

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
    return prisma.cabinet.create({
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
    return prisma.cabinet.delete({
      where: { id },
    });
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
