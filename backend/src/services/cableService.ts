import prisma from '../utils/prisma';
import cableGraphService from '../graph/cableGraph';
import { CableType } from '@prisma/client';
import { cableShortIdPoolService } from './cableShortIdPoolService';
import globalShortIdService from './globalShortIdService';

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

export interface ManualInventoryCableDto {
  shortIdA: number;  // 端口A的shortID（扫码输入）
  shortIdB: number;  // 端口B的shortID（扫码输入）
  label?: string;
  type: CableType;
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

    // 分配全局唯一的 shortId
    const shortId = await globalShortIdService.allocate('Cable', cable.id);

    // 更新线缆的 shortId
    const updatedCable = await prisma.cable.update({
      where: { id: cable.id },
      data: { shortId },
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

    // 在图数据库中创建连接关系，并同步线缆信息
    await cableGraphService.createConnection({
      cableId: updatedCable.id,
      portAId,
      portBId,
      cableData: {
        label: updatedCable.label || undefined,
        type: updatedCable.type,
        color: updatedCable.color || undefined,
        length: updatedCable.length || undefined,
        shortId: updatedCable.shortId,
      },
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

    return updatedCable;
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
    // 更新 Prisma 数据库
    const cable = await prisma.cable.update({
      where: { id },
      data,
    });

    // 同步到 Neo4j
    await cableGraphService.syncCableNode(cable.id, {
      type: cable.type,
      label: cable.label,
      color: cable.color,
      length: cable.length,
      shortId: cable.shortId,
    });

    return cable;
  }

  /**
   * 删除线缆（同时删除图数据库中的连接关系）
   */
  async deleteCable(id: string) {
    // 先获取线缆的 shortId
    const cable = await prisma.cable.findUnique({
      where: { id },
      select: { shortId: true },
    });

    // 从图数据库删除连接关系
    await cableGraphService.deleteConnection(id);

    // 删除线缆记录
    const deleted = await prisma.cable.delete({
      where: { id },
    });

    // 释放 shortId
    if (cable?.shortId) {
      await globalShortIdService.release(cable.shortId);
    }

    return deleted;
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

  /**
   * 手动入库：通过扫描线缆两端标签的shortID来创建线缆记录
   * shortIdA 和 shortIdB 是线缆端点的标签（未分配的shortID）
   * 线缆本身会自动分配一个新的shortID
   */
  async manualInventoryCable(data: ManualInventoryCableDto) {
    const { shortIdA, shortIdB, ...cableData } = data;

    // 1. 检查两个shortID是否重复
    if (shortIdA === shortIdB) {
      throw new Error('线缆两端的shortID不能相同');
    }

    // 2. 检查这两个shortID是否已被占用
    const existingA = await globalShortIdService.getEntityByShortId(shortIdA);
    if (existingA) {
      throw new Error(`ShortID ${shortIdA} 已被占用（类型：${existingA.entityType}）`);
    }

    const existingB = await globalShortIdService.getEntityByShortId(shortIdB);
    if (existingB) {
      throw new Error(`ShortID ${shortIdB} 已被占用（类型：${existingB.entityType}）`);
    }

    // 3. 创建线缆记录（状态为INVENTORIED）
    const cable = await prisma.cable.create({
      data: {
        ...cableData,
        inventoryStatus: 'INVENTORIED', // 已入库
      },
    });

    // 4. 分配线缆的全局唯一 shortId
    const cableShortId = await globalShortIdService.allocate('Cable', cable.id);

    // 更新线缆的 shortId
    const updatedCable = await prisma.cable.update({
      where: { id: cable.id },
      data: { shortId: cableShortId },
    });

    // 5. 创建端点A，并分配 shortIdA
    const endpointA = await prisma.cableEndpoint.create({
      data: {
        cableId: cable.id,
        endType: 'A',
        portId: null, // 入库时不连接端口
      },
    });

    // 分配端点A的shortId
    await globalShortIdService.allocate('CableEndpoint', endpointA.id, shortIdA);
    await prisma.cableEndpoint.update({
      where: { id: endpointA.id },
      data: { shortId: shortIdA },
    });

    // 6. 创建端点B，并分配 shortIdB
    const endpointB = await prisma.cableEndpoint.create({
      data: {
        cableId: cable.id,
        endType: 'B',
        portId: null, // 入库时不连接端口
      },
    });

    // 分配端点B的shortId
    await globalShortIdService.allocate('CableEndpoint', endpointB.id, shortIdB);
    await prisma.cableEndpoint.update({
      where: { id: endpointB.id },
      data: { shortId: shortIdB },
    });

    // 7. 返回完整的线缆信息（包含端点）
    return await prisma.cable.findUnique({
      where: { id: cable.id },
      include: {
        endpoints: true,
      },
    });
  }

  /**
   * 检查线缆shortID是否已被使用
   * 用于在打印标签前验证shortID的可用性
   */
  async checkCableShortIdAvailable(shortId: number) {
    const result = await cableShortIdPoolService.checkShortIdExists(shortId);

    if (result.exists) {
      return {
        available: false,
        message: `shortID ${shortId} 已被占用`,
        usedBy: result.usedBy,
        details: result.details,
      };
    }

    return {
      available: true,
      message: `shortID ${shortId} 可用`,
    };
  }

  /**
   * 批量检查多个shortID的可用性
   */
  async checkMultipleShortIds(shortIds: number[]) {
    const results = await Promise.all(
      shortIds.map(async (shortId) => {
        const result = await this.checkCableShortIdAvailable(shortId);
        return {
          shortId,
          ...result,
        };
      })
    );

    const duplicates = results.filter((r) => !r.available);

    if (duplicates.length > 0) {
      return {
        hasConflict: true,
        message: `发现 ${duplicates.length} 个shortID冲突`,
        conflicts: duplicates,
        available: results.filter((r) => r.available),
      };
    }

    return {
      hasConflict: false,
      message: '所有shortID均可用',
      available: results,
    };
  }
}

export default new CableService();

