import { PrismaClient, Room } from '@prisma/client';
import { shortIdPoolService } from './shortIdPoolService';

const prisma = new PrismaClient();

export interface CreateRoomInput {
  name: string;
  shortId: number; // 必须提供shortID
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
    // 使用 shortIdPoolService 分配 shortId
    const allocatedShortId = await shortIdPoolService.allocateShortId('ROOM', '', data.shortId);

    // 创建机房
    const room = await prisma.room.create({
      data: {
        ...data,
        shortId: allocatedShortId,
      },
      include: {
        dataCenter: true,
        cabinets: true,
      },
    });

    // 更新 shortIdPool 中的 entityId
    await prisma.shortIdPool.updateMany({
      where: { shortId: allocatedShortId },
      data: { entityId: room.id },
    });

    return room;
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
    // 先获取机房的shortId
    const room = await prisma.room.findUnique({
      where: { id },
      select: { shortId: true },
    });

    // 删除机房
    const deleted = await prisma.room.delete({
      where: { id },
    });

    // 使用 shortIdPoolService 释放 shortId
    if (room?.shortId) {
      await shortIdPoolService.releaseShortId(room.shortId);
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
