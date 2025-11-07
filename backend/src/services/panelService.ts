import prisma from '../utils/prisma';
import { PanelType } from '@prisma/client';
import globalShortIdService from './globalShortIdService';

export interface CreatePanelDto {
  name: string;
  type: PanelType;
  shortId?: number; // 面板shortID（将被全局服务覆盖）
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
    // 移除用户提供的 shortId（如果有）
    const { shortId: _, ...createData } = data;

    // 先创建实体
    const panel = await prisma.panel.create({
      data: createData,
      include: {
        device: true,
        ports: true,
      },
    });

    // 分配全局唯一的 shortId
    const shortId = await globalShortIdService.allocate('Panel', panel.id);

    // 更新实体的 shortId
    return await prisma.panel.update({
      where: { id: panel.id },
      data: { shortId },
      include: {
        device: true,
        ports: true,
      },
    });
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
    // 先获取实体的 shortId
    const panel = await prisma.panel.findUnique({
      where: { id },
      select: { shortId: true },
    });

    // 删除实体
    const deleted = await prisma.panel.delete({
      where: { id },
    });

    // 释放 shortId
    if (panel?.shortId) {
      await globalShortIdService.release(panel.shortId);
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
