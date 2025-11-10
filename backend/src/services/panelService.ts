import prisma from '../utils/prisma';
import { PanelType } from '@prisma/client';
import { shortIdPoolService } from './shortIdPoolService';

export interface CreatePanelDto {
  name: string;
  type: PanelType;
  shortId: number; // 必须提供shortID
  deviceId: string;
  // 模板相关
  templateId?: string;
  isCustomized?: boolean;
  // 物理布局
  position?: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
  // 视觉样式
  backgroundColor?: string | null;
  image?: string | null;
  svgPath?: string | null;
}

export interface UpdatePanelDto {
  name?: string;
  type?: PanelType;
  shortId?: number | null; // 面板shortID
  // 模板相关
  templateId?: string | null;
  isCustomized?: boolean;
  // 物理布局
  position?: {
    x: number;
    y: number;
  };
  size?: {
    width: number;
    height: number;
  };
  // 视觉样式
  backgroundColor?: string | null;
  image?: string | null;
  svgPath?: string | null;
}

class PanelService {
  async createPanel(data: CreatePanelDto) {
    // 验证shortId是否可用
    const existingCheck = await shortIdPoolService.checkShortIdExists(data.shortId);
    if (existingCheck.exists) {
      throw new Error(`ShortID ${data.shortId} 已被占用: ${existingCheck.usedBy === 'pool' ? '在标签池中' : '已绑定到实体'}`);
    }

    // 创建面板
    const panel = await prisma.panel.create({
      data,
      include: {
        device: true,
        ports: true,
      },
    });

    // 绑定shortID到池中
    await shortIdPoolService.bindShortIdToEntity(data.shortId, 'PANEL', panel.id);

    return panel;
  }

  async getPanelById(id: string) {
    return await prisma.panel.findUnique({
      where: { id },
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
        ports: {
          orderBy: {
            number: 'asc',
          },
        },
      },
    });
  }

  async getPanelByShortId(shortId: number) {
    return await prisma.panel.findUnique({
      where: { shortId },
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
        ports: {
          orderBy: {
            number: 'asc',
          },
        },
      },
    });
  }

  async getAllPanels() {
    return await prisma.panel.findMany({
      include: {
        device: true,
        ports: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async getPanelsByDevice(deviceId: string) {
    return await prisma.panel.findMany({
      where: { deviceId },
      include: {
        ports: {
          orderBy: {
            number: 'asc',
          },
        },
      },
      orderBy: {
        name: 'asc',
      },
    });
  }

  async getPanelsByType(type: PanelType) {
    return await prisma.panel.findMany({
      where: { type },
      include: {
        device: true,
        ports: true,
      },
    });
  }

  async updatePanel(id: string, data: UpdatePanelDto) {
    return await prisma.panel.update({
      where: { id },
      data,
      include: {
        device: true,
        ports: true,
      },
    });
  }

  async deletePanel(id: string) {
    // 先获取面板的shortId
    const panel = await prisma.panel.findUnique({
      where: { id },
      select: { shortId: true },
    });

    // 删除面板
    const deleted = await prisma.panel.delete({
      where: { id },
    });

    // 释放shortID回池中
    if (panel?.shortId) {
      await shortIdPoolService.releaseShortId(panel.shortId);
    }

    return deleted;
  }

  async searchPanels(query: string) {
    return await prisma.panel.findMany({
      where: {
        OR: [
          { name: { contains: query } },
          { device: { name: { contains: query } } },
        ],
      },
      include: {
        device: true,
        ports: true,
      },
    });
  }
}

export default new PanelService();
