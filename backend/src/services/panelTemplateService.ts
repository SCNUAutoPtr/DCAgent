import { PrismaClient, PanelType } from '@prisma/client';
import { generatePortLayout } from '../utils/panelLayoutGenerator';
import { PortType as PortTypeEnum } from '../constants/portSizes';
import { shortIdPoolService } from './shortIdPoolService';

const prisma = new PrismaClient();

export interface PanelTemplateData {
  name: string;
  type: PanelType;
  portCount: number;
  description?: string;
  width?: number;
  height?: number;
  layoutConfig?: any;
  portDefinitions?: any;
  backgroundColor?: string;
  image?: string;
  svgPath?: string;
  isSystem?: boolean;
}

/**
 * 面板模板服务
 */
export class PanelTemplateService {
  /**
   * 获取所有模板
   */
  async getAllTemplates(type?: PanelType) {
    return await prisma.panelTemplate.findMany({
      where: type ? { type } : undefined,
      orderBy: [
        { isSystem: 'desc' }, // 系统模板优先
        { type: 'asc' },
        { portCount: 'asc' },
      ],
    });
  }

  /**
   * 根据ID获取模板
   */
  async getTemplateById(id: string) {
    return await prisma.panelTemplate.findUnique({
      where: { id },
      include: {
        panels: {
          include: {
            device: true,
          },
        },
      },
    });
  }

  /**
   * 创建模板
   */
  async createTemplate(data: PanelTemplateData) {
    // 如果没有提供端口定义，自动生成
    let portDefinitions = data.portDefinitions;
    if (!portDefinitions) {
      portDefinitions = this.generatePortDefinitions(data.type, data.portCount);
    }

    return await prisma.panelTemplate.create({
      data: {
        name: data.name,
        type: data.type,
        portCount: data.portCount,
        description: data.description,
        width: data.width || 482.6,
        height: data.height || 44.45,
        layoutConfig: data.layoutConfig || {},
        portDefinitions,
        backgroundColor: data.backgroundColor,
        image: data.image,
        svgPath: data.svgPath,
        isSystem: data.isSystem || false,
      },
    });
  }

  /**
   * 更新模板
   */
  async updateTemplate(id: string, data: Partial<PanelTemplateData>) {
    // 检查模板是否存在
    const template = await prisma.panelTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new Error('模板不存在');
    }
    // 允许编辑系统模板的布局和样式，但会保留 isSystem 标记

    return await prisma.panelTemplate.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        backgroundColor: data.backgroundColor,
        image: data.image,
        svgPath: data.svgPath,
        // 如果修改了端口数量或布局配置，重新生成端口定义
        ...(data.portCount && {
          portCount: data.portCount,
          portDefinitions: this.generatePortDefinitions(template.type, data.portCount),
        }),
        ...(data.layoutConfig && { layoutConfig: data.layoutConfig }),
        // 如果直接传了端口定义，使用传入的定义（来自可视化编辑器）
        ...(data.portDefinitions && { portDefinitions: data.portDefinitions }),
      },
    });
  }

  /**
   * 删除模板
   */
  async deleteTemplate(id: string) {
    // 不允许删除系统模板
    const template = await prisma.panelTemplate.findUnique({ where: { id } });
    if (template?.isSystem) {
      throw new Error('不允许删除系统预设模板');
    }

    // 检查是否有面板在使用
    const panelCount = await prisma.panel.count({
      where: { templateId: id },
    });

    if (panelCount > 0) {
      throw new Error(`有 ${panelCount} 个面板正在使用此模板，无法删除`);
    }

    return await prisma.panelTemplate.delete({ where: { id } });
  }

  /**
   * 从模板创建面板（带端口）
   */
  async createPanelFromTemplate(
    templateId: string,
    deviceId: string,
    panelName?: string,
    shortId?: number
  ) {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error('模板不存在');
    }

    // 如果提供了shortId，分配并验证
    let allocatedShortId: number | undefined = undefined;
    if (shortId) {
      allocatedShortId = await shortIdPoolService.allocateShortId('PANEL', '', shortId);
    }

    // 创建面板
    const panel = await prisma.panel.create({
      data: {
        name: panelName || template.name,
        type: template.type,
        deviceId,
        templateId,
        shortId: allocatedShortId,
        size: {
          width: template.width,
          height: template.height,
        },
        backgroundColor: template.backgroundColor,
        image: template.image,
        svgPath: template.svgPath,
      },
    });

    // 如果分配了shortId，更新shortIdPool的entityId
    if (allocatedShortId) {
      await prisma.shortIdPool.updateMany({
        where: { shortId: allocatedShortId },
        data: { entityId: panel.id },
      });
    }

    // 根据模板的端口定义创建端口
    const portDefinitions = template.portDefinitions as Array<{
      number: string;
      portType?: string; // 端口类型
      position: { x: number; y: number };
      size: { width: number; height: number };
      label?: string; // 端口标签
    }>;

    const ports = await Promise.all(
      portDefinitions.map((portDef) =>
        prisma.port.create({
          data: {
            number: portDef.number,
            panelId: panel.id,
            portType: portDef.portType, // 保存端口类型
            label: portDef.label, // 保存端口标签
            position: portDef.position, // JSON 对象 {x, y}
            size: portDef.size, // JSON 对象 {width, height}
          },
        })
      )
    );

    return { panel, ports };
  }

  /**
   * 解绑面板与模板（自定义）
   */
  async unbindPanelFromTemplate(panelId: string) {
    return await prisma.panel.update({
      where: { id: panelId },
      data: {
        templateId: null,
        isCustomized: true,
      },
    });
  }

  /**
   * 生成端口定义（使用现有的布局生成器）
   */
  private generatePortDefinitions(type: PanelType, portCount: number) {
    // 根据面板类型确定默认端口类型
    const getDefaultPortType = (panelType: PanelType): string => {
      switch (panelType) {
        case 'NETWORK': return PortTypeEnum.RJ45;  // 网络面板默认RJ45
        case 'POWER': return PortTypeEnum.POWER_C13;
        case 'CONSOLE': return PortTypeEnum.SERIAL;
        case 'USB': return PortTypeEnum.USB_A;
        case 'MIXED': return PortTypeEnum.RJ45;  // 混合面板默认RJ45
        default: return PortTypeEnum.RJ45;
      }
    };

    const defaultPortType = getDefaultPortType(type);

    // 创建虚拟端口数组 - 添加portType
    const virtualPorts = Array.from({ length: portCount }, (_, i) => ({
      id: `temp-${i}`,
      number: `${i + 1}`,
      label: null,
      portType: defaultPortType, // 添加默认端口类型
      status: 'AVAILABLE' as const,
      panelId: 'temp',
      positionX: null,
      positionY: null,
      width: null,
      height: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }));

    // 创建虚拟面板
    const virtualPanel = {
      id: 'temp',
      name: 'temp',
      type,
      deviceId: 'temp',
      templateId: null,
      isCustomized: false,
      positionX: null,
      positionY: null,
      width: 482.6,
      height: 44.45,
      backgroundColor: null,
      image: null,
      svgPath: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // 使用布局生成器计算位置
    const portsWithLayout = generatePortLayout(virtualPorts, virtualPanel);

    // 转换为端口定义格式 - 包含portType
    return portsWithLayout.map((port) => ({
      number: port.number,
      portType: port.portType || defaultPortType, // 保存端口类型
      position: {
        x: port.position?.x || 0,
        y: port.position?.y || 0,
      },
      size: {
        width: port.size?.width || 15,
        height: port.size?.height || 12,
      },
    }));
  }

  /**
   * 初始化系统预设模板
   */
  async initializeSystemTemplates() {
    const systemTemplates = [
      {
        name: '24口RJ45交换机',
        type: 'NETWORK' as PanelType,
        portCount: 24,
        description: '标准24口RJ45网络交换机，双行交错排列',
        isSystem: true,
      },
      {
        name: '48口RJ45交换机',
        type: 'NETWORK' as PanelType,
        portCount: 48,
        description: '标准48口RJ45网络交换机，双行交错排列',
        isSystem: true,
      },
      {
        name: '24口SFP+光纤交换机',
        type: 'NETWORK' as PanelType,
        portCount: 24,
        description: '24口SFP+光模块交换机，高密度排列',
        isSystem: true,
      },
      {
        name: '服务器双网口',
        type: 'NETWORK' as PanelType,
        portCount: 2,
        description: '标准服务器双RJ45网口配置',
        isSystem: true,
      },
      {
        name: '服务器四网口',
        type: 'NETWORK' as PanelType,
        portCount: 4,
        description: '标准服务器四RJ45网口配置',
        isSystem: true,
      },
      {
        name: '24口LC光纤配线架',
        type: 'NETWORK' as PanelType,
        portCount: 24,
        description: 'LC双工光纤配线架',
        isSystem: true,
      },
      {
        name: '8口PDU电源分配',
        type: 'POWER' as PanelType,
        portCount: 8,
        description: '标准8口C13电源分配单元',
        isSystem: true,
      },
      {
        name: '16口PDU电源分配',
        type: 'POWER' as PanelType,
        portCount: 16,
        description: '16口C13电源分配单元',
        isSystem: true,
      },
      {
        name: '串口控制台面板',
        type: 'CONSOLE' as PanelType,
        portCount: 16,
        description: '16口DB9串口控制台面板',
        isSystem: true,
      },
    ];

    for (const templateData of systemTemplates) {
      // 检查是否已存在
      const existing = await prisma.panelTemplate.findFirst({
        where: {
          name: templateData.name,
          isSystem: true,
        },
      });

      if (!existing) {
        await this.createTemplate(templateData);
      }
    }
  }
}

export const panelTemplateService = new PanelTemplateService();
