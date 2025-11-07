import prisma from '../utils/prisma';
import { DeviceType } from '@prisma/client';
import globalShortIdService from './globalShortIdService';

export interface CreateDeviceDto {
  name: string;
  type: DeviceType;
  model?: string;
  serialNo?: string;
  uPosition?: number;
  uHeight?: number;
  cabinetId: string;
}

export interface UpdateDeviceDto {
  name?: string;
  type?: DeviceType;
  model?: string;
  serialNo?: string;
  uPosition?: number;
  uHeight?: number;
}

class DeviceService {
  async createDevice(data: CreateDeviceDto) {
    // 先创建实体
    const device = await prisma.device.create({
      data,
      include: {
        cabinet: true,
        panels: true,
      },
    });

    // 分配全局唯一的 shortId
    const shortId = await globalShortIdService.allocate('Device', device.id);

    // 更新实体的 shortId
    return await prisma.device.update({
      where: { id: device.id },
      data: { shortId },
      include: {
        cabinet: true,
        panels: true,
      },
    });
  }

  async getDeviceById(id: string) {
    return await prisma.device.findUnique({
      where: { id },
      include: {
        cabinet: {
          include: {
            room: {
              include: {
                dataCenter: true,
              },
            },
          },
        },
        panels: {
          include: {
            ports: true,
          },
        },
      },
    });
  }

  async getDeviceByShortId(shortId: number) {
    return await prisma.device.findUnique({
      where: { shortId },
      include: {
        cabinet: {
          include: {
            room: {
              include: {
                dataCenter: true,
              },
            },
          },
        },
        panels: {
          include: {
            ports: true,
          },
        },
      },
    });
  }

  async getAllDevices() {
    return await prisma.device.findMany({
      include: {
        cabinet: true,
        panels: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getDevicesByCabinet(cabinetId: string) {
    return await prisma.device.findMany({
      where: { cabinetId },
      include: {
        panels: {
          include: {
            ports: true,
          },
        },
      },
      orderBy: {
        uPosition: 'asc',
      },
    });
  }

  async updateDevice(id: string, data: UpdateDeviceDto) {
    return await prisma.device.update({
      where: { id },
      data,
      include: {
        cabinet: true,
        panels: true,
      },
    });
  }

  async deleteDevice(id: string) {
    // 先获取实体的 shortId
    const device = await prisma.device.findUnique({
      where: { id },
      select: { shortId: true },
    });

    // 删除实体
    const deleted = await prisma.device.delete({
      where: { id },
    });

    // 释放 shortId
    if (device?.shortId) {
      await globalShortIdService.release(device.shortId);
    }

    return deleted;
  }

  async searchDevices(query: string) {
    return await prisma.device.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { model: { contains: query } },
          { serialNo: { contains: query } },
        ],
      },
      include: {
        cabinet: true,
        panels: true,
      },
    });
  }

  async bulkCreateDevices(devices: CreateDeviceDto[]) {
    const results = {
      success: [] as any[],
      failed: [] as { index: number; data: CreateDeviceDto; error: string }[],
    };

    for (let i = 0; i < devices.length; i++) {
      try {
        const device = await this.createDevice(devices[i]);
        results.success.push(device);
      } catch (error: any) {
        results.failed.push({
          index: i + 1,
          data: devices[i],
          error: error.message,
        });
      }
    }

    return results;
  }
}

export default new DeviceService();
