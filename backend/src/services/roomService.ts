import { PrismaClient, Room } from '@prisma/client';

const prisma = new PrismaClient();

export interface CreateRoomInput {
  name: string;
  floor?: string;
  dataCenterId: string;
}

export interface UpdateRoomInput {
  name?: string;
  floor?: string;
}

class RoomService {
  async getAllRooms(): Promise<Room[]> {
    return prisma.room.findMany({
      include: {
        dataCenter: true,
        cabinets: {
          include: {
            devices: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getRoomById(id: string): Promise<Room | null> {
    return prisma.room.findUnique({
      where: { id },
      include: {
        dataCenter: true,
        cabinets: {
          include: {
            devices: true,
          },
        },
      },
    });
  }

  async getRoomsByDataCenter(dataCenterId: string): Promise<Room[]> {
    return prisma.room.findMany({
      where: { dataCenterId },
      include: {
        cabinets: {
          include: {
            devices: true,
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async createRoom(data: CreateRoomInput): Promise<Room> {
    return prisma.room.create({
      data,
      include: {
        dataCenter: true,
        cabinets: true,
      },
    });
  }

  async updateRoom(id: string, data: UpdateRoomInput): Promise<Room> {
    return prisma.room.update({
      where: { id },
      data,
      include: {
        dataCenter: true,
        cabinets: true,
      },
    });
  }

  async deleteRoom(id: string): Promise<Room> {
    return prisma.room.delete({
      where: { id },
    });
  }

  async searchRooms(query: string): Promise<Room[]> {
    return prisma.room.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { floor: { contains: query, mode: 'insensitive' } },
        ],
      },
      include: {
        dataCenter: true,
        cabinets: true,
      },
    });
  }
}

export default new RoomService();
