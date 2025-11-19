import prisma from '../utils/prisma';
import { PortStatus } from '@prisma/client';

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
    return await prisma.port.create({
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
  }

  async createBulkPorts(panelId: string, count: number, prefix: string = 'Port-', useCustomPrefix: boolean = false) {
    const createdPorts = [];

    for (let i = 1; i <= count; i++) {
      let label: string;

      if (useCustomPrefix) {
        // 使用自定义前缀，替换 Var 为序号
        label = prefix.replace(/Var/g, String(i));
      } else {
        // 使用旧的前缀方式
        label = `${prefix}${i}`;
      }

      const port = await this.createPort({
        number: String(i),
        label,
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
        ipAddress: {
          include: {
            subnet: true,
          },
        },
        opticalModule: true,
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
        ipAddress: {
          include: {
            subnet: true,
          },
        },
        opticalModule: true,
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
    return await prisma.port.delete({
      where: { id },
    });
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
