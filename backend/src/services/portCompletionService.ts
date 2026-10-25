import prisma from '../utils/prisma';
import deviceModelService from './deviceModelService';
import { PanelType, PortStatus, PhysicalStatus } from '@prisma/client';
import { panelTemplateService } from './panelTemplateService';

interface PortCompletionResult {
  device: any;
  panelsCreated: number;
  portsAdded: number;
  portsPreserved: number;
  stackMembersCreated?: number;
}

class PortCompletionService {
  /**
   * 为单个设备补全端口
   * 根据设备型号创建面板和端口，保留已有端口（通过 label/ifName 匹配）
   */
  async completeDevicePorts(deviceId: string, deviceModelId?: string): Promise<PortCompletionResult> {
    // 获取设备信息
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: {
        panels: {
          include: {
            ports: {
              include: {
                cableEndpoints: true,
                opticalModule: true,
                ipAddress: true,
              },
            },
          },
        },
        deviceModel: {
          include: {
            panelTemplate: true,
          },
        },
        stackMembers: {
          include: {
            panel: true,
          },
        },
      },
    });

    if (!device) {
      throw new Error('设备不存在');
    }

    // 如果提供了新的设备型号ID，更新设备
    if (deviceModelId && deviceModelId !== device.deviceModelId) {
      await prisma.device.update({
        where: { id: deviceId },
        data: { deviceModelId },
      });
      device.deviceModelId = deviceModelId;
    }

    // 获取设备型号
    if (!device.deviceModelId) {
      throw new Error('设备未关联型号，无法补全端口');
    }

    const deviceModel = await prisma.deviceModel.findUnique({
      where: { id: device.deviceModelId },
      include: {
        panelTemplate: true,
      },
    });

    if (!deviceModel) {
      throw new Error('设备型号不存在');
    }

    const portGroups = deviceModel.portGroups as any[];
    const isStackDevice = deviceModel.isStackable && device.stackMembers.length > 0;

    let panelsCreated = 0;
    let portsAdded = 0;
    let portsPreserved = 0;
    let stackMembersCreated = 0;

    if (isStackDevice) {
      // 堆叠设备：为每个成员创建独立面板
      for (const member of device.stackMembers) {
        const result = await this.createPanelForStackMember(
          device,
          member,
          deviceModel,
          portGroups
        );
        panelsCreated += result.panelsCreated;
        portsAdded += result.portsAdded;
        portsPreserved += result.portsPreserved;
      }
    } else {
      // 普通设备：创建单个面板
      const result = await this.createPanelForDevice(device, deviceModel, portGroups);
      panelsCreated = result.panelsCreated;
      portsAdded = result.portsAdded;
      portsPreserved = result.portsPreserved;
    }

    return {
      device,
      panelsCreated,
      portsAdded,
      portsPreserved,
      stackMembersCreated,
    };
  }

  /**
   * 为普通设备创建面板和端口
   */
  private async createPanelForDevice(
    device: any,
    deviceModel: any,
    portGroups: any[]
  ): Promise<{ panelsCreated: number; portsAdded: number; portsPreserved: number }> {
    // 生成所有应该存在的端口
    const expectedPorts = deviceModelService.generatePortList(portGroups);

    // 获取设备现有的所有端口（按 label 索引）
    const existingPortsByLabel = new Map<string, any>();
    for (const panel of device.panels) {
      for (const port of panel.ports) {
        if (port.label) {
          existingPortsByLabel.set(port.label, port);
        }
      }
    }

    let panelsCreated = 0;
    let portsAdded = 0;
    let portsPreserved = 0;

    // 查找或创建主面板
    let mainPanel = device.panels.find((p: any) => p.type === PanelType.NETWORK);

    if (!mainPanel) {
      // 创建新面板
      mainPanel = await prisma.panel.create({
        data: {
          name: `${device.name}-主面板`,
          type: PanelType.NETWORK,
          deviceId: device.id,
          templateId: deviceModel.panelTemplateId,
        },
      });
      panelsCreated++;
    }

    // 逐个检查并创建缺失的端口
    for (const expectedPort of expectedPorts) {
      const existingPort = existingPortsByLabel.get(expectedPort.label);

      if (existingPort) {
        // 端口已存在，保留
        portsPreserved++;
      } else {
        // 端口缺失，创建
        await prisma.port.create({
          data: {
            number: expectedPort.number,
            label: expectedPort.label,
            portType: expectedPort.portType,
            status: PortStatus.AVAILABLE,
            physicalStatus: PhysicalStatus.EMPTY,
            panelId: mainPanel.id,
          },
        });
        portsAdded++;
      }
    }

    return { panelsCreated, portsAdded, portsPreserved };
  }

  /**
   * 为堆叠成员创建面板和端口
   */
  private async createPanelForStackMember(
    device: any,
    member: any,
    deviceModel: any,
    portGroups: any[]
  ): Promise<{ panelsCreated: number; portsAdded: number; portsPreserved: number }> {
    // 调整端口组前缀以包含堆叠编号
    const adjustedPortGroups = portGroups.map((group: any) => ({
      ...group,
      prefix: group.prefix.replace('0/0/', `${member.memberId}/0/`),
    }));

    const expectedPorts = deviceModelService.generatePortList(adjustedPortGroups);

    // 获取设备现有的所有端口（按 label 索引）
    const existingPortsByLabel = new Map<string, any>();
    for (const panel of device.panels) {
      for (const port of panel.ports) {
        if (port.label) {
          existingPortsByLabel.set(port.label, port);
        }
      }
    }

    let panelsCreated = 0;
    let portsAdded = 0;
    let portsPreserved = 0;

    // 查找或创建成员面板
    let memberPanel = member.panel;

    if (!memberPanel) {
      // 创建新面板
      memberPanel = await prisma.panel.create({
        data: {
          name: `${device.name}-Member${member.memberId}`,
          type: PanelType.NETWORK,
          deviceId: device.id,
          templateId: deviceModel.panelTemplateId,
        },
      });

      // 关联到堆叠成员
      await prisma.stackMember.update({
        where: { id: member.id },
        data: { panelId: memberPanel.id },
      });

      panelsCreated++;
    }

    // 逐个检查并创建缺失的端口
    for (const expectedPort of expectedPorts) {
      const existingPort = existingPortsByLabel.get(expectedPort.label);

      if (existingPort) {
        // 端口已存在，保留
        portsPreserved++;
        // 如果端口不在正确的面板上，移动它
        if (existingPort.panelId !== memberPanel.id) {
          await prisma.port.update({
            where: { id: existingPort.id },
            data: { panelId: memberPanel.id },
          });
        }
      } else {
        // 端口缺失，创建
        await prisma.port.create({
          data: {
            number: expectedPort.number,
            label: expectedPort.label,
            portType: expectedPort.portType,
            status: PortStatus.AVAILABLE,
            physicalStatus: PhysicalStatus.EMPTY,
            panelId: memberPanel.id,
          },
        });
        portsAdded++;
      }
    }

    return { panelsCreated, portsAdded, portsPreserved };
  }

  /**
   * 批量为设备补全端口
   */
  async batchCompleteDevicePorts(
    deviceIds: string[]
  ): Promise<{ results: PortCompletionResult[]; errors: Array<{ deviceId: string; error: string }> }> {
    const results: PortCompletionResult[] = [];
    const errors: Array<{ deviceId: string; error: string }> = [];

    for (const deviceId of deviceIds) {
      try {
        const result = await this.completeDevicePorts(deviceId);
        results.push(result);
      } catch (error: any) {
        errors.push({
          deviceId,
          error: error.message,
        });
      }
    }

    return { results, errors };
  }

  /**
   * 为指定型号的所有设备补全端口
   */
  async completePortsByModel(deviceModelId: string) {
    const devices = await prisma.device.findMany({
      where: { deviceModelId },
      select: { id: true },
    });

    return await this.batchCompleteDevicePorts(devices.map((d) => d.id));
  }

  /**
   * 创建堆叠成员
   */
  async createStackMember(deviceId: string, memberId: number, status?: string, notes?: string) {
    // 检查设备是否存在
    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      include: { deviceModel: true },
    });

    if (!device) {
      throw new Error('设备不存在');
    }

    // 检查设备型号是否支持堆叠
    if (!device.deviceModel?.isStackable) {
      throw new Error('该设备型号不支持堆叠');
    }

    // 检查是否已存在相同编号的成员
    const existing = await prisma.stackMember.findUnique({
      where: {
        deviceId_memberId: {
          deviceId,
          memberId,
        },
      },
    });

    if (existing) {
      throw new Error(`堆叠成员 ${memberId} 已存在`);
    }

    return await prisma.stackMember.create({
      data: {
        deviceId,
        memberId,
        status,
        notes,
      },
    });
  }
}

export default new PortCompletionService();
