import { PrismaClient, PanelType } from '@prisma/client';
import { generatePortLayout } from '../utils/panelLayoutGenerator';

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
    // 不允许修改系统模板
    const template = await prisma.panelTemplate.findUnique({ where: { id } });
    if (!template) {
      throw new Error('模板不存在');
    }
    if (template.isSystem) {
      throw new Error('不允许修改系统预设模板');
    }

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
    panelName?: string
  ) {
    const template = await this.getTemplateById(templateId);
    if (!template) {
      throw new Error('模板不存在');
    }

    // 创建面板
    const panel = await prisma.panel.create({
      data: {
        name: panelName || template.name,
        type: template.type,
        deviceId,
        templateId,
        width: template.width,
        height: template.height,
        backgroundColor: template.backgroundColor,
        image: template.image,
        svgPath: template.svgPath,
      },
    });

    // 根据模板的端口定义创建端口
    const portDefinitions = template.portDefinitions as Array<{
      number: string;
      position: { x: number; y: number };
      size: { width: number; height: number };
    }>;

    const ports = await Promise.all(
      portDefinitions.map((portDef) =>
        prisma.port.create({
          data: {
            number: portDef.number,
            panelId: panel.id,
            positionX: portDef.position.x,
            positionY: portDef.position.y,
            width: portDef.size.width,
            height: portDef.size.height,
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
    // 创建虚拟端口数组
    const virtualPorts = Array.from({ length: portCount }, (_, i) => ({
      id: `temp-${i}`,
      number: `${i + 1}`,
      label: null,
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

    // 转换为端口定义格式
    return portsWithLayout.map((port) => ({
      number: port.number,
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
        name: '24口交换机面板',
        type: 'ETHERNET' as PanelType,
        portCount: 24,
        description: '标准24口网络交换机，双行交错排列',
        isSystem: true,
      },
      {
        name: '48口交换机面板',
        type: 'ETHERNET' as PanelType,
        portCount: 48,
        description: '标准48口网络交换机，双行交错排列',
        isSystem: true,
      },
      {
        name: '服务器双网口',
        type: 'ETHERNET' as PanelType,
        portCount: 2,
        description: '标准服务器双网口配置',
        isSystem: true,
      },
      {
        name: '服务器四网口',
        type: 'ETHERNET' as PanelType,
        portCount: 4,
        description: '标准服务器四网口配置',
        isSystem: true,
      },
      {
        name: '24口光纤配线架',
        type: 'FIBER' as PanelType,
        portCount: 24,
        description: 'LC双工光纤配线架',
        isSystem: true,
      },
      {
        name: '8口PDU',
        type: 'POWER' as PanelType,
        portCount: 8,
        description: '标准8口电源分配单元',
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
