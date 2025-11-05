import { PanelType } from '@prisma/client';
import { PortType, getPortSize } from '../constants/portSizes';

/**
 * 面板布局生成器（后端版本）
 * 根据面板类型和端口数量自动生成端口的物理布局
 */

// 标准面板尺寸 (mm)
const PANEL_DIMENSIONS = {
  width: 482.6, // 1U 面板 (482.6mm 宽 x 44.45mm 高)
  height: 44.45,
};

// 端口间距 (mm) - 根据端口类型
const PORT_SPACING: Record<string, number> = {
  [PortType.RJ45]: 2,
  [PortType.SFP]: 0.5,
  [PortType.SFP_PLUS]: 0.5,
  [PortType.QSFP]: 1,
  [PortType.QSFP28]: 1,
  [PortType.QSFP_DD]: 1.5,
  [PortType.LC]: 1,
  [PortType.SC]: 2,
  [PortType.USB_A]: 2,
  [PortType.USB_C]: 1.5,
  [PortType.SERIAL]: 3,
  [PortType.POWER_C13]: 5,
  [PortType.POWER_C19]: 6,
};

// 边距 (mm)
const MARGIN = {
  left: 20,
  right: 20,
  top: 8,
  bottom: 8,
};

interface LayoutConfig {
  portsPerRow: number;
  rowSpacing: number;
}

interface Port {
  id: string;
  number: string;
  label?: string | null;
  portType?: string | null; // 端口类型 (RJ45, SFP, 等)
  status: string;
  panelId: string;
  positionX?: number | null;
  positionY?: number | null;
  width?: number | null;
  height?: number | null;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  createdAt: Date;
  updatedAt: Date;
}

interface Panel {
  id: string;
  name: string;
  type: PanelType;
  deviceId: string;
  templateId?: string | null;
  isCustomized: boolean;
  positionX?: number | null;
  positionY?: number | null;
  width?: number | null;
  height?: number | null;
  backgroundColor?: string | null;
  image?: string | null;
  svgPath?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 获取面板类型的默认布局配置
 */
function getLayoutConfig(panelType: PanelType, portCount: number): LayoutConfig {
  switch (panelType) {
    case 'NETWORK':
      // 网络面板（RJ45/SFP/QSFP）通常是 24 或 48 口，排列成 2 行
      if (portCount <= 24) {
        return { portsPerRow: 24, rowSpacing: 10 };
      } else {
        return { portsPerRow: 24, rowSpacing: 8 };
      }

    case 'POWER':
      // 电源插座通常单行或双行
      return { portsPerRow: Math.min(portCount, 8), rowSpacing: 12 };

    case 'CONSOLE':
      // 串口通常较少
      return { portsPerRow: Math.min(portCount, 4), rowSpacing: 10 };

    case 'USB':
      return { portsPerRow: Math.min(portCount, 8), rowSpacing: 8 };

    case 'MIXED':
      // 混合面板使用通用布局
      return { portsPerRow: Math.min(portCount, 16), rowSpacing: 10 };

    default:
      return { portsPerRow: Math.min(portCount, 16), rowSpacing: 10 };
  }
}

/**
 * 为端口数组生成物理布局位置
 * 支持混合端口类型的布局
 */
export function generatePortLayout(ports: Port[], panel: Panel): Port[] {
  if (ports.length === 0) return ports;

  const panelType = panel.type;

  // 检测是否是混合端口类型
  const portTypes = new Set(ports.map(p => p.portType).filter(Boolean));
  const isMixedPortTypes = portTypes.size > 1;

  // 如果端口有指定类型，使用端口自己的类型；否则根据面板类型推断默认类型
  const getDefaultPortType = (panelType: PanelType): PortType => {
    switch (panelType) {
      case 'NETWORK': return PortType.RJ45;
      case 'POWER': return PortType.POWER_C13;
      case 'CONSOLE': return PortType.SERIAL;
      case 'USB': return PortType.USB_A;
      case 'MIXED': return PortType.RJ45;
      default: return PortType.RJ45;
    }
  };

  const defaultPortType = getDefaultPortType(panelType);

  // 为每个端口确定尺寸和间距
  const portsWithSize = ports.map(port => {
    const portType = (port.portType as PortType) || defaultPortType;
    const portSize = getPortSize(portType);
    const spacing = PORT_SPACING[portType] || 2;
    return {
      ...port,
      portType,
      portSize: { width: portSize.width, height: portSize.height },
      spacing,
    };
  });

  // 如果是混合类型或使用模板定义的布局，使用简单的顺序排列
  if (isMixedPortTypes) {
    return generateMixedPortLayout(portsWithSize, panel);
  }

  // 否则使用传统的按面板类型布局
  return generateUniformPortLayout(portsWithSize, panel, defaultPortType);
}

/**
 * 混合端口类型布局 - 简单的顺序排列
 */
function generateMixedPortLayout(ports: any[], panel: Panel) {
  const availableWidth = PANEL_DIMENSIONS.width - MARGIN.left - MARGIN.right;
  const availableHeight = PANEL_DIMENSIONS.height - MARGIN.top - MARGIN.bottom;

  let currentX = MARGIN.left;
  let currentY = MARGIN.top;
  let maxHeightInRow = 0;
  let rowStartIndex = 0;

  return ports.map((port, index) => {
    const portWidth = port.portSize.width;
    const portHeight = port.portSize.height;
    const spacing = port.spacing;

    // 检查是否需要换行
    if (currentX + portWidth > PANEL_DIMENSIONS.width - MARGIN.right && index > rowStartIndex) {
      // 换行
      currentX = MARGIN.left;
      currentY += maxHeightInRow + 5; // 行间距 5mm
      maxHeightInRow = 0;
      rowStartIndex = index;
    }

    const x = currentX;
    const y = currentY;

    // 更新位置
    currentX += portWidth + spacing;
    maxHeightInRow = Math.max(maxHeightInRow, portHeight);

    return {
      ...port,
      position: { x, y },
      size: { width: portWidth, height: portHeight },
    };
  });
}

/**
 * 统一端口类型布局 - 传统的对齐布局
 */
function generateUniformPortLayout(ports: any[], panel: Panel, portType: PortType) {
  const portSize = ports[0].portSize;
  const spacing = ports[0].spacing;
  const config = getLayoutConfig(panel.type, ports.length);

  // 计算面板可用宽度
  const availableWidth = PANEL_DIMENSIONS.width - MARGIN.left - MARGIN.right;
  const availableHeight = PANEL_DIMENSIONS.height - MARGIN.top - MARGIN.bottom;

  // 计算需要多少行
  const rows = Math.ceil(ports.length / config.portsPerRow);

  // 交换机类型使用交错排列：1 3 5 7... (上行) 和 2 4 6 8... (下行)
  const isNetworkSwitch = panel.type === 'NETWORK' && ports.length > 8;

  if (isNetworkSwitch) {
    // 交错排列算法
    const portsPerColumn = Math.ceil(ports.length / 2);

    return ports.map((port: any, index: number) => {
      // 奇数端口在上行，偶数端口在下行
      const isOddPort = index % 2 === 0; // 0-indexed，所以 index 0 对应端口 1
      const row = isOddPort ? 0 : 1;
      const col = Math.floor(index / 2);

      // 计算总列数（用于居中对齐）
      const totalColumns = portsPerColumn;
      const rowWidth = totalColumns * portSize.width + (totalColumns - 1) * spacing;
      const rowStartX = MARGIN.left + (availableWidth - rowWidth) / 2;

      // 计算X坐标
      const x = rowStartX + col * (portSize.width + spacing);

      // 计算Y坐标（两行固定位置）
      const totalRowHeight = 2 * portSize.height + config.rowSpacing;
      const startY = MARGIN.top + (availableHeight - totalRowHeight) / 2;
      const y = startY + row * (portSize.height + config.rowSpacing);

      return {
        ...port,
        position: { x, y },
        size: { ...portSize },
      };
    });
  }

  // 其他类型使用标准顺序排列
  const portsInLastRow = ports.length % config.portsPerRow || config.portsPerRow;

  return ports.map((port: any, index: number) => {
    const row = Math.floor(index / config.portsPerRow);
    const col = index % config.portsPerRow;

    // 当前行的端口数
    const portsInThisRow = row === rows - 1 ? portsInLastRow : config.portsPerRow;

    // 计算这一行的总宽度（用于居中对齐）
    const rowWidth = portsInThisRow * portSize.width + (portsInThisRow - 1) * spacing;
    const rowStartX = MARGIN.left + (availableWidth - rowWidth) / 2;

    // 计算X坐标（在这一行内的位置）
    const x = rowStartX + col * (portSize.width + spacing);

    // 计算Y坐标（从上到下）
    const totalRowHeight = rows * portSize.height + (rows - 1) * config.rowSpacing;
    const startY = MARGIN.top + (availableHeight - totalRowHeight) / 2;
    const y = startY + row * (portSize.height + config.rowSpacing);

    return {
      ...port,
      position: { x, y },
      size: { ...portSize },
    };
  });
}

/**
 * 根据端口编号智能排序
 * 支持: eth0, eth1, port-1, port-2 等格式
 */
export function sortPortsByNumber(ports: Port[]): Port[] {
  return [...ports].sort((a, b) => {
    // 提取数字部分
    const getNumber = (str: string) => {
      const match = str.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    };

    const numA = getNumber(a.number);
    const numB = getNumber(b.number);

    return numA - numB;
  });
}
