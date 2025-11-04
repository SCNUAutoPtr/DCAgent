/**
 * 标准网络端口物理尺寸
 * 单位：毫米 (mm)
 * 基于实际网络设备端口的真实物理尺寸
 */

export enum PortType {
  RJ45 = 'RJ45',           // 标准以太网口
  SFP = 'SFP',             // 小型可插拔光纤模块
  SFP_PLUS = 'SFP_PLUS',   // SFP+ (10G)
  QSFP = 'QSFP',           // 四通道SFP (40G)
  QSFP28 = 'QSFP28',       // QSFP28 (100G)
  QSFP_DD = 'QSFP_DD',     // QSFP-DD (400G)
  LC = 'LC',               // LC光纤接口
  SC = 'SC',               // SC光纤接口
  USB_A = 'USB_A',         // USB-A接口
  USB_C = 'USB_C',         // USB-C接口
  SERIAL = 'SERIAL',       // 串口
  POWER_C13 = 'POWER_C13', // 标准电源接口 C13
  POWER_C19 = 'POWER_C19', // 大功率电源接口 C19
}

export interface PortSize {
  width: number;   // 宽度 (mm)
  height: number;  // 高度 (mm)
  label: string;   // 显示标签
  description: string; // 描述
  color?: string;  // 推荐颜色
}

/**
 * 标准端口尺寸定义
 * 参考真实设备规格
 */
export const PORT_SIZES: Record<PortType, PortSize> = {
  // RJ45以太网口 - 标准8P8C模块化插孔
  [PortType.RJ45]: {
    width: 16,
    height: 14,
    label: 'RJ45',
    description: '标准以太网口 (1G/10G/25G)',
    color: '#1890ff',
  },

  // SFP - 小型可插拔光纤模块
  [PortType.SFP]: {
    width: 13.5,
    height: 8.5,
    label: 'SFP',
    description: 'SFP光模块接口 (1G)',
    color: '#52c41a',
  },

  // SFP+ - 增强型SFP
  [PortType.SFP_PLUS]: {
    width: 13.5,
    height: 8.5,
    label: 'SFP+',
    description: 'SFP+光模块接口 (10G)',
    color: '#13c2c2',
  },

  // QSFP - 四通道SFP
  [PortType.QSFP]: {
    width: 18.5,
    height: 8.5,
    label: 'QSFP',
    description: 'QSFP光模块接口 (40G)',
    color: '#722ed1',
  },

  // QSFP28 - QSFP 28Gbps
  [PortType.QSFP28]: {
    width: 18.5,
    height: 8.5,
    label: 'QSFP28',
    description: 'QSFP28光模块接口 (100G)',
    color: '#722ed1',
  },

  // QSFP-DD - 双密度QSFP
  [PortType.QSFP_DD]: {
    width: 18.5,
    height: 9.5,
    label: 'QSFP-DD',
    description: 'QSFP-DD光模块接口 (400G)',
    color: '#eb2f96',
  },

  // LC双工光纤接口
  [PortType.LC]: {
    width: 12,
    height: 12,
    label: 'LC',
    description: 'LC双工光纤接口',
    color: '#faad14',
  },

  // SC光纤接口
  [PortType.SC]: {
    width: 16,
    height: 16,
    label: 'SC',
    description: 'SC光纤接口',
    color: '#fa8c16',
  },

  // USB-A接口
  [PortType.USB_A]: {
    width: 14,
    height: 7,
    label: 'USB-A',
    description: 'USB-A接口',
    color: '#1890ff',
  },

  // USB-C接口
  [PortType.USB_C]: {
    width: 9,
    height: 3.5,
    label: 'USB-C',
    description: 'USB-C接口',
    color: '#1890ff',
  },

  // 串口 (DB9)
  [PortType.SERIAL]: {
    width: 31,
    height: 13,
    label: 'Serial',
    description: '串口 (DB9)',
    color: '#8c8c8c',
  },

  // 电源接口 C13
  [PortType.POWER_C13]: {
    width: 20,
    height: 15,
    label: 'C13',
    description: '标准电源接口 C13',
    color: '#f5222d',
  },

  // 电源接口 C19
  [PortType.POWER_C19]: {
    width: 25,
    height: 18,
    label: 'C19',
    description: '大功率电源接口 C19',
    color: '#cf1322',
  },
};

/**
 * 根据端口类型获取标准尺寸
 */
export function getPortSize(portType: PortType): PortSize {
  return PORT_SIZES[portType];
}

/**
 * 获取所有可用的端口类型
 */
export function getAllPortTypes(): Array<{ value: PortType; label: string; description: string }> {
  return Object.values(PortType).map(type => ({
    value: type,
    label: PORT_SIZES[type].label,
    description: PORT_SIZES[type].description,
  }));
}

/**
 * 端口类型选择器选项
 */
export const PORT_TYPE_OPTIONS = Object.values(PortType).map(type => ({
  value: type,
  label: `${PORT_SIZES[type].label} - ${PORT_SIZES[type].description}`,
}));
