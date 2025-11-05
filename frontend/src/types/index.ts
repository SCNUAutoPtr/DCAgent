export interface DataCenter {
  id: string;
  name: string;
  location?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  name: string;
  floor?: string;
  dataCenterId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Cabinet {
  id: string;
  name: string;
  position?: string;
  height: number;
  roomId: string;
  createdAt: string;
  updatedAt: string;
}

export enum DeviceType {
  SERVER = 'SERVER',
  SWITCH = 'SWITCH',
  ROUTER = 'ROUTER',
  FIREWALL = 'FIREWALL',
  STORAGE = 'STORAGE',
  PDU = 'PDU',
  OTHER = 'OTHER',
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  model?: string;
  serialNo?: string;
  uPosition?: number;
  uHeight?: number;
  cabinetId: string;
  // 扩展字段 - 待实现
  ipAddresses?: string[];
  managementIp?: string;
  powerPhase?: string;
  powerSource?: 'MAINS' | 'UPS';
  snmpEnabled?: boolean;
  ipmiEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum PanelType {
  ETHERNET = 'ETHERNET',
  FIBER = 'FIBER',
  POWER = 'POWER',
  SERIAL = 'SERIAL',
  USB = 'USB',
  OTHER = 'OTHER',
}

export interface PanelTemplate {
  id: string;
  name: string;
  type: PanelType;
  portCount: number;
  description?: string;
  // 物理尺寸
  width: number;
  height: number;
  // 布局配置
  layoutConfig?: any;
  portDefinitions: Array<{
    number: string;
    portType: string; // 端口类型 (RJ45, SFP, SFP+, QSFP等)
    position: { x: number; y: number };
    size: { width: number; height: number };
    label?: string; // 可选的端口标签
  }>;
  // 视觉样式
  backgroundColor?: string;
  image?: string;
  svgPath?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
}

export enum PanelPosition {
  FRONT = 'FRONT',   // 前面板
  REAR = 'REAR',     // 后面板
  CUSTOM = 'CUSTOM', // 自定义位置
}

export interface Panel {
  id: string;
  name: string;
  type: PanelType;
  deviceId: string;
  // 面板位置
  panelPosition?: PanelPosition;
  // 模板引用
  templateId?: string;
  isCustomized: boolean;
  // 物理布局信息
  position?: {
    x: number;      // X坐标 (mm)
    y: number;      // Y坐标 (mm)
  };
  size?: {
    width: number;  // 宽度 (mm)
    height: number; // 高度 (mm)
  };
  // 视觉展示
  image?: string;   // 图片URL
  svgPath?: string; // SVG路径或内容
  backgroundColor?: string; // 背景色
  createdAt: string;
  updatedAt: string;
}

export enum PortStatus {
  AVAILABLE = 'AVAILABLE',
  OCCUPIED = 'OCCUPIED',
  RESERVED = 'RESERVED',
  FAULTY = 'FAULTY',
}

export interface Port {
  id: string;
  number: string;
  label?: string;
  status: PortStatus;
  panelId: string;
  portType?: string; // 端口类型 (RJ45, SFP, SFP+, 等)
  // 物理布局信息（相对于面板的坐标）
  position?: {
    x: number;      // X坐标 (mm)
    y: number;      // Y坐标 (mm)
  };
  size?: {
    width: number;  // 宽度 (mm)
    height: number; // 高度 (mm)
  };
  // 扩展字段 - 待实现
  ipAddress?: string;
  vlan?: string;
  speed?: string;
  createdAt: string;
  updatedAt: string;
}

export enum CableType {
  CAT5E = 'CAT5E',
  CAT6 = 'CAT6',
  CAT6A = 'CAT6A',
  CAT7 = 'CAT7',
  FIBER_SM = 'FIBER_SM',
  FIBER_MM = 'FIBER_MM',
  POWER = 'POWER',
  OTHER = 'OTHER',
}

export interface Cable {
  id: string;
  label?: string;
  type: CableType;
  length?: number;
  color?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CableConnection {
  cable: Cable;
  portA: Port;
  portB: Port;
}
