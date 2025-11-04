import { Port, Panel, PanelType } from '../types';

/**
 * 面板布局生成器
 * 根据面板类型和端口数量自动生成端口的物理布局
 */

// 标准面板尺寸 (mm)
const PANEL_DIMENSIONS = {
  // 1U 面板 (482.6mm 宽 x 44.45mm 高)
  width: 482.6,
  height: 44.45,
};

// 标准端口尺寸 (mm)
const PORT_SIZES = {
  ETHERNET: { width: 16, height: 14 },  // RJ45 端口
  FIBER: { width: 12, height: 12 },      // LC/SC 光纤端口
  POWER: { width: 20, height: 15 },      // 电源插座
  SERIAL: { width: 25, height: 13 },     // DB9/RS232
  USB: { width: 12, height: 6 },         // USB-A
  OTHER: { width: 15, height: 12 },
};

// 端口间距 (mm)
const PORT_SPACING = {
  ETHERNET: 2,
  FIBER: 1.5,
  POWER: 5,
  SERIAL: 3,
  USB: 2,
  OTHER: 2,
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

/**
 * 获取面板类型的默认布局配置
 */
function getLayoutConfig(panelType: PanelType, portCount: number): LayoutConfig {
  switch (panelType) {
    case 'ETHERNET':
      // 网口通常是 24 或 48 口，排列成 2 行
      if (portCount <= 24) {
        return { portsPerRow: 24, rowSpacing: 10 };
      } else {
        return { portsPerRow: 24, rowSpacing: 8 };
      }

    case 'FIBER':
      // 光纤端口通常更密集
      return { portsPerRow: Math.min(portCount, 48), rowSpacing: 8 };

    case 'POWER':
      // 电源插座通常单行或双行
      return { portsPerRow: Math.min(portCount, 8), rowSpacing: 12 };

    case 'SERIAL':
      // 串口通常较少
      return { portsPerRow: Math.min(portCount, 4), rowSpacing: 10 };

    case 'USB':
      return { portsPerRow: Math.min(portCount, 8), rowSpacing: 8 };

    default:
      return { portsPerRow: Math.min(portCount, 16), rowSpacing: 10 };
  }
}

/**
 * 为端口数组生成物理布局位置
 */
export function generatePortLayout(
  ports: Port[],
  panel: Panel
): Port[] {
  if (ports.length === 0) return ports;

  const panelType = panel.type;
  const portSize = PORT_SIZES[panelType] || PORT_SIZES.OTHER;
  const spacing = PORT_SPACING[panelType] || PORT_SPACING.OTHER;
  const config = getLayoutConfig(panelType, ports.length);

  // 计算面板可用宽度
  const availableWidth = PANEL_DIMENSIONS.width - MARGIN.left - MARGIN.right;
  const availableHeight = PANEL_DIMENSIONS.height - MARGIN.top - MARGIN.bottom;

  // 计算需要多少行
  const rows = Math.ceil(ports.length / config.portsPerRow);

  // 交换机类型使用交错排列：1 3 5 7... (上行) 和 2 4 6 8... (下行)
  const isEthernetSwitch = panelType === 'ETHERNET' && ports.length > 8;

  if (isEthernetSwitch) {
    // 交错排列算法
    const portsPerColumn = Math.ceil(ports.length / 2);

    return ports.map((port, index) => {
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

  return ports.map((port, index) => {
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
 * 生成面板尺寸（如果面板没有设置尺寸）
 */
export function generatePanelSize(panel: Panel): Panel {
  if (panel.size) return panel;

  return {
    ...panel,
    size: {
      width: PANEL_DIMENSIONS.width,
      height: PANEL_DIMENSIONS.height,
    },
  };
}

/**
 * 预设的端口布局模板
 */
export const PORT_LAYOUT_TEMPLATES = {
  // 24口交换机（双行）
  SWITCH_24: {
    name: '24口交换机面板',
    type: 'ETHERNET' as PanelType,
    portCount: 24,
    description: '标准24口网络交换机，双行排列',
  },

  // 48口交换机（双行）
  SWITCH_48: {
    name: '48口交换机面板',
    type: 'ETHERNET' as PanelType,
    portCount: 48,
    description: '标准48口网络交换机，双行排列',
  },

  // 服务器双网口
  SERVER_DUAL_NIC: {
    name: '服务器双网口',
    type: 'ETHERNET' as PanelType,
    portCount: 2,
    description: '标准服务器双网口配置',
  },

  // 服务器四网口
  SERVER_QUAD_NIC: {
    name: '服务器四网口',
    type: 'ETHERNET' as PanelType,
    portCount: 4,
    description: '标准服务器四网口配置',
  },

  // 光纤配线架 24口
  FIBER_PATCH_24: {
    name: '24口光纤配线架',
    type: 'FIBER' as PanelType,
    portCount: 24,
    description: 'LC双工光纤配线架',
  },

  // PDU 8口
  PDU_8: {
    name: '8口PDU',
    type: 'POWER' as PanelType,
    portCount: 8,
    description: '标准8口电源分配单元',
  },
};

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
