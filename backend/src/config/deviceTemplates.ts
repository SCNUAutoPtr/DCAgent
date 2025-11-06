/**
 * 联想 WR5220G3 机型 SNMP 配置模板
 *
 * 基于实际测试的 116.57.62.8 服务器数据
 */

export interface DeviceTemplate {
  model: string;
  vendor: 'lenovo' | 'dell' | 'hp';
  description: string;
  oids: {
    temperature: string[];
    fan: string[];
    power: string[];
    voltage: string[];
  };
  sensorMapping?: {
    [key: string]: {
      displayName: string;
      category: 'temperature' | 'fan' | 'power' | 'voltage';
      unit: string;
      thresholds?: {
        warning?: number;
        critical?: number;
      };
    };
  };
}

/**
 * 联想 WR5220G3 服务器模板
 * 基于测试数据的完整配置
 */
export const WR5220G3_TEMPLATE: DeviceTemplate = {
  model: 'WR5220G3',
  vendor: 'lenovo',
  description: 'Lenovo ThinkSystem WR5220G3 Server',

  oids: {
    // 温度传感器 OID（53个）
    temperature: [
      '1.3.6.1.4.1.53184.1.2.1.4.1',   // CPU 温度
      '1.3.6.1.4.1.53184.1.2.1.4.2',   // 系统温度
      '1.3.6.1.4.1.53184.1.2.1.4.3',   // 内存温度
      '1.3.6.1.4.1.53184.1.2.1.4.4',   // PCH 温度
      '1.3.6.1.4.1.53184.1.2.1.4.5',   // 电源温度
      // ... 可以添加所有 53 个温度传感器 OID
    ],

    // 风扇 OID（17个）
    fan: [
      '1.3.6.1.4.1.53184.1.2.1.4.54',  // Fan 1 Front
      '1.3.6.1.4.1.53184.1.2.1.4.55',  // Fan 1 Rear
      '1.3.6.1.4.1.53184.1.2.1.4.56',  // Fan 2 Front
      '1.3.6.1.4.1.53184.1.2.1.4.57',  // Fan 2 Rear
      // ... 17 个风扇传感器
    ],

    // 功率传感器 OID（21个）
    power: [
      '1.3.6.1.4.1.53184.1.3.1.14',    // Total Power
      '1.3.6.1.4.1.53184.1.3.1.15',    // CPU Power
      '1.3.6.1.4.1.53184.1.3.1.16',    // Memory Power
      '1.3.6.1.4.1.53184.1.3.1.19',    // 24h Avg Power
      '1.3.6.1.4.1.53184.1.3.1.20',    // 24h Max Power
      '1.3.6.1.4.1.53184.1.3.1.21',    // 24h Min Power
      // ... 功率传感器
    ],

    // 电压传感器 OID（19个）
    voltage: [
      '1.3.6.1.4.1.53184.1.2.1.4.71',  // CPU Voltage
      '1.3.6.1.4.1.53184.1.2.1.4.72',  // Memory Voltage
      // ... 电压传感器
    ],
  },

  // 传感器名称映射和阈值配置
  sensorMapping: {
    // 温度传感器
    'CPU0_Temp': {
      displayName: 'CPU 0 温度',
      category: 'temperature',
      unit: '°C',
      thresholds: {
        warning: 75,
        critical: 85,
      },
    },
    'CPU1_Temp': {
      displayName: 'CPU 1 温度',
      category: 'temperature',
      unit: '°C',
      thresholds: {
        warning: 75,
        critical: 85,
      },
    },
    'Sys_Inlet_Temp': {
      displayName: '系统进风口温度',
      category: 'temperature',
      unit: '°C',
      thresholds: {
        warning: 40,
        critical: 50,
      },
    },
    'Sys_Outlet_Temp': {
      displayName: '系统出风口温度',
      category: 'temperature',
      unit: '°C',
      thresholds: {
        warning: 65,
        critical: 75,
      },
    },
    'PCH_Temp': {
      displayName: 'PCH 芯片温度',
      category: 'temperature',
      unit: '°C',
      thresholds: {
        warning: 80,
        critical: 90,
      },
    },

    // 风扇传感器
    'FAN1_Speed_F': {
      displayName: '风扇 1 前转子',
      category: 'fan',
      unit: 'RPM',
      thresholds: {
        warning: 2000,  // 低于此值告警
        critical: 1000,
      },
    },
    'FAN1_Speed_R': {
      displayName: '风扇 1 后转子',
      category: 'fan',
      unit: 'RPM',
      thresholds: {
        warning: 2000,
        critical: 1000,
      },
    },

    // 功率传感器
    'Total_Power': {
      displayName: '总功耗',
      category: 'power',
      unit: 'W',
      thresholds: {
        warning: 800,
        critical: 1000,
      },
    },
    'CPU_Power': {
      displayName: 'CPU 功耗',
      category: 'power',
      unit: 'W',
    },
    'MEM_Power': {
      displayName: '内存功耗',
      category: 'power',
      unit: 'W',
    },
  },
};

/**
 * 设备模板注册表
 */
export const DEVICE_TEMPLATES: { [key: string]: DeviceTemplate } = {
  'WR5220G3': WR5220G3_TEMPLATE,
  // 未来可以添加更多机型
  // 'SR650': SR650_TEMPLATE,
  // 'SR850': SR850_TEMPLATE,
};

/**
 * 根据机型获取模板
 */
export function getTemplateByModel(model: string): DeviceTemplate | null {
  return DEVICE_TEMPLATES[model] || null;
}

/**
 * 检测设备机型
 */
export async function detectDeviceModel(systemModel: string): Promise<string | null> {
  // 从系统型号中提取机型信息
  // 例如："Lenovo ThinkSystem WR5220G3" -> "WR5220G3"
  const match = systemModel.match(/WR\d+G\d+|SR\d+|HR\d+/i);
  return match ? match[0].toUpperCase() : null;
}
