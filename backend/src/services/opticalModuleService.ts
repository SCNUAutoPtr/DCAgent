import prisma from '../utils/prisma';
import { ModuleStatus, MovementType } from '@prisma/client';

export interface CreateOpticalModuleDto {
  serialNo: string;
  model: string;
  vendor: string;
  moduleType: string; // SFP, SFP_PLUS, QSFP, QSFP28, QSFP_DD
  wavelength?: string;
  distance?: string;
  ddmSupport?: boolean;
  supplier?: string;
  purchaseDate?: Date;
  price?: number;
  warrantyExpiry?: Date;
  notes?: string;
}

export interface UpdateOpticalModuleDto {
  model?: string;
  vendor?: string;
  moduleType?: string;
  wavelength?: string;
  distance?: string;
  ddmSupport?: boolean;
  supplier?: string;
  purchaseDate?: Date;
  price?: number;
  warrantyExpiry?: Date;
  notes?: string;
}

export interface InstallModuleDto {
  portId: string;
  operator?: string;
  notes?: string;
}

export interface TransferModuleDto {
  targetPortId: string;
  operator?: string;
  notes?: string;
}

export interface ScrapModuleDto {
  operator?: string;
  notes?: string;
}

export interface ListModulesQuery {
  status?: ModuleStatus;
  moduleType?: string;
  vendor?: string;
  isInstalled?: boolean;
  search?: string;
}

class OpticalModuleService {
  /**
   * 采购入库：创建新的光模块记录
   */
  async createModule(data: CreateOpticalModuleDto) {
    // 检查序列号是否已存在
    const existing = await prisma.opticalModule.findUnique({
      where: { serialNo: data.serialNo },
    });

    if (existing) {
      throw new Error(`序列号 ${data.serialNo} 已存在`);
    }

    // 创建光模块记录
    const module = await prisma.opticalModule.create({
      data: {
        ...data,
        status: 'IN_STOCK', // 采购入库，默认状态为在库
      },
    });

    // 创建移动历史：采购入库
    await prisma.moduleMovement.create({
      data: {
        moduleId: module.id,
        movementType: 'PURCHASE',
        toPortId: null,
        operator: data.supplier, // 将供应商信息记录为操作人
        notes: `采购入库 - ${data.notes || ''}`,
      },
    });

    return module;
  }

  /**
   * 安装光模块到端口
   */
  async installModule(moduleId: string, installData: InstallModuleDto) {
    const { portId, operator, notes } = installData;

    // 查询光模块
    const module = await prisma.opticalModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new Error('光模块不存在');
    }

    // 检查光模块状态
    if (module.status === 'INSTALLED') {
      throw new Error('光模块已安装，请先卸下');
    }

    if (module.status === 'SCRAPPED') {
      throw new Error('光模块已报废，无法安装');
    }

    // 查询目标端口
    const port = await prisma.port.findUnique({
      where: { id: portId },
      include: {
        opticalModule: true,
        cableEndpoints: true,
      },
    });

    if (!port) {
      throw new Error('端口不存在');
    }

    // 检查端口是否已安装光模块
    if (port.opticalModule) {
      throw new Error('端口已安装光模块，请先卸下现有模块');
    }

    // 检查端口类型和光模块类型是否匹配
    if (port.portType && !this.isModuleTypeCompatible(port.portType, module.moduleType)) {
      throw new Error(`光模块类型 ${module.moduleType} 与端口类型 ${port.portType} 不兼容`);
    }

    // 在事务中执行安装操作
    const result = await prisma.$transaction(async (tx) => {
      // 更新光模块状态和位置
      const updatedModule = await tx.opticalModule.update({
        where: { id: moduleId },
        data: {
          status: 'INSTALLED',
          currentPortId: portId,
        },
      });

      // 更新端口物理状态
      const hasConnectedCable = port.cableEndpoints.length > 0;
      await tx.port.update({
        where: { id: portId },
        data: {
          physicalStatus: hasConnectedCable ? 'CONNECTED' : 'MODULE_ONLY',
        },
      });

      // 创建移动历史
      await tx.moduleMovement.create({
        data: {
          moduleId,
          movementType: 'INSTALL',
          fromPortId: module.currentPortId,
          toPortId: portId,
          operator,
          notes,
        },
      });

      return updatedModule;
    });

    return result;
  }

  /**
   * 从端口卸下光模块
   */
  async uninstallModule(moduleId: string, operator?: string, notes?: string) {
    // 查询光模块
    const module = await prisma.opticalModule.findUnique({
      where: { id: moduleId },
      include: {
        currentPort: {
          include: {
            cableEndpoints: true,
          },
        },
      },
    });

    if (!module) {
      throw new Error('光模块不存在');
    }

    if (module.status !== 'INSTALLED' || !module.currentPortId) {
      throw new Error('光模块未安装，无需卸下');
    }

    // 检查端口是否已连接线缆
    if (module.currentPort?.cableEndpoints && module.currentPort.cableEndpoints.length > 0) {
      throw new Error('端口已连接线缆，请先断开线缆再卸下光模块');
    }

    // 在事务中执行卸下操作
    const result = await prisma.$transaction(async (tx) => {
      // 更新光模块状态
      const updatedModule = await tx.opticalModule.update({
        where: { id: moduleId },
        data: {
          status: 'IN_STOCK',
          currentPortId: null,
        },
      });

      // 更新端口物理状态
      if (module.currentPortId) {
        await tx.port.update({
          where: { id: module.currentPortId },
          data: {
            physicalStatus: 'EMPTY',
          },
        });
      }

      // 创建移动历史
      await tx.moduleMovement.create({
        data: {
          moduleId,
          movementType: 'UNINSTALL',
          fromPortId: module.currentPortId,
          toPortId: null,
          operator,
          notes,
        },
      });

      return updatedModule;
    });

    return result;
  }

  /**
   * 转移光模块到其他端口
   */
  async transferModule(moduleId: string, transferData: TransferModuleDto) {
    const { targetPortId, operator, notes } = transferData;

    // 查询光模块
    const module = await prisma.opticalModule.findUnique({
      where: { id: moduleId },
      include: {
        currentPort: {
          include: {
            cableEndpoints: true,
          },
        },
      },
    });

    if (!module) {
      throw new Error('光模块不存在');
    }

    if (module.status !== 'INSTALLED' || !module.currentPortId) {
      throw new Error('光模块未安装，无法转移');
    }

    if (module.currentPortId === targetPortId) {
      throw new Error('目标端口与当前端口相同');
    }

    // 检查当前端口是否已连接线缆
    if (module.currentPort?.cableEndpoints && module.currentPort.cableEndpoints.length > 0) {
      throw new Error('端口已连接线缆，请先断开线缆再转移光模块');
    }

    // 查询目标端口
    const targetPort = await prisma.port.findUnique({
      where: { id: targetPortId },
      include: {
        opticalModule: true,
      },
    });

    if (!targetPort) {
      throw new Error('目标端口不存在');
    }

    if (targetPort.opticalModule) {
      throw new Error('目标端口已安装光模块');
    }

    // 检查端口类型兼容性
    if (targetPort.portType && !this.isModuleTypeCompatible(targetPort.portType, module.moduleType)) {
      throw new Error(`光模块类型 ${module.moduleType} 与目标端口类型 ${targetPort.portType} 不兼容`);
    }

    // 在事务中执行转移操作
    const result = await prisma.$transaction(async (tx) => {
      // 更新光模块位置
      const updatedModule = await tx.opticalModule.update({
        where: { id: moduleId },
        data: {
          currentPortId: targetPortId,
        },
      });

      // 更新原端口物理状态
      await tx.port.update({
        where: { id: module.currentPortId! },
        data: {
          physicalStatus: 'EMPTY',
        },
      });

      // 更新目标端口物理状态
      await tx.port.update({
        where: { id: targetPortId },
        data: {
          physicalStatus: 'MODULE_ONLY',
        },
      });

      // 创建移动历史
      await tx.moduleMovement.create({
        data: {
          moduleId,
          movementType: 'TRANSFER',
          fromPortId: module.currentPortId,
          toPortId: targetPortId,
          operator,
          notes,
        },
      });

      return updatedModule;
    });

    return result;
  }

  /**
   * 报废光模块
   */
  async scrapModule(moduleId: string, scrapData: ScrapModuleDto) {
    const { operator, notes } = scrapData;

    // 查询光模块
    const module = await prisma.opticalModule.findUnique({
      where: { id: moduleId },
      include: {
        currentPort: {
          include: {
            cableEndpoints: true,
          },
        },
      },
    });

    if (!module) {
      throw new Error('光模块不存在');
    }

    if (module.status === 'SCRAPPED') {
      throw new Error('光模块已报废');
    }

    // 如果已安装，检查是否有连接线缆
    if (module.status === 'INSTALLED' && module.currentPort?.cableEndpoints && module.currentPort.cableEndpoints.length > 0) {
      throw new Error('光模块已连接线缆，请先断开线缆再报废');
    }

    // 在事务中执行报废操作
    const result = await prisma.$transaction(async (tx) => {
      // 更新光模块状态
      const updatedModule = await tx.opticalModule.update({
        where: { id: moduleId },
        data: {
          status: 'SCRAPPED',
          currentPortId: null,
        },
      });

      // 如果有安装在端口上，更新端口状态
      if (module.currentPortId) {
        await tx.port.update({
          where: { id: module.currentPortId },
          data: {
            physicalStatus: 'EMPTY',
          },
        });
      }

      // 创建移动历史
      await tx.moduleMovement.create({
        data: {
          moduleId,
          movementType: 'SCRAP',
          fromPortId: module.currentPortId,
          toPortId: null,
          operator,
          notes,
        },
      });

      return updatedModule;
    });

    return result;
  }

  /**
   * 更新光模块信息
   */
  async updateModule(moduleId: string, data: UpdateOpticalModuleDto) {
    const module = await prisma.opticalModule.update({
      where: { id: moduleId },
      data,
    });

    return module;
  }

  /**
   * 根据ID获取光模块详情
   */
  async getModuleById(moduleId: string) {
    const module = await prisma.opticalModule.findUnique({
      where: { id: moduleId },
      include: {
        currentPort: {
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
    });

    return module;
  }

  /**
   * 根据序列号获取光模块
   */
  async getModuleBySerialNo(serialNo: string) {
    const module = await prisma.opticalModule.findUnique({
      where: { serialNo },
      include: {
        currentPort: {
          include: {
            panel: {
              include: {
                device: true,
              },
            },
          },
        },
      },
    });

    return module;
  }

  /**
   * 查询光模块列表
   */
  async listModules(query: ListModulesQuery = {}) {
    const { status, moduleType, vendor, isInstalled, search } = query;

    const where: any = {};

    if (status) {
      where.status = status;
    }

    if (moduleType) {
      where.moduleType = moduleType;
    }

    if (vendor) {
      where.vendor = { contains: vendor, mode: 'insensitive' };
    }

    if (isInstalled !== undefined) {
      where.currentPortId = isInstalled ? { not: null } : null;
    }

    if (search) {
      where.OR = [
        { serialNo: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { notes: { contains: search, mode: 'insensitive' } },
      ];
    }

    const modules = await prisma.opticalModule.findMany({
      where,
      include: {
        currentPort: {
          include: {
            panel: {
              include: {
                device: {
                  include: {
                    cabinet: {
                      include: {
                        room: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return modules;
  }

  /**
   * 获取光模块的移动历史
   */
  async getModuleHistory(moduleId: string) {
    const movements = await prisma.moduleMovement.findMany({
      where: { moduleId },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // 为每个移动记录补充端口信息
    const enrichedMovements = await Promise.all(
      movements.map(async (movement) => {
        const fromPort = movement.fromPortId
          ? await prisma.port.findUnique({
              where: { id: movement.fromPortId },
              include: {
                panel: {
                  include: {
                    device: true,
                  },
                },
              },
            })
          : null;

        const toPort = movement.toPortId
          ? await prisma.port.findUnique({
              where: { id: movement.toPortId },
              include: {
                panel: {
                  include: {
                    device: true,
                  },
                },
              },
            })
          : null;

        return {
          ...movement,
          fromPort,
          toPort,
        };
      })
    );

    return enrichedMovements;
  }

  /**
   * 删除光模块（仅限未安装的光模块）
   */
  async deleteModule(moduleId: string) {
    const module = await prisma.opticalModule.findUnique({
      where: { id: moduleId },
    });

    if (!module) {
      throw new Error('光模块不存在');
    }

    if (module.status === 'INSTALLED') {
      throw new Error('光模块已安装，无法删除');
    }

    // 删除光模块（会级联删除移动历史）
    return await prisma.opticalModule.delete({
      where: { id: moduleId },
    });
  }

  /**
   * 检查光模块类型和端口类型是否兼容
   */
  private isModuleTypeCompatible(portType: string, moduleType: string): boolean {
    // 标准化类型名称
    const normalizedPortType = portType.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const normalizedModuleType = moduleType.toUpperCase().replace(/[^A-Z0-9]/g, '_');

    // 精确匹配
    if (normalizedPortType === normalizedModuleType) {
      return true;
    }

    // 兼容性规则
    const compatibilityMap: Record<string, string[]> = {
      SFP: ['SFP'],
      SFP_PLUS: ['SFP_PLUS', 'SFP'], // SFP+端口可以使用SFP模块（向下兼容）
      QSFP: ['QSFP'],
      QSFP28: ['QSFP28', 'QSFP'], // QSFP28端口可以使用QSFP模块
      QSFP_DD: ['QSFP_DD'],
    };

    const allowedModules = compatibilityMap[normalizedPortType] || [];
    return allowedModules.includes(normalizedModuleType);
  }

  /**
   * 获取统计信息
   */
  async getStatistics() {
    const [total, inStock, installed, faulty, scrapped] = await Promise.all([
      prisma.opticalModule.count(),
      prisma.opticalModule.count({ where: { status: 'IN_STOCK' } }),
      prisma.opticalModule.count({ where: { status: 'INSTALLED' } }),
      prisma.opticalModule.count({ where: { status: 'FAULTY' } }),
      prisma.opticalModule.count({ where: { status: 'SCRAPPED' } }),
    ]);

    // 按类型统计
    const byType = await prisma.opticalModule.groupBy({
      by: ['moduleType'],
      _count: true,
    });

    // 按厂商统计
    const byVendor = await prisma.opticalModule.groupBy({
      by: ['vendor'],
      _count: true,
    });

    return {
      total,
      byStatus: {
        inStock,
        installed,
        faulty,
        scrapped,
      },
      byType: byType.map((item) => ({
        moduleType: item.moduleType,
        count: item._count,
      })),
      byVendor: byVendor.map((item) => ({
        vendor: item.vendor,
        count: item._count,
      })),
    };
  }
}

export default new OpticalModuleService();
