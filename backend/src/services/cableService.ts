import prisma from '../utils/prisma';
import cableGraphService from '../graph/cableGraph';
import { CableType } from '@prisma/client';

export interface CreateCableDto {
  label?: string;
  type: CableType;
  length?: number;
  color?: string;
  notes?: string;
  portAId: string;
  portBId: string;
}

export interface UpdateCableDto {
  label?: string;
  type?: CableType;
  length?: number;
  color?: string;
  notes?: string;
}

class CableService {
  /**
   * 创建线缆并建立连接关系
   */
  async createCable(data: CreateCableDto) {
    const { portAId, portBId, ...cableData } = data;

    // 检查端口是否存在
    const portA = await prisma.port.findUnique({
      where: { id: portAId },
      include: { panel: true },
    });
    const portB = await prisma.port.findUnique({
      where: { id: portBId },
      include: { panel: true },
    });

    if (!portA || !portB) {
      throw new Error('One or both ports not found');
    }

    // 检查端口是否已被占用
    if (portA.status === 'OCCUPIED' || portB.status === 'OCCUPIED') {
      throw new Error('One or both ports are already occupied');
    }

    // 创建线缆记录
    const cable = await prisma.cable.create({
      data: cableData,
    });

    // 同步端口和面板信息到Neo4j
    if (portA.panel) {
      await cableGraphService.syncPanelNode(portA.panel.id, portA.panel);
    }
    await cableGraphService.syncPortNode(portAId, {
      ...portA,
      panelId: portA.panelId,
    });

    if (portB.panel) {
      await cableGraphService.syncPanelNode(portB.panel.id, portB.panel);
    }
    await cableGraphService.syncPortNode(portBId, {
      ...portB,
      panelId: portB.panelId,
    });

    // 在图数据库中创建连接关系
    await cableGraphService.createConnection({
      cableId: cable.id,
      portAId,
      portBId,
    });

    // 更新端口状态
    await prisma.port.update({
      where: { id: portAId },
      data: { status: 'OCCUPIED' },
    });
    await prisma.port.update({
      where: { id: portBId },
      data: { status: 'OCCUPIED' },
    });

    return cable;
  }

  /**
   * 获取线缆详情（包含连接的端口信息）
   */
  async getCableById(id: string) {
    const cable = await prisma.cable.findUnique({
      where: { id },
    });

    if (!cable) {
      return null;
    }

    // 从图数据库查询连接关系
    // 这里需要实现一个查询特定线缆的连接端口的方法
    // 简化处理，返回基本信息
    return cable;
  }

  /**
   * 通过 shortId 获取线缆详情
   */
  async getCableByShortId(shortId: number) {
    const cable = await prisma.cable.findUnique({
      where: { shortId },
    });

    if (!cable) {
      return null;
    }

    // 从图数据库查询连接关系
    return cable;
  }

  /**
   * 获取所有线缆
   */
  async getAllCables() {
    return await prisma.cable.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * 搜索线缆（根据标签、颜色、备注）
   */
  async searchCables(query: string) {
    return await prisma.cable.findMany({
      where: {
        OR: [
          { label: { contains: query, mode: 'insensitive' } },
          { color: { contains: query, mode: 'insensitive' } },
          { notes: { contains: query, mode: 'insensitive' } },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  /**
   * 更新线缆信息
   */
  async updateCable(id: string, data: UpdateCableDto) {
    return await prisma.cable.update({
      where: { id },
      data,
    });
  }

  /**
   * 删除线缆（同时删除图数据库中的连接关系）
   */
  async deleteCable(id: string) {
    // 查找连接的端口并释放
    // 这里需要先从图数据库查询连接的端口

    // 从图数据库删除连接关系
    await cableGraphService.deleteConnection(id);

    // 删除线缆记录
    return await prisma.cable.delete({
      where: { id },
    });
  }

  /**
   * 查询端口的连接情况
   */
  async getPortConnection(portId: string) {
    const connectedPortId = await cableGraphService.findConnectedPort(portId);

    if (!connectedPortId) {
      return null;
    }

    const connectedPort = await prisma.port.findUnique({
      where: { id: connectedPortId },
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

    return connectedPort;
  }

  /**
   * 查询面板的所有连接
   */
  async getPanelConnections(panelId: string) {
    return await cableGraphService.findPanelConnections(panelId);
  }

  /**
   * 查询网状拓扑
   */
  async getNetworkTopology(panelId: string, maxDepth: number = 3) {
    return await cableGraphService.findNetworkTopology(panelId, maxDepth);
  }

  /**
   * 获取线缆连接的端点信息（用于扫码跳转）
   * 返回线缆及其连接的两个端口的完整信息（包括所在面板、设备、机柜等层级）
   */
  async getCableEndpoints(cableId: string) {
    // 获取线缆基本信息
    const cable = await prisma.cable.findUnique({
      where: { id: cableId },
    });

    if (!cable) {
      return null;
    }

    // 从图数据库查询连接的两个端口ID
    const portIds = await cableGraphService.getCablePortIds(cableId);

    if (!portIds || portIds.length !== 2) {
      return {
        cable,
        portA: null,
        portB: null,
      };
    }

    // 查询两个端口的完整信息
    const portA = await prisma.port.findUnique({
      where: { id: portIds[0] },
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

    const portB = await prisma.port.findUnique({
      where: { id: portIds[1] },
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

    return {
      cable,
      portA,
      portB,
    };
  }

  /**
   * 通过线缆的 shortId 获取端点信息
   */
  async getCableEndpointsByShortId(shortId: number) {
    const cable = await prisma.cable.findUnique({
      where: { shortId },
    });

    if (!cable) {
      return null;
    }

    return await this.getCableEndpoints(cable.id);
  }
}

export default new CableService();

