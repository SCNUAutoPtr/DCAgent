import snmp from 'net-snmp';

// 常用的 OID 定义
export const COMMON_OIDS = {
  // 系统信息
  sysDescr: '1.3.6.1.2.1.1.1.0',           // 系统描述
  sysObjectID: '1.3.6.1.2.1.1.2.0',        // 系统 OID
  sysUpTime: '1.3.6.1.2.1.1.3.0',          // 系统运行时间
  sysContact: '1.3.6.1.2.1.1.4.0',         // 联系人
  sysName: '1.3.6.1.2.1.1.5.0',            // 系统名称
  sysLocation: '1.3.6.1.2.1.1.6.0',        // 系统位置

  // 硬件信息
  hrSystemUptime: '1.3.6.1.2.1.25.1.1.0',  // 硬件运行时间
  hrSystemDate: '1.3.6.1.2.1.25.1.2.0',    // 系统日期

  // CPU 和内存
  hrProcessorLoad: '1.3.6.1.2.1.25.3.3.1.2', // CPU 负载（表）
  hrMemorySize: '1.3.6.1.2.1.25.2.2.0',      // 内存大小
  hrStorageDescr: '1.3.6.1.2.1.25.2.3.1.3',  // 存储描述（表）
  hrStorageSize: '1.3.6.1.2.1.25.2.3.1.5',   // 存储大小（表）
  hrStorageUsed: '1.3.6.1.2.1.25.2.3.1.6',   // 存储使用（表）

  // 网络接口
  ifNumber: '1.3.6.1.2.1.2.1.0',             // 接口数量
  ifDescr: '1.3.6.1.2.1.2.2.1.2',            // 接口描述（表）
  ifType: '1.3.6.1.2.1.2.2.1.3',             // 接口类型（表）
  ifMtu: '1.3.6.1.2.1.2.2.1.4',              // 接口 MTU（表）
  ifSpeed: '1.3.6.1.2.1.2.2.1.5',            // 接口速度（表）
  ifPhysAddress: '1.3.6.1.2.1.2.2.1.6',      // 物理地址（表）
  ifAdminStatus: '1.3.6.1.2.1.2.2.1.7',      // 管理状态（表）
  ifOperStatus: '1.3.6.1.2.1.2.2.1.8',       // 运行状态（表）
  ifInOctets: '1.3.6.1.2.1.2.2.1.10',        // 入站字节（表）
  ifOutOctets: '1.3.6.1.2.1.2.2.1.16',       // 出站字节（表）

  // IPMI/BMC 特定 OID（Dell iDRAC 示例）
  dell: {
    systemModelName: '1.3.6.1.4.1.674.10892.5.1.3.12.0',      // 系统型号
    systemServiceTag: '1.3.6.1.4.1.674.10892.5.1.3.2.0',      // 服务标签
    biosVersion: '1.3.6.1.4.1.674.10892.5.4.300.50.1.8.1.1',  // BIOS 版本
    firmwareVersion: '1.3.6.1.4.1.674.10892.5.4.300.60.1.8.1.1', // 固件版本

    // 传感器
    temperatureSensorDescr: '1.3.6.1.4.1.674.10892.5.4.700.20.1.8',  // 温度传感器描述
    temperatureSensorReading: '1.3.6.1.4.1.674.10892.5.4.700.20.1.6', // 温度读数

    powerSupplyStatus: '1.3.6.1.4.1.674.10892.5.4.600.12.1.5',   // 电源状态
    fanSensorReading: '1.3.6.1.4.1.674.10892.5.4.700.12.1.6',    // 风扇转速
  },

  // HP iLO OID
  hp: {
    serverName: '1.3.6.1.4.1.232.2.2.2.1.0',
    serverModel: '1.3.6.1.4.1.232.2.2.4.2.0',
    biosVersion: '1.3.6.1.4.1.232.2.2.4.3.0',
  },

  // Lenovo/IBM OID (基于官方 MIB 文档)
  lenovo: {
    // ========== 基础信息 (1.3.6.1.4.1.53184) ==========
    // FRU Info (2.2)
    fruTable: '1.3.6.1.4.1.53184.2.2.1',
    systemModel: '1.3.6.1.4.1.53184.2.2.1.14',             // 产品名称
    systemSerialNumber: '1.3.6.1.4.1.53184.2.2.1.17',      // 产品序列号

    // Software Info (7.2)
    bmcVersion: '1.3.6.1.4.1.53184.7.2.1',                 // BMC 版本
    uefiVersion: '1.3.6.1.4.1.53184.7.2.2',                // UEFI 版本

    // ========== 传感器信息 (1.2.1) - 最重要的监控数据 ==========
    sensorNum: '1.3.6.1.4.1.53184.1.2.1.1',                // 传感器 ID
    sensorType: '1.3.6.1.4.1.53184.1.2.1.2',               // 传感器类型
    sensorName: '1.3.6.1.4.1.53184.1.2.1.3',               // 传感器名称
    sensorValue: '1.3.6.1.4.1.53184.1.2.1.4',              // 传感器读数（核心！）
    sensorStatus: '1.3.6.1.4.1.53184.1.2.1.5',             // 传感器状态

    // ========== 健康状态汇总 (17.2.1) - 推荐用于快速监控 ==========
    healthIndex: '1.3.6.1.4.1.53184.17.2.1.1',             // Health ID
    overallStatus: '1.3.6.1.4.1.53184.17.2.1.2',           // 整体状态 (OK/Warning/Critical)
    cpuStatus: '1.3.6.1.4.1.53184.17.2.1.3',               // CPU 整体状态
    memStatus: '1.3.6.1.4.1.53184.17.2.1.4',               // 内存整体状态
    diskStatus: '1.3.6.1.4.1.53184.17.2.1.5',              // 硬盘整体状态
    fanStatus: '1.3.6.1.4.1.53184.17.2.1.7',               // 风扇整体状态
    tempStatus: '1.3.6.1.4.1.53184.17.2.1.8',              // 温度整体状态
    voltageStatus: '1.3.6.1.4.1.53184.17.2.1.9',           // 电压整体状态
    powerStatus: '1.3.6.1.4.1.53184.17.2.1.10',            // 电源整体状态

    // ========== 功耗和性能 (17.2.1) ==========
    currentPower: '1.3.6.1.4.1.53184.17.2.1.13',           // 当前功耗 (瓦)
    avgPowerInDay: '1.3.6.1.4.1.53184.17.2.1.14',          // 24小时平均功耗
    maxPowerInDay: '1.3.6.1.4.1.53184.17.2.1.15',          // 24小时最大功耗
    minPowerInDay: '1.3.6.1.4.1.53184.17.2.1.16',          // 24小时最小功耗
    cpuUtilization: '1.3.6.1.4.1.53184.17.2.1.17',         // CPU 利用率
    memUtilization: '1.3.6.1.4.1.53184.17.2.1.18',         // 内存带宽利用率
    ioUtilization: '1.3.6.1.4.1.53184.17.2.1.19',          // I/O 利用率

    // ========== CPU 信息 (8.2.1) ==========
    cpuTable: '1.3.6.1.4.1.53184.8.2.1',
    cpuIndex: '1.3.6.1.4.1.53184.8.2.1.1',
    cpuCores: '1.3.6.1.4.1.53184.8.2.1.2',
    cpuThreads: '1.3.6.1.4.1.53184.8.2.1.3',
    cpuModel: '1.3.6.1.4.1.53184.8.2.1.10',
    cpuHealthStatus: '1.3.6.1.4.1.53184.8.2.1.13',

    // ========== 内存信息 (9.2.1) ==========
    memTable: '1.3.6.1.4.1.53184.9.2.1',
    memIndex: '1.3.6.1.4.1.53184.9.2.1.1',
    memCapacity: '1.3.6.1.4.1.53184.9.2.1.2',
    memType: '1.3.6.1.4.1.53184.9.2.1.8',
    memHealthStatus: '1.3.6.1.4.1.53184.9.2.1.10',

    // ========== 电源信息 (10.2.1) ==========
    psuTable: '1.3.6.1.4.1.53184.10.2.1',
    psuIndex: '1.3.6.1.4.1.53184.10.2.1.1',
    psuInputVoltage: '1.3.6.1.4.1.53184.10.2.1.2',
    psuCapacity: '1.3.6.1.4.1.53184.10.2.1.3',
    psuInputWatts: '1.3.6.1.4.1.53184.10.2.1.4',
    psuOutputWatts: '1.3.6.1.4.1.53184.10.2.1.5',
    psuHealthStatus: '1.3.6.1.4.1.53184.10.2.1.13',

    // ========== 硬盘信息 (16.2.1) ==========
    diskTable: '1.3.6.1.4.1.53184.16.2.1',
    diskIndex: '1.3.6.1.4.1.53184.16.2.1.1',
    diskCapacity: '1.3.6.1.4.1.53184.16.2.1.2',
    diskModel: '1.3.6.1.4.1.53184.16.2.1.7',
    diskHealthStatus: '1.3.6.1.4.1.53184.16.2.1.13',

    // ========== 风扇信息 (19.2.1) ==========
    fanTable: '1.3.6.1.4.1.53184.19.2.1',
    fanIndex: '1.3.6.1.4.1.53184.19.2.1.1',
    fanFrontSpeed: '1.3.6.1.4.1.53184.19.2.1.2',           // 前转子转速
    fanRearSpeed: '1.3.6.1.4.1.53184.19.2.1.3',            // 后转子转速
    fanDutyRatio: '1.3.6.1.4.1.53184.19.2.1.4',            // 实际/全速百分比
    fanHealthStatus: '1.3.6.1.4.1.53184.19.2.1.5',

    // ========== 旧版兼容 OID (1.3.6.1.4.1.2.3.51) ==========
    legacyHealthStat: '1.3.6.1.4.1.2.3.51.3.1.4.1.0',      // 旧版系统健康状态
    legacyBiosVersion: '1.3.6.1.4.1.2.3.51.3.1.5.1.1.3.0', // 旧版 BIOS 版本
  },
};

export interface SNMPConfig {
  host: string;
  port?: number;
  community?: string;
  version?: number;
  timeout?: number;
  retries?: number;
}

export interface SNMPResult {
  oid: string;
  type: string;
  value: any;
  name?: string;
}

export class SNMPService {
  private session: snmp.Session | null = null;
  private config: SNMPConfig;

  constructor(config: SNMPConfig) {
    this.config = {
      port: 161,
      community: 'public',
      version: snmp.Version2c,
      timeout: 5000,
      retries: 1,
      ...config,
    };
  }

  /**
   * 创建 SNMP 会话
   */
  private createSession(): snmp.Session {
    if (this.session) {
      return this.session;
    }

    const options: snmp.SessionOptions = {
      port: this.config.port,
      retries: this.config.retries,
      timeout: this.config.timeout,
    };

    this.session = snmp.createSession(
      this.config.host,
      this.config.community || 'public',
      options
    );

    return this.session;
  }

  /**
   * 关闭会话
   */
  close(): void {
    if (this.session) {
      this.session.close();
      this.session = null;
    }
  }

  /**
   * GET - 获取单个或多个 OID 的值
   */
  async get(oids: string | string[]): Promise<SNMPResult[]> {
    return new Promise((resolve, reject) => {
      const session = this.createSession();
      const oidArray = Array.isArray(oids) ? oids : [oids];

      session.get(oidArray, (error, varbinds) => {
        if (error) {
          reject(error);
          return;
        }

        if (!varbinds) {
          resolve([]);
          return;
        }

        const results: SNMPResult[] = [];
        for (const vb of varbinds) {
          if (snmp.isVarbindError(vb)) {
            console.error(`Error for OID ${vb.oid}: ${snmp.varbindError(vb)}`);
            continue;
          }

          results.push({
            oid: vb.oid,
            type: this.getTypeString(vb.type || snmp.ObjectType.OctetString),
            value: this.formatValue(vb),
          });
        }

        resolve(results);
      });
    });
  }

  /**
   * WALK - 遍历 OID 树
   */
  async walk(oid: string): Promise<SNMPResult[]> {
    return new Promise((resolve, reject) => {
      const session = this.createSession();
      const results: SNMPResult[] = [];

      const maxRepetitions = 20;

      session.walk(
        oid,
        maxRepetitions,
        (varbinds) => {
          for (const vb of varbinds) {
            if (snmp.isVarbindError(vb)) {
              console.error(`Error for OID ${vb.oid}: ${snmp.varbindError(vb)}`);
              continue;
            }

            results.push({
              oid: vb.oid,
              type: this.getTypeString(vb.type || snmp.ObjectType.OctetString),
              value: this.formatValue(vb),
            });
          }
        },
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve(results);
          }
        }
      );
    });
  }

  /**
   * 获取系统基本信息
   */
  async getSystemInfo() {
    const oids = [
      COMMON_OIDS.sysDescr,
      COMMON_OIDS.sysName,
      COMMON_OIDS.sysLocation,
      COMMON_OIDS.sysContact,
      COMMON_OIDS.sysUpTime,
    ];

    const results = await this.get(oids);

    return {
      description: results[0]?.value || 'N/A',
      hostname: results[1]?.value || 'N/A',
      location: results[2]?.value || 'N/A',
      contact: results[3]?.value || 'N/A',
      uptime: this.formatUptime(results[4]?.value || 0),
    };
  }

  /**
   * 获取网络接口信息
   */
  async getNetworkInterfaces() {
    const interfaces: any[] = [];

    try {
      // 获取接口数量
      const ifNumberResult = await this.get(COMMON_OIDS.ifNumber);
      const ifCount = ifNumberResult[0]?.value || 0;

      // 遍历每个接口
      for (let i = 1; i <= ifCount; i++) {
        const oids = [
          `${COMMON_OIDS.ifDescr}.${i}`,
          `${COMMON_OIDS.ifType}.${i}`,
          `${COMMON_OIDS.ifSpeed}.${i}`,
          `${COMMON_OIDS.ifPhysAddress}.${i}`,
          `${COMMON_OIDS.ifOperStatus}.${i}`,
        ];

        const results = await this.get(oids);

        interfaces.push({
          index: i,
          description: results[0]?.value || 'N/A',
          type: results[1]?.value || 'N/A',
          speed: this.formatSpeed(results[2]?.value || 0),
          macAddress: this.formatMacAddress(results[3]?.value),
          status: this.formatInterfaceStatus(results[4]?.value),
        });
      }
    } catch (error) {
      console.error('Error getting network interfaces:', error);
    }

    return interfaces;
  }

  /**
   * 获取 Dell iDRAC BMC 信息
   */
  async getDellBMCInfo() {
    try {
      const oids = [
        COMMON_OIDS.dell.systemModelName,
        COMMON_OIDS.dell.systemServiceTag,
        COMMON_OIDS.dell.biosVersion,
      ];

      const results = await this.get(oids);

      return {
        model: results[0]?.value || 'N/A',
        serviceTag: results[1]?.value || 'N/A',
        biosVersion: results[2]?.value || 'N/A',
      };
    } catch (error) {
      console.error('Error getting Dell BMC info:', error);
      return null;
    }
  }

  /**
   * 获取 Lenovo BMC 信息
   */
  async getLenovoBMCInfo() {
    try {
      // 先尝试获取基本信息（这些是必需的，用于判断是否为联想设备）
      const basicOids = [
        COMMON_OIDS.lenovo.systemModel,
        COMMON_OIDS.lenovo.systemSerialNumber,
        COMMON_OIDS.lenovo.bmcVersion,
      ];

      const basicResults = await this.get(basicOids);

      // 如果基本信息都获取不到，说明不是联想设备
      if (!basicResults[0]?.value && !basicResults[1]?.value) {
        return null;
      }

      // 尝试获取健康状态（可选，有些设备可能不支持）
      let healthStatus = 'N/A';
      try {
        const healthResult = await this.get([COMMON_OIDS.lenovo.overallStatus]);
        if (healthResult[0]?.value !== undefined) {
          healthStatus = this.formatLenovoHealthStatus(healthResult[0].value);
        }
      } catch (healthError) {
        console.log('Health status not available for this device');
      }

      return {
        systemModel: basicResults[0]?.value || 'N/A',
        model: basicResults[0]?.value || 'N/A',
        serialNumber: basicResults[1]?.value || 'N/A',
        bmcVersion: basicResults[2]?.value || 'N/A',
        healthStatus,
      };
    } catch (error) {
      console.error('Error getting Lenovo BMC info:', error);
      return null;
    }
  }

  /**
   * 获取联想所有传感器信息（更准确的方法）
   */
  async getLenovoSensors() {
    try {
      // 使用 sensorName OID 获取所有传感器名称
      const sensorNames = await this.walk(COMMON_OIDS.lenovo.sensorName);

      if (sensorNames.length === 0) {
        return [];
      }

      // 过滤出真正的传感器（排除SNMP元数据）
      const realSensors = sensorNames
        .filter((s) => {
          const name = String(s.value);
          // 排除 SNMP 系统模块名
          return (
            name.length > 0 &&
            !name.includes('snmpd') &&
            !name.includes('ucd-snmp') &&
            !name.includes('mibII') &&
            !name.includes('/') &&  // 排除路径
            !name.startsWith('host/') &&
            !name.startsWith('mibII/') &&
            !name.includes('Table') &&
            !name.includes('Stats') &&
            name !== 'ip' &&
            name !== 'icmp' &&
            name !== 'tcp' &&
            name !== 'udp' &&
            name !== 'snmp'
          );
        })
        .map((s, index) => ({
          index: index + 1,
          oid: s.oid,
          name: String(s.value),
        }));

      return realSensors;
    } catch (error) {
      console.error('Error getting Lenovo sensors:', error);
      return [];
    }
  }

  /**
   * 获取联想传感器的值
   */
  async getLenovoSensorValues(sensorOids?: string[]) {
    try {
      let oids: string[];

      if (sensorOids) {
        // 如果提供了传感器 OID，构造对应的 value OID
        oids = sensorOids.map((oid) => {
          // sensorName 的 OID 是 .3，sensorValue 的 OID 是 .4
          return oid.replace('.1.2.1.3.', '.1.2.1.4.');
        });
      } else {
        // 否则 walk 整个 sensorValue 树并过滤
        const allValues = await this.walk(COMMON_OIDS.lenovo.sensorValue);

        return allValues
          .filter((s) => {
            const value = String(s.value);
            // 只保留看起来像真实传感器读数的值
            return (
              value.match(/degrees C|Volts|Amps|Watts|RPM|PWM|percent/) ||
              value.match(/^[A-Z_][A-Za-z0-9_]*$/)  // 传感器名称格式
            );
          })
          .map((s, index) => ({
            index: index + 1,
            oid: s.oid,
            value: String(s.value),
          }));
      }

      const results = await this.get(oids);
      return results.map((r, index) => ({
        index: index + 1,
        oid: r.oid,
        value: String(r.value),
      }));
    } catch (error) {
      console.error('Error getting Lenovo sensor values:', error);
      return [];
    }
  }

  /**
   * 获取联想温度传感器信息
   */
  async getLenovoTemperatureSensors() {
    try {
      // 获取所有传感器
      const sensors = await this.getLenovoSensors();

      // 过滤温度传感器
      const tempSensors = sensors.filter((s) =>
        s.name.includes('Temp') || s.name.includes('_T')
      );

      // 获取温度值
      if (tempSensors.length > 0) {
        const valueOids = tempSensors.map((s) =>
          s.oid.replace('.1.2.1.3.', '.1.2.1.4.')
        );
        const values = await this.get(valueOids);

        return tempSensors.map((sensor, index) => ({
          index: index + 1,
          oid: sensor.oid,
          name: sensor.name,
          reading: String(values[index]?.value || 'N/A'),
        }));
      }

      return [];
    } catch (error) {
      console.error('Error getting Lenovo temperature sensors:', error);
      return [];
    }
  }

  /**
   * 获取联想风扇信息
   */
  async getLenovoFans() {
    try {
      // 获取所有传感器
      const sensors = await this.getLenovoSensors();

      // 过滤风扇传感器
      const fanSensors = sensors.filter((s) =>
        s.name.includes('FAN') || s.name.includes('Fan') || s.name.includes('Speed')
      );

      // 获取风扇转速值
      if (fanSensors.length > 0) {
        const valueOids = fanSensors.map((s) =>
          s.oid.replace('.1.2.1.3.', '.1.2.1.4.')
        );
        const values = await this.get(valueOids);

        return fanSensors.map((sensor, index) => ({
          index: index + 1,
          oid: sensor.oid,
          name: sensor.name,
          speed: String(values[index]?.value || 'N/A'),
        }));
      }

      return [];
    } catch (error) {
      console.error('Error getting Lenovo fans:', error);
      return [];
    }
  }

  /**
   * 获取温度传感器信息（Dell）
   */
  async getTemperatureSensors() {
    try {
      const sensors = await this.walk(COMMON_OIDS.dell.temperatureSensorReading);
      return sensors.map((sensor, index) => ({
        index: index + 1,
        reading: `${(sensor.value / 10).toFixed(1)}°C`, // Dell 返回的是 1/10 摄氏度
      }));
    } catch (error) {
      console.error('Error getting temperature sensors:', error);
      return [];
    }
  }

  /**
   * 格式化联想健康状态
   */
  private formatLenovoHealthStatus(status: number): string {
    const statuses: { [key: number]: string } = {
      0: 'Unknown',
      1: 'Good',
      2: 'Warning',
      3: 'Critical',
      4: 'Non-recoverable',
      255: 'Not Available',
    };
    return statuses[status] || `Unknown (${status})`;
  }

  /**
   * 格式化值
   */
  private formatValue(varbind: any): any {
    switch (varbind.type) {
      case snmp.ObjectType.OctetString:
        // 尝试转换为字符串
        const str = varbind.value.toString('utf8');
        // 如果包含不可打印字符，返回十六进制
        if (/[\x00-\x1F\x7F-\x9F]/.test(str) && str.length <= 6) {
          return varbind.value.toString('hex').match(/.{2}/g)?.join(':') || str;
        }
        return str;
      case snmp.ObjectType.Integer:
      case snmp.ObjectType.Counter:
      case snmp.ObjectType.Gauge:
      case snmp.ObjectType.TimeTicks:
      case snmp.ObjectType.Counter64:
        return varbind.value;
      case snmp.ObjectType.IpAddress:
        return varbind.value.join('.');
      case snmp.ObjectType.OID:
        return varbind.value;
      default:
        return varbind.value;
    }
  }

  /**
   * 获取类型字符串
   */
  private getTypeString(type: number): string {
    const types: { [key: number]: string } = {
      [snmp.ObjectType.Boolean]: 'Boolean',
      [snmp.ObjectType.Integer]: 'Integer',
      [snmp.ObjectType.OctetString]: 'OctetString',
      [snmp.ObjectType.Null]: 'Null',
      [snmp.ObjectType.OID]: 'OID',
      [snmp.ObjectType.IpAddress]: 'IpAddress',
      [snmp.ObjectType.Counter]: 'Counter',
      [snmp.ObjectType.Gauge]: 'Gauge',
      [snmp.ObjectType.TimeTicks]: 'TimeTicks',
      [snmp.ObjectType.Opaque]: 'Opaque',
      [snmp.ObjectType.Counter64]: 'Counter64',
    };
    return types[type] || 'Unknown';
  }

  /**
   * 格式化运行时间
   */
  private formatUptime(ticks: number): string {
    const seconds = Math.floor(ticks / 100);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    return `${days}d ${hours}h ${minutes}m`;
  }

  /**
   * 格式化速度
   */
  private formatSpeed(bps: number): string {
    if (bps >= 1000000000) {
      return `${(bps / 1000000000).toFixed(1)} Gbps`;
    } else if (bps >= 1000000) {
      return `${(bps / 1000000).toFixed(1)} Mbps`;
    } else if (bps >= 1000) {
      return `${(bps / 1000).toFixed(1)} Kbps`;
    }
    return `${bps} bps`;
  }

  /**
   * 格式化 MAC 地址
   */
  private formatMacAddress(value: any): string {
    if (!value) return 'N/A';
    if (typeof value === 'string') {
      return value;
    }
    if (Buffer.isBuffer(value)) {
      return value.toString('hex').match(/.{2}/g)?.join(':') || 'N/A';
    }
    return 'N/A';
  }

  /**
   * 格式化接口状态
   */
  private formatInterfaceStatus(status: number): string {
    const statuses: { [key: number]: string } = {
      1: 'up',
      2: 'down',
      3: 'testing',
      4: 'unknown',
      5: 'dormant',
      6: 'notPresent',
      7: 'lowerLayerDown',
    };
    return statuses[status] || 'unknown';
  }
}

/**
 * 创建 SNMP 客户端
 */
export function createSNMPClient(config: SNMPConfig): SNMPService {
  return new SNMPService(config);
}
