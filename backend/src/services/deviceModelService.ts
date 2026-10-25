import prisma from '../utils/prisma';
import { DeviceType, PanelType } from '@prisma/client';

export interface PortGroupConfig {
  type: string; // "GE", "XGE", "SFP", "QSFP" 等
  prefix: string; // 端口名前缀，如 "GigabitEthernet0/0/"
  start: number; // 起始编号
  end: number; // 结束编号
  layout?: string; // 布局方式，如 "double-row" (奇数上、偶数下)
  portType?: string; // 端口物理类型，如 "RJ45", "SFP_PLUS"
}

export interface CreateDeviceModelDto {
  name: string;
  vendor?: string;
  deviceType: DeviceType;
  description?: string;
  portGroups: PortGroupConfig[];
  isStackable?: boolean;
  panelTemplateId?: string;
}

export interface UpdateDeviceModelDto {
  name?: string;
  vendor?: string;
  deviceType?: DeviceType;
  description?: string;
  portGroups?: PortGroupConfig[];
  isStackable?: boolean;
  panelTemplateId?: string;
}

class DeviceModelService {
  /**
   * 创建设备型号
   */
  async createDeviceModel(data: CreateDeviceModelDto) {
    return await prisma.deviceModel.create({
      data: {
        name: data.name,
        vendor: data.vendor,
        deviceType: data.deviceType,
        description: data.description,
        portGroups: data.portGroups as any,
        isStackable: data.isStackable || false,
        panelTemplateId: data.panelTemplateId,
      },
      include: {
        panelTemplate: true,
      },
    });
  }

  /**
   * 获取所有设备型号
   */
  async getAllDeviceModels(deviceType?: DeviceType) {
    return await prisma.deviceModel.findMany({
      where: deviceType ? { deviceType } : undefined,
      include: {
        panelTemplate: true,
        _count: {
          select: { devices: true },
        },
      },
      orderBy: [
        { vendor: 'asc' },
        { name: 'asc' },
      ],
    });
  }

  /**
   * 根据ID获取设备型号
   */
  async getDeviceModelById(id: string) {
    return await prisma.deviceModel.findUnique({
      where: { id },
      include: {
        panelTemplate: true,
        devices: {
          include: {
            cabinet: {
              include: {
                room: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * 根据名称获取设备型号
   */
  async getDeviceModelByName(name: string) {
    return await prisma.deviceModel.findUnique({
      where: { name },
      include: {
        panelTemplate: true,
      },
    });
  }

  /**
   * 更新设备型号
   */
  async updateDeviceModel(id: string, data: UpdateDeviceModelDto) {
    return await prisma.deviceModel.update({
      where: { id },
      data: {
        name: data.name,
        vendor: data.vendor,
        deviceType: data.deviceType,
        description: data.description,
        portGroups: data.portGroups as any,
        isStackable: data.isStackable,
        panelTemplateId: data.panelTemplateId,
      },
      include: {
        panelTemplate: true,
      },
    });
  }

  /**
   * 删除设备型号
   */
  async deleteDeviceModel(id: string) {
    // 检查是否有设备在使用
    const deviceCount = await prisma.device.count({
      where: { deviceModelId: id },
    });

    if (deviceCount > 0) {
      throw new Error(`有 ${deviceCount} 个设备正在使用此型号，无法删除`);
    }

    return await prisma.deviceModel.delete({
      where: { id },
    });
  }

  /**
   * 生成端口列表（根据端口组配置）
   */
  generatePortList(portGroups: PortGroupConfig[]): Array<{
    number: string;
    label: string;
    portType?: string;
  }> {
    const ports: Array<{ number: string; label: string; portType?: string }> = [];

    for (const group of portGroups) {
      for (let i = group.start; i <= group.end; i++) {
        ports.push({
          number: `${ports.length + 1}`, // 顺序编号
          label: `${group.prefix}${i}`, // 接口名称（ifName）
          portType: group.portType,
        });
      }
    }

    return ports;
  }

  /**
   * 初始化预设设备型号
   */
  async initializePresetModels() {
    const presetModels = [
      // 华为 S5735S-L24T4X-QA2
      {
        name: 'S5735S-L24T4X-QA2',
        vendor: 'Huawei',
        deviceType: 'SWITCH' as DeviceType,
        description: '24口千兆电 + 4口万兆光（SFP+）',
        isStackable: false,
        portGroups: [
          {
            type: 'GE',
            prefix: 'GigabitEthernet0/0/',
            start: 1,
            end: 24,
            layout: 'double-row',
            portType: 'RJ45',
          },
          {
            type: 'XGE',
            prefix: 'XGigabitEthernet0/0/',
            start: 1,
            end: 4,
            portType: 'SFP_PLUS',
          },
        ],
      },
      // 华为 S6730S-S24X6Q-A
      {
        name: 'S6730S-S24X6Q-A',
        vendor: 'Huawei',
        deviceType: 'SWITCH' as DeviceType,
        description: '24口万兆光（SFP+）+ 6口40G（QSFP+）',
        isStackable: true,
        portGroups: [
          {
            type: 'XGE',
            prefix: 'XGigabitEthernet0/0/',
            start: 1,
            end: 24,
            layout: 'double-row',
            portType: 'SFP_PLUS',
          },
          {
            type: 'QSFP',
            prefix: 'FortyGigE0/0/',
            start: 1,
            end: 6,
            portType: 'QSFP_PLUS',
          },
        ],
      },
      // 华为 CE6820S-48S6CQ
      {
        name: 'CE6820S-48S6CQ',
        vendor: 'Huawei',
        deviceType: 'SWITCH' as DeviceType,
        description: '48口万兆光（SFP+）+ 6口100G（QSFP28）',
        isStackable: false,
        portGroups: [
          {
            type: 'XGE',
            prefix: 'XGigabitEthernet0/0/',
            start: 1,
            end: 48,
            layout: 'double-row',
            portType: 'SFP_PLUS',
          },
          {
            type: 'QSFP28',
            prefix: 'HundredGigE0/0/',
            start: 1,
            end: 6,
            portType: 'QSFP28',
          },
        ],
      },
      // H3C HS2300 系列（示例配置，可能需要根据实际型号调整）
      {
        name: 'HS2300',
        vendor: 'H3C',
        deviceType: 'SWITCH' as DeviceType,
        description: 'H3C HS2300 系列交换机（具体端口配置待补充）',
        isStackable: false,
        portGroups: [
          {
            type: 'GE',
            prefix: 'GigabitEthernet1/0/',
            start: 1,
            end: 24,
            layout: 'double-row',
            portType: 'RJ45',
          },
        ],
      },
    ];

    for (const modelData of presetModels) {
      const existing = await prisma.deviceModel.findUnique({
        where: { name: modelData.name },
      });

      if (!existing) {
        await this.createDeviceModel(modelData);
        console.log(`已创建设备型号: ${modelData.name}`);
      }
    }
  }
}

export default new DeviceModelService();
