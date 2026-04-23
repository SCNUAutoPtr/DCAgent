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
    // 使用 shortIdPoolService 分配 shortId（统一使用 ShortIDPool）
    const allocatedShortId = await shortIdPoolService.allocateShortId('PANEL', '', data.shortId);

    // 从data中提取shortId，避免覆盖allocatedShortId
    const { shortId: _, ...panelData } = data;

    // 创建面板
    const panel = await prisma.panel.create({
      data: {
        ...panelData,
        shortId: allocatedShortId,
      },
      include: {
        device: true,
        ports: true,
      },
    });

    // 更新 ShortIdPool 中的 entityId
    await prisma.shortIdPool.updateMany({
      where: { shortId: allocatedShortId },
      data: { entityId: panel.id },
    });

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
