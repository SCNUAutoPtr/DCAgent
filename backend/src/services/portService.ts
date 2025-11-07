import prisma from '../utils/prisma';
import { PortStatus } from '@prisma/client';
import globalShortIdService from './globalShortIdService';

export interface CreatePortDto {
  number: string;
  label?: string | null;
  status?: PortStatus;
  panelId: string;
  portType?: string;
  rotation?: number;
  position?: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
}

export interface UpdatePortDto {
  number?: string;
  label?: string | null;
  status?: PortStatus;
  portType?: string;
  rotation?: number;
  position?: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
}

class PortService {
  async createPort(data: CreatePortDto) {
    // 先创建实体
    const port = await prisma.port.create({
      data: {
        ...data,
        status: data.status || PortStatus.AVAILABLE,
      },
      include: {
        panel: {
          include: {
            device: true,
          },
        },
      },
    });

    // 分配全局唯一的 shortId
    const shortId = await globalShortIdService.allocate('Port', port.id);

    // 更新实体的 shortId
    return await prisma.port.update({
      where: { id: port.id },
      data: { shortId },
      include: {
        panel: {
          include: {
            device: true,
          },
        },
      },
    });
  }

  async createBulkPorts(panelId: string, count: number, prefix: string = 'Port-') {
    // 批量创建时，需要逐个分配 shortId
    const createdPorts = [];

    for (let i = 1; i <= count; i++) {
      const port = await this.createPort({
        number: String(i),
        label: `${prefix}${i}`,
        panelId,
        status: PortStatus.AVAILABLE,
      });
      createdPorts.push(port);
    }

    return { count: createdPorts.length };
  }

  async getPortById(id: string) {
    return await prisma.port.findUnique({
      where: { id },
      include: {
        panel: {
          include: {
            device: {
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
              },
            },
          },
        },
        cableEndpoints: {
          include: {
            cable: true,
          },
        },
      },
    });
  }

  async getPortByShortId(shortId: number) {
    return await prisma.port.findUnique({
      where: { shortId },
      include: {
        panel: {
          include: {
            device: {
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
              },
            },
          },
        },
      },
    });
  }

  async getAllPorts() {
    return await prisma.port.findMany({
      include: {
        panel: {
          include: {
            device: true,
          },
        },
      },
      orderBy: [
        { panelId: 'asc' },
        { number: 'asc' },
      ],
    });
  }

  async getPortsByPanel(panelId: string) {
    return await prisma.port.findMany({
      where: { panelId },
      include: {
        cableEndpoints: {
          include: {
            cable: true,
          },
        },
      },
      orderBy: {
        number: 'asc',
      },
    });
  }

  async getPortsByStatus(status: PortStatus) {
    return await prisma.port.findMany({
      where: { status },
      include: {
        panel: {
          include: {
            device: true,
          },
        },
      },
    });
  }

  async updatePort(id: string, data: UpdatePortDto) {
    return await prisma.port.update({
      where: { id },
      data,
      include: {
        panel: {
          include: {
            device: true,
          },
        },
      },
    });
  }

  async updatePortStatus(id: string, status: PortStatus) {
    return await prisma.port.update({
      where: { id },
      data: { status },
      include: {
        panel: true,
      },
    });
  }

  async deletePort(id: string) {
    // 先获取实体的 shortId
    const port = await prisma.port.findUnique({
      where: { id },
      select: { shortId: true },
    });

    // 删除实体
    const deleted = await prisma.port.delete({
      where: { id },
    });

    // 释放 shortId
    if (port?.shortId) {
      await globalShortIdService.release(port.shortId);
    }

    return deleted;
  }

  async searchPorts(query: string) {
    return await prisma.port.findMany({
      where: {
        OR: [
          { number: { contains: query } },
          { label: { contains: query } },
          { panel: { name: { contains: query } } },
          { panel: { device: { name: { contains: query } } } },
        ],
      },
      include: {
        panel: {
          include: {
            device: true,
          },
        },
      },
    });
  }

  async getAvailablePortsByPanel(panelId: string) {
    return await prisma.port.findMany({
      where: {
        panelId,
        status: PortStatus.AVAILABLE,
      },
      orderBy: {
        number: 'asc',
      },
    });
  }
}

export default new PortService();
