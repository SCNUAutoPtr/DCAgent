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
  NETWORK = 'NETWORK',
  POWER = 'POWER',
  CONSOLE = 'CONSOLE',
  USB = 'USB',
  MIXED = 'MIXED',
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
  shortId?: number; // 面板shortID，用于快速识别和扫码
  deviceId: string;
  device?: Device; // 关联的设备信息
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

export enum PhysicalStatus {
  EMPTY = 'EMPTY',            // 空槽位（未安装模块）
  MODULE_ONLY = 'MODULE_ONLY', // 已安装模块但未连接线缆
  CONNECTED = 'CONNECTED',     // 已连接线缆
}

export interface Port {
  id: string;
  number: string;
  label?: string;
  status: PortStatus;
  physicalStatus?: PhysicalStatus; // 物理状态
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
  // 连接信息
  cableEndpoints?: CableEndpoint[]; // 该端口连接的线缆端点
  opticalModule?: OpticalModule;   // 关联的光模块
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
  QSFP_TO_SFP = 'QSFP_TO_SFP',
  QSFP_TO_QSFP = 'QSFP_TO_QSFP',
  SFP_TO_SFP = 'SFP_TO_SFP',
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
  isBranched?: boolean; // 是否为分支线缆（1对多）
  endpoints?: CableEndpoint[];
  createdAt: string;
  updatedAt: string;
}

export interface CableEndpoint {
  id: string;
  cableId: string;
  cable?: Cable;
  portId: string;
  port?: Port;
  endType: string; // "A" 表示主端，"B1", "B2"等表示分支端
  createdAt: string;
}

export interface CableConnection {
  cable: Cable;
  portA: Port;
  portB: Port;
}

// ============================================
// 光模块管理系统类型定义
// ============================================

export enum ModuleStatus {
  IN_STOCK = 'IN_STOCK',       // 在库（未安装）
  INSTALLED = 'INSTALLED',     // 已安装
  RESERVED = 'RESERVED',       // 预留
  FAULTY = 'FAULTY',           // 故障
  SCRAPPED = 'SCRAPPED',       // 已报废
}

export enum MovementType {
  PURCHASE = 'PURCHASE',       // 采购入库
  INSTALL = 'INSTALL',         // 安装到端口
  UNINSTALL = 'UNINSTALL',     // 从端口卸下
  TRANSFER = 'TRANSFER',       // 转移到其他端口
  REPAIR = 'REPAIR',           // 送修
  RETURN = 'RETURN',           // 维修返回
  SCRAP = 'SCRAP',             // 报废
}

export enum ModuleType {
  SFP = 'SFP',                 // 1G 光模块
  SFP_PLUS = 'SFP_PLUS',       // 10G 光模块
  QSFP = 'QSFP',               // 40G 光模块
  QSFP28 = 'QSFP28',           // 100G 光模块
  QSFP_DD = 'QSFP_DD',         // 400G 光模块
}

export interface OpticalModule {
  id: string;
  serialNo: string;              // 序列号
  model: string;                 // 型号
  vendor: string;                // 厂商
  moduleType: ModuleType | string; // 模块类型

  // 技术参数
  wavelength?: string;           // 波长（如 850nm, 1310nm）
  distance?: string;             // 传输距离（如 300m, 10km）
  ddmSupport: boolean;           // 是否支持DDM

  // 采购信息
  supplier?: string;             // 供应商
  purchaseDate?: string;         // 采购日期
  price?: number;                // 采购价格
  warrantyExpiry?: string;       // 保修到期日

  // 状态和位置
  status: ModuleStatus;          // 当前状态
  currentPortId?: string;        // 当前安装的端口ID
  currentPort?: Port;            // 当前安装的端口完整信息

  // 备注
  notes?: string;                // 备注信息

  createdAt: string;
  updatedAt: string;
}

export interface ModuleMovement {
  id: string;
  moduleId: string;
  module?: OpticalModule;

  movementType: MovementType;    // 移动类型
  fromPortId?: string;           // 源端口ID
  fromPort?: Port;               // 源端口完整信息
  toPortId?: string;             // 目标端口ID
  toPort?: Port;                 // 目标端口完整信息

  operator?: string;             // 操作人
  notes?: string;                // 备注信息
  createdAt: string;
}

export interface OpticalModuleStatistics {
  total: number;
  byStatus: {
    inStock: number;
    installed: number;
    faulty: number;
    scrapped: number;
  };
  byType: Array<{
    moduleType: string;
    count: number;
  }>;
  byVendor: Array<{
    vendor: string;
    count: number;
  }>;
}

