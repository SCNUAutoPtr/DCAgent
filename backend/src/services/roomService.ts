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
  shortId?: number;
  floor?: string;
  dataCenterId?: string;
  floorPlanWidth?: number;
  floorPlanHeight?: number;
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

    // 从data中提取shortId，避免覆盖allocatedShortId
    const { shortId: _, ...roomData } = data;

    // 创建机房
    const room = await prisma.room.create({
      data: {
        ...roomData,
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
    // 如果要更新 shortId，需要处理 shortId 的分配和释放
    if (data.shortId !== undefined) {
      // 获取当前机房的 shortId
      const currentRoom = await prisma.room.findUnique({
        where: { id },
        select: { shortId: true },
      });

      if (!currentRoom) {
        throw new Error('Room not found');
      }

      const oldShortId = currentRoom.shortId;
      const newShortId = data.shortId;

      // 如果 shortId 发生了变化
      if (oldShortId !== newShortId) {
        // 分配新的 shortId
        await shortIdPoolService.allocateShortId('ROOM', id, newShortId);

        // 释放旧的 shortId
        if (oldShortId) {
          await shortIdPoolService.releaseShortId(oldShortId);
        }
      }
    }

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

  // 获取机房的平面图数据（包含机柜和工作站）
  async getFloorPlanData(roomId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        cabinets: {
          include: {
            devices: true,
          },
        },
        workstations: true,
      },
    });

    if (!room) {
      throw new Error('Room not found');
    }

    return {
      room: {
        id: room.id,
        name: room.name,
        floorPlanWidth: room.floorPlanWidth,
        floorPlanHeight: room.floorPlanHeight,
      },
      cabinets: room.cabinets.map(cabinet => ({
        id: cabinet.id,
        name: cabinet.name,
        shortId: cabinet.shortId,
        position: cabinet.floorPlanPosition,
        size: cabinet.floorPlanSize,
        deviceCount: cabinet.devices.length,
      })),
      workstations: room.workstations.map(workstation => ({
        id: workstation.id,
        name: workstation.name,
        code: workstation.code,
        status: workstation.status,
        assignedTo: workstation.assignedTo,
        position: workstation.floorPlanPosition,
        size: workstation.floorPlanSize,
      })),
    };
  }
}

export default new RoomService();
