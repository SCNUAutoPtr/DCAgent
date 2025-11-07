import { PrismaClient, Room } from '@prisma/client';
import globalShortIdService from './globalShortIdService';

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

  async getRoomByShortId(shortId: number): Promise<Room | null> {
    return prisma.room.findUnique({
      where: { shortId },
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
    // 先创建实体
    const room = await prisma.room.create({
      data,
      include: {
        dataCenter: true,
        cabinets: true,
      },
    });

    // 分配全局唯一的 shortId
    const shortId = await globalShortIdService.allocate('Room', room.id);

    // 更新实体的 shortId
    return prisma.room.update({
      where: { id: room.id },
      data: { shortId },
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
    // 先获取实体的 shortId
    const room = await prisma.room.findUnique({
      where: { id },
      select: { shortId: true },
    });

    // 删除实体
    const deleted = await prisma.room.delete({
      where: { id },
    });

    // 释放 shortId
    if (room?.shortId) {
      await globalShortIdService.release(room.shortId);
    }

    return deleted;
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
