# SNMP 监控功能说明

## 功能概述

DCAgent 现已集成 SNMP v2c 协议，支持对数据中心服务器设备进行实时监控，包括温度、风扇、电源、网络等关键指标的采集和展示。

## 已完成的功能

### 后端功能

#### 1. SNMP 服务层 (`backend/src/services/snmpService.ts`)

**核心功能：**
- SNMP v2c 协议支持
- 多厂商支持（Lenovo、Dell、HP）
- 完整的 OID 定义库

**联想服务器 OID 定义：**
基于官方 Lenovo BMC SNMP MIB 文档，包含 56 个 OID：

- **基础信息**: 系统型号、序列号、BMC版本、UEFI版本
- **传感器信息**: 传感器名称、类型、读数、状态（最核心）
- **健康状态**: 整体状态、CPU、内存、硬盘、风扇、温度、电压、电源状态
- **功耗和性能**: 当前功耗、24h平均/最大/最小功耗、CPU/内存/IO 利用率
- **硬件详情**: CPU（核心、线程、型号）、内存（容量、类型）、电源（电压、功率）、硬盘、风扇

**主要方法：**
```typescript
// 通用方法
get(oids: string | string[]): Promise<SNMPResult[]>
walk(oid: string): Promise<SNMPResult[]>

// 系统信息
getSystemInfo(): Promise<{...}>
getNetworkInterfaces(): Promise<any[]>

// 联想特有方法
getLenovoBMCInfo(): Promise<{...}>
getLenovoSensors(): Promise<SensorData[]>
getLenovoTemperatureSensors(): Promise<SensorData[]>
getLenovoFans(): Promise<SensorData[]>
getLenovoSensorValues(sensorOids?: string[]): Promise<any[]>

// Dell 特有方法
getDellBMCInfo(): Promise<{...}>
getTemperatureSensors(): Promise<any[]>  // Dell
```

#### 2. 测试脚本

**`test-lenovo.ts`** - 联想服务器专用测试
- 测试 SNMP 连接
- 获取温度传感器数据
- 获取风扇信息
- 获取所有传感器信息（分类展示）

**`snmp-walk.ts`** - OID 树探测工具
- 遍历指定 OID 树
- 自动分组和统计
- 导出为 JSON 文件
- 关键词搜索

**使用方法：**
```bash
# 测试联想服务器
npm run test:lenovo -- <IP地址> [community]
# 例如: npm run test:lenovo -- 192.168.1.100 public

# SNMP Walk 探测
npm run snmp:walk -- <IP地址> [community] [起始OID]
# 例如: npm run snmp:walk -- 192.168.1.100 public 1.3.6.1.4.1.53184
```

#### 3. 传感器数据过滤

**智能过滤算法：**
- 使用 `sensorName` OID 获取传感器名称
- 排除 SNMP 系统元数据（snmpd、ucd-snmp、mibII 等）
- 排除系统路径和表名
- 通过传感器名称模式匹配真实传感器

**测试结果（203.0.113.8）：**
- 温度传感器: 51-53 个（包括 CPU、系统进出口、PCH、PSU 等）
- 风扇: 17 个（包括前后转子、PWM 占空比）
- 电压: 19 个传感器
- 功率: 21 个传感器（包括 PSU、CPU、内存、总功耗等）

### 前端功能

#### 1. 监控主页面 (`frontend/src/pages/MonitoringPage.tsx`)

**页面布局：**
- **左侧边栏**: 设备列表
  - 显示所有监控设备
  - 实时状态指示灯（绿/黄/红）
  - 最后更新时间
  - 点击切换设备

- **右侧主区域**: 设备详情（Tab 标签页）
  - **概览 Tab**:
    - 设备状态卡片
    - 平均温度卡片
    - 当前功耗卡片
    - 关键传感器网格展示（6个）

  - **温度 Tab**:
    - 所有温度传感器网格展示
    - 根据温度自动高亮（>80°C 红色，>60°C 黄色）

  - **风扇 Tab**:
    - 所有风扇状态和转速
    - 转速显示（RPM 或 PWM）

  - **电源 Tab**:
    - 总功耗
    - CPU 功耗
    - 内存功耗
    - 24h 平均功耗

**交互功能：**
- 手动刷新按钮
- 设备切换
- 温度预警高亮
- 状态徽章（正常/警告/异常）

#### 2. 添加设备弹窗 (`frontend/src/components/AddDeviceModal.tsx`)

**功能：**
- 设备信息输入（名称、IP、Community String）
- 设备厂商选择（自动检测/Lenovo/Dell/HP）
- 连接测试按钮
  - 验证 SNMP 可达性
  - 自动检测设备厂商
  - 显示测试结果（成功/失败）
- 添加设备到监控列表

#### 3. 前端服务层 (`frontend/src/services/monitoringService.ts`)

**API 接口定义：**
```typescript
// 设备管理
getDevices(): Promise<MonitoringDevice[]>
addDevice(device: {...}): Promise<MonitoringDevice>
deleteDevice(deviceId: string): Promise<void>
testConnection(ip: string, community: string): Promise<{...}>

// 数据获取
getTemperature(deviceId: string): Promise<SensorData[]>
getFans(deviceId: string): Promise<SensorData[]>
getPower(deviceId: string): Promise<PowerMetrics>
getHealth(deviceId: string): Promise<HealthStatus>
getAllSensors(deviceId: string): Promise<SensorData[]>

// 批量操作
bulkImportDevices(devices: Array<{...}>): Promise<{...}>

// 历史数据
getHistoricalData(deviceId: string, sensorName: string, timeRange: {...}): Promise<any[]>
```

#### 4. 路由集成

**菜单位置：**
- 主菜单添加"设备监控"入口
- 图标: MonitorOutlined
- 路由: `/monitoring`

## 技术特点

### 1. 智能传感器识别
- 自动过滤 SNMP 系统元数据
- 基于传感器名称的精确匹配
- 支持多厂商 MIB 结构

### 2. 多厂商支持
- Lenovo: 完整的 MIB 定义（56 个 OID）
- Dell: iDRAC 支持
- HP: iLO 支持
- 可扩展架构

### 3. 用户友好
- 直观的 UI 设计
- 颜色编码状态指示
- 温度预警高亮
- 实时数据刷新

### 4. 可扩展性
- 模块化设计
- 统一的服务接口
- 类型安全（TypeScript）

## 配置要求

### 服务器端

1. **启用 SNMP v2c**
   ```bash
   # Lenovo 服务器
   # 在 BMC 管理界面启用 SNMP
   # 设置 Community String（默认: public）
   ```

2. **网络配置**
   - SNMP 端口: 161 (UDP)
   - 确保防火墙允许 SNMP 流量

### 客户端

1. **依赖安装**
   ```bash
   # 后端
   cd backend
   npm install net-snmp

   # 前端（已包含）
   cd frontend
   npm install
   ```

2. **环境要求**
   - Node.js >= 18
   - TypeScript >= 5.0

## 使用流程

### 1. 添加监控设备

1. 访问 `/monitoring` 页面
2. 点击"添加设备"按钮
3. 填写设备信息：
   - 设备名称（自定义）
   - IP 地址
   - Community String（默认 public）
   - 设备厂商（可选，支持自动检测）
4. 点击"测试连接"验证
5. 点击"添加设备"完成

### 2. 查看监控数据

1. 在左侧设备列表选择设备
2. 查看不同 Tab 的监控数据：
   - 概览：关键指标汇总
   - 温度：所有温度传感器
   - 风扇：风扇转速和状态
   - 电源：功耗统计
3. 点击"刷新"按钮获取最新数据

### 3. 批量导入设备

使用 API 批量导入：
```typescript
const devices = [
  { name: 'Server-01', ip: '192.168.1.100', community: 'public' },
  { name: 'Server-02', ip: '192.168.1.101', community: 'public' },
  // ...
];

await monitoringService.bulkImportDevices(devices);
```

## 监控指标说明

### 温度传感器

| 传感器名称 | 说明 |
|-----------|------|
| Sys_Inlet_Temp | 系统进风口温度 |
| Sys_Outlet_Temp | 系统出风口温度 |
| CPU0_Temp | CPU 0 温度 |
| CPU1_Temp | CPU 1 温度 |
| CPU0_DIMM_T | CPU 0 内存温度 |
| CPU1_DIMM_T | CPU 1 内存温度 |
| PCH_Temp | PCH 芯片温度 |
| PSU1_Temp | 电源 1 温度 |
| PSU2_Temp | 电源 2 温度 |

### 风扇传感器

| 传感器名称 | 说明 |
|-----------|------|
| FAN1_Speed_F | 风扇 1 前转子转速 |
| FAN1_Speed_R | 风扇 1 后转子转速 |
| FAN2_Speed_F | 风扇 2 前转子转速 |
| FAN2_Speed_R | 风扇 2 后转子转速 |

### 功率传感器

| 传感器名称 | 说明 |
|-----------|------|
| Total_Power | 总功耗 |
| CPU_Power | CPU 功耗 |
| MEM_Power | 内存功耗 |
| FAN_Power | 风扇功耗 |
| PSU1_PIN | 电源 1 输入功率 |
| PSU1_POUT | 电源 1 输出功率 |

## 故障排查

### 常见问题

**1. 连接测试失败**
- 检查 IP 地址是否正确
- 检查 Community String 是否正确
- 确认服务器已启用 SNMP
- 检查网络连通性（ping）
- 确认防火墙允许 UDP 161 端口

**2. 传感器数据为 0**
- 某些传感器在设备未安装时返回 0（正常）
- 检查设备硬件配置（如 CPU、内存是否安装）

**3. 获取数据缓慢**
- SNMP Walk 操作需要时间（正常）
- 考虑增加超时时间
- 使用缓存机制减少查询次数

## 后续开发计划

### 第一阶段（数据持久化）
- [ ] 创建数据库表结构
- [ ] 实现设备注册功能
- [ ] 实现传感器数据存储
- [ ] 实现历史数据查询

### 第二阶段（批量监控）
- [ ] 批量设备探测脚本
- [ ] 定时数据采集任务
- [ ] 数据聚合和统计
- [ ] 性能优化

### 第三阶段（告警系统）
- [ ] 阈值配置
- [ ] 告警规则引擎
- [ ] 告警通知（邮件、webhook）
- [ ] 告警历史记录

### 第四阶段（可视化增强）
- [ ] 实时图表（温度/功耗趋势）
- [ ] 健康评分算法
- [ ] 设备对比分析
- [ ] 自定义仪表板

## 参考文档

1. **Lenovo BMC SNMP MIB 指南**
   - 路径: `docs/lenovo_bmc_snmp_guide.pdf`
   - 语言: 中文
   - 页数: 38 页

2. **Net-SNMP 文档**
   - GitHub: https://github.com/markabrahams/node-net-snmp
   - 协议: SNMP v1/v2c/v3

3. **相关标准**
   - RFC 1157 - SNMPv1
   - RFC 1905 - SNMPv2c
   - RFC 3416 - SNMPv2 Protocol Operations

## 开发日志

- **2025-11-05**: 完成后端 SNMP 服务层开发
- **2025-11-05**: 完成联想 MIB 集成（56 个 OID）
- **2025-11-05**: 完成传感器过滤算法优化
- **2025-11-05**: 完成前端监控页面开发
- **2025-11-05**: 完成路由集成
- **2025-11-05**: 测试验证通过（203.0.113.8）

## 总结

SNMP 监控功能已基本完成前后端框架，支持对联想服务器进行温度、风扇、电源等关键指标的实时监控。后续需要补充数据库持久化、批量监控、告警系统等功能，逐步构建完整的数据中心监控解决方案。
