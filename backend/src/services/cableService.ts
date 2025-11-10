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
  // 可选的线缆端点 shortId（来自预打印的标签）
  shortIdA?: number;
  shortIdB?: number;
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
   * 支持两种模式：
   * 1. 使用预分配的 shortId（从标签池）
   * 2. 自动分配 shortId（从全局序列）
   */
  async createCable(data: CreateCableDto) {
    const { portAId, portBId, shortIdA, shortIdB, ...cableData } = data;

    // 检查端口是否存在，并加载光模块信息
    const portA = await prisma.port.findUnique({
      where: { id: portAId },
      include: {
        panel: true,
        opticalModule: true,
      },
    });
    const portB = await prisma.port.findUnique({
      where: { id: portBId },
      include: {
        panel: true,
        opticalModule: true,
      },
    });

    if (!portA || !portB) {
      throw new Error('One or both ports not found');
    }

    // 检查端口是否已被占用
    if (portA.status === 'OCCUPIED' || portB.status === 'OCCUPIED') {
      throw new Error('One or both ports are already occupied');
    }

    // 验证线缆类型和端口的兼容性
    this.validateCableConnection(portA, cableData.type);
    this.validateCableConnection(portB, cableData.type);

    // 创建线缆记录
    const cable = await prisma.cable.create({
      data: {
        ...cableData,
        inventoryStatus: 'IN_USE', // 直接连接端口，状态为使用中
      },
    });

    // === 处理端点 A ===
    let finalShortIdA: number;

    if (shortIdA !== undefined) {
      // 使用提供的 shortId（从标签池）
      const poolA = await prisma.shortIdPool.findUnique({
        where: { shortId: shortIdA },
      });
      if (!poolA || poolA.status !== 'GENERATED') {
        throw new Error(`ShortID ${shortIdA} 不可用`);
      }
      finalShortIdA = shortIdA;
    } else {
      // 自动分配 shortId
      finalShortIdA = await globalShortIdService.allocate(
        'CableEndpoint',
        '', // 临时占位，创建 endpoint 后会更新
      );
    }

    // 创建端点 A
    const endpointA = await prisma.cableEndpoint.create({
      data: {
        cableId: cable.id,
        endType: 'A',
        portId: portAId,
        shortId: finalShortIdA,
      },
    });

    // 分配/更新到全局系统
    if (shortIdA !== undefined) {
      // 使用指定的 shortId
      await globalShortIdService.allocate('CableEndpoint', endpointA.id, finalShortIdA);
      // 更新标签池状态
      await prisma.shortIdPool.update({
        where: { shortId: finalShortIdA },
        data: {
          status: 'BOUND',
          entityType: 'CABLE_ENDPOINT',
          entityId: endpointA.id,
          boundAt: new Date(),
        },
      });
    } else {
      // 更新自动分配的记录，补充正确的 entityId
      await prisma.globalShortIdAllocation.updateMany({
        where: {
          shortId: finalShortIdA,
          entityType: 'CableEndpoint',
        },
        data: {
          entityId: endpointA.id,
        },
      });
    }

    // === 处理端点 B ===
    let finalShortIdB: number;

    if (shortIdB !== undefined) {
      // 使用提供的 shortId（从标签池）
      const poolB = await prisma.shortIdPool.findUnique({
        where: { shortId: shortIdB },
      });
      if (!poolB || poolB.status !== 'GENERATED') {
        throw new Error(`ShortID ${shortIdB} 不可用`);
      }
      finalShortIdB = shortIdB;
    } else {
      // 自动分配 shortId
      finalShortIdB = await globalShortIdService.allocate(
        'CableEndpoint',
        '', // 临时占位
      );
    }

    // 创建端点 B
    const endpointB = await prisma.cableEndpoint.create({
      data: {
        cableId: cable.id,
        endType: 'B',
        portId: portBId,
        shortId: finalShortIdB,
      },
    });

    // 分配/更新到全局系统
    if (shortIdB !== undefined) {
      await globalShortIdService.allocate('CableEndpoint', endpointB.id, finalShortIdB);
      await prisma.shortIdPool.update({
        where: { shortId: finalShortIdB },
        data: {
          status: 'BOUND',
          entityType: 'CABLE_ENDPOINT',
          entityId: endpointB.id,
          boundAt: new Date(),
        },
      });
    } else {
      await prisma.globalShortIdAllocation.updateMany({
        where: {
          shortId: finalShortIdB,
          entityType: 'CableEndpoint',
        },
        data: {
          entityId: endpointB.id,
        },
      });
    }

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
      cableId: cable.id,
      portAId,
      portBId,
      cableData: {
        label: cable.label || undefined,
        type: cable.type,
        color: cable.color || undefined,
        length: cable.length || undefined,
      },
    });

    // 更新端口状态和物理状态
    await prisma.port.update({
      where: { id: portAId },
      data: {
        status: 'OCCUPIED',
        physicalStatus: 'CONNECTED',
      },
    });
    await prisma.port.update({
      where: { id: portBId },
      data: {
        status: 'OCCUPIED',
        physicalStatus: 'CONNECTED',
      },
    });

    // 返回完整的线缆信息（包含端点）
    return await prisma.cable.findUnique({
      where: { id: cable.id },
      include: {
        endpoints: true,
      },
    });
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
    });

    return cable;
  }

  /**
   * 删除线缆（同时删除图数据库中的连接关系）
   */
  async deleteCable(id: string) {
    // 从图数据库删除连接关系
    await cableGraphService.deleteConnection(id);

    // 删除线缆记录
    return await prisma.cable.delete({
      where: { id },
    });
  }

  /**
   * 查询端口的连接情况
   * 返回连接的端口、线缆和端点信息（包括端点shortID）
   */
  async getPortConnection(portId: string) {
    // 查找连接到该端口的线缆端点
    const endpoint = await prisma.cableEndpoint.findFirst({
      where: { portId },
      include: {
        cable: {
          include: {
            endpoints: true,
          },
        },
      },
    });

    if (!endpoint) {
      return null;
    }

    // 查找连接的另一个端点
    const otherEndpoint = endpoint.cable.endpoints.find(
      e => e.id !== endpoint.id
    );

    if (!otherEndpoint || !otherEndpoint.portId) {
      return {
        cable: endpoint.cable,
        thisEndpoint: endpoint,
        otherEndpoint: otherEndpoint || null,
        connectedPort: null,
      };
    }

    // 查询另一端的端口完整信息
    const connectedPort = await prisma.port.findUnique({
      where: { id: otherEndpoint.portId },
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
      cable: endpoint.cable,
      thisEndpoint: endpoint,
      otherEndpoint,
      connectedPort,
    };
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
   * 返回线缆及其端点的完整信息（包括端点shortID和连接的端口信息）
   */
  async getCableEndpoints(cableId: string) {
    // 获取线缆及其端点
    const cable = await prisma.cable.findUnique({
      where: { id: cableId },
      include: {
        endpoints: {
          include: {
            port: {
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
            },
          },
        },
      },
    });

    if (!cable) {
      return null;
    }

    // 查找A端和B端
    const endpointA = cable.endpoints.find(e => e.endType === 'A');
    const endpointB = cable.endpoints.find(e => e.endType === 'B');

    return {
      cable,
      endpointA: endpointA || null,
      endpointB: endpointB || null,
      // 兼容旧接口
      portA: endpointA?.port || null,
      portB: endpointB?.port || null,
    };
  }

  /**
   * 根据 shortId 获取线缆端点信息
   * 用于扫码跳转
   */
  async getCableEndpointsByShortId(shortId: number) {
    // 查找该 shortId 对应的端点
    const endpoint = await prisma.cableEndpoint.findUnique({
      where: { shortId },
      include: {
        cable: {
          include: {
            endpoints: {
              include: {
                port: {
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
                },
              },
            },
          },
        },
      },
    });

    if (!endpoint) {
      return null;
    }

    // 查找A端和B端
    const endpointA = endpoint.cable.endpoints.find(e => e.endType === 'A');
    const endpointB = endpoint.cable.endpoints.find(e => e.endType === 'B');

    return {
      cable: endpoint.cable,
      endpointA: endpointA || null,
      endpointB: endpointB || null,
      // 兼容旧接口
      portA: endpointA?.port || null,
      portB: endpointB?.port || null,
    };
  }


  /**
   * 手动入库：通过扫描线缆两端标签的shortID来创建线缆记录
   * shortIdA 和 shortIdB 是线缆端点的标签（从ShortIdPool预分配的shortID）
   * 线缆本身通过两端端口可以唯一确定，不需要独立的shortID
   */
  async manualInventoryCable(data: ManualInventoryCableDto) {
    const { shortIdA, shortIdB, ...cableData } = data;

    // 1. 检查两个shortID是否重复
    if (shortIdA === shortIdB) {
      throw new Error('线缆两端的shortID不能相同');
    }

    // 2. 检查这两个shortID是否在shortID池中可用
    const poolA = await prisma.shortIdPool.findUnique({
      where: { shortId: shortIdA },
    });
    if (!poolA || poolA.status !== 'GENERATED') {
      throw new Error(`ShortID ${shortIdA} 不可用或不存在于标签池中`);
    }

    const poolB = await prisma.shortIdPool.findUnique({
      where: { shortId: shortIdB },
    });
    if (!poolB || poolB.status !== 'GENERATED') {
      throw new Error(`ShortID ${shortIdB} 不可用或不存在于标签池中`);
    }

    // 3. 创建线缆记录（状态为INVENTORIED）
    const cable = await prisma.cable.create({
      data: {
        ...cableData,
        inventoryStatus: 'INVENTORIED', // 已入库
      },
    });

    // 4. 创建端点A，并关联 shortIdA
    const endpointA = await prisma.cableEndpoint.create({
      data: {
        cableId: cable.id,
        endType: 'A',
        portId: null, // 入库时不连接端口
        shortId: shortIdA,
      },
    });

    // 分配到全局 shortId 系统（使用指定的 shortId）
    await globalShortIdService.allocate('CableEndpoint', endpointA.id, shortIdA);

    // 标记shortIdA为已绑定
    await prisma.shortIdPool.update({
      where: { shortId: shortIdA },
      data: {
        status: 'BOUND',
        entityType: 'CABLE_ENDPOINT',
        entityId: endpointA.id,
        boundAt: new Date(),
      },
    });

    // 5. 创建端点B，并关联 shortIdB
    const endpointB = await prisma.cableEndpoint.create({
      data: {
        cableId: cable.id,
        endType: 'B',
        portId: null, // 入库时不连接端口
        shortId: shortIdB,
      },
    });

    // 分配到全局 shortId 系统（使用指定的 shortId）
    await globalShortIdService.allocate('CableEndpoint', endpointB.id, shortIdB);

    // 标记shortIdB为已绑定
    await prisma.shortIdPool.update({
      where: { shortId: shortIdB },
      data: {
        status: 'BOUND',
        entityType: 'CABLE_ENDPOINT',
        entityId: endpointB.id,
        boundAt: new Date(),
      },
    });

    // 6. 返回完整的线缆信息（包含端点）
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

  /**
   * 验证线缆连接的兼容性
   * 根据线缆类型和端口类型判断是否需要光模块
   */
  private validateCableConnection(port: any, cableType: CableType): void {
    // DAC 直连线缆：不需要光模块，可直接连接
    if (this.isDACCable(cableType)) {
      // DAC 线缆应该只连接到支持的端口类型
      const supportedTypes = ['SFP', 'SFP_PLUS', 'QSFP', 'QSFP28', 'QSFP_DD'];
      if (port.portType && !supportedTypes.includes(port.portType)) {
        throw new Error(`端口类型 ${port.portType} 不支持 DAC 线缆`);
      }
      return;
    }

    // 光纤线缆：必须先安装光模块
    if (this.isFiberCable(cableType)) {
      if (!port.opticalModule) {
        throw new Error(`端口 ${port.number} 未安装光模块，无法连接光纤线缆。请先安装光模块。`);
      }

      if (port.opticalModule.status === 'FAULTY') {
        throw new Error(`端口 ${port.number} 的光模块状态为故障，无法连接线缆`);
      }

      if (port.opticalModule.status === 'SCRAPPED') {
        throw new Error(`端口 ${port.number} 的光模块已报废，无法连接线缆`);
      }
    }

    // RJ45 网线：连接到 RJ45 端口，不需要光模块
    if (this.isEthernetCable(cableType)) {
      if (port.portType && port.portType !== 'RJ45') {
        throw new Error(`端口类型 ${port.portType} 不支持以太网线缆`);
      }
    }
  }

  /**
   * 判断是否为 DAC 直连线缆
   */
  private isDACCable(cableType: CableType): boolean {
    return ['SFP_TO_SFP', 'QSFP_TO_QSFP', 'QSFP_TO_SFP'].includes(cableType);
  }

  /**
   * 判断是否为光纤线缆
   */
  private isFiberCable(cableType: CableType): boolean {
    return ['FIBER_SM', 'FIBER_MM'].includes(cableType);
  }

  /**
   * 判断是否为以太网线缆
   */
  private isEthernetCable(cableType: CableType): boolean {
    return ['CAT5E', 'CAT6', 'CAT6A', 'CAT7'].includes(cableType);
  }
}

export default new CableService();

