# 路由器数据库探索报告

生成时间: 2025-11-11

## 执行摘要

本报告详细记录了对数据库中路由器(Router)数据的探索结果，包括数据模型、现有数据、操作方法和最佳实践。

## 1. 数据库现状

### 1.1 路由器设备统计
- **路由器数量**: 0 台
- **交换机数量**: 3 台
- **其他设备**: 无

### 1.2 现有设备列表

| 设备名称 | 类型 | 型号 | 位置 | 面板数 | 端口数 | 已连接端口 |
|---------|------|------|------|--------|--------|-----------|
| 1号交换机 | SWITCH | 华为智选 S100-16T2S | 华南师范大学-南海 > 工科楼447测试架 > A | 5 | 36 | 1 |
| 1号交换机_复制 | SWITCH | 华为智选 S100-16T2S | 华南师范大学-南海 > 工科楼447测试架 > A | 1 | 18 | 1 |
| 1号交换机_复制_复制 | SWITCH | 华为智选 S100-16T2S | 华南师范大学-南海 > 工科楼447测试架 > A | 1 | 18 | 1 |

### 1.3 现有基础设施
- **数据中心**: 华南师范大学-南海
- **机房**: 工科楼447测试架
- **机柜**: A (ID: 6cd6e3f1-e18f-421a-aeb3-d49c95ca148e)

## 2. 数据模型详解

### 2.1 核心实体关系

```
DataCenter (数据中心)
  └─ Room (机房)
      └─ Cabinet (机柜)
          └─ Device (设备) [type: ROUTER]
              └─ Panel (面板)
                  └─ Port (端口)
                      └─ CableEndpoint (线缆端点)
                          └─ Cable (线缆)
```

### 2.2 Device (设备表) - 路由器主表

```typescript
model Device {
  id          String     @id @default(uuid())
  name        String     // 设备名称，如 "核心路由器-1"
  type        DeviceType // ROUTER (路由器类型)
  model       String?    // 型号，如 "Cisco ISR 4451"
  serialNo    String?    // 序列号，如 "FCW2150ABCD"
  uPosition   Int?       // U位位置 (1-42)
  uHeight     Int?       // 占用U数 (通常1-4U)
  cabinetId   String     // 所属机柜ID
  cabinet     Cabinet    // 关联机柜
  panels      Panel[]    // 关联面板列表
  createdAt   DateTime
  updatedAt   DateTime
}
```

**设备类型枚举**:
- `SERVER` - 服务器
- `SWITCH` - 交换机
- `ROUTER` - 路由器 ⭐
- `FIREWALL` - 防火墙
- `STORAGE` - 存储
- `PDU` - 配电单元
- `OTHER` - 其他

### 2.3 Panel (面板表)

```typescript
model Panel {
  id              String         @id @default(uuid())
  name            String         // 面板名称，如 "GE0/0/0-23"
  type            PanelType      // NETWORK (网络面板)
  shortId         Int?           // 短ID，用于快速扫码识别
  deviceId        String         // 所属设备ID
  device          Device         // 关联设备
  ports           Port[]         // 端口列表
  templateId      String?        // 模板ID（可选）
  template        PanelTemplate? // 面板模板
  isCustomized    Boolean        // 是否自定义
  // 物理布局和样式信息
  position        Json?          // 位置 {x, y}
  size            Json?          // 尺寸 {width, height}
  backgroundColor String?
  image           String?
  svgPath         String?
  createdAt       DateTime
  updatedAt       DateTime
}
```

**面板类型枚举**:
- `NETWORK` - 网络面板 (最常用于路由器) ⭐
- `POWER` - 电源面板
- `CONSOLE` - 控制台/串口面板
- `USB` - USB面板
- `MIXED` - 混合功能面板
- `OTHER` - 其他

### 2.4 Port (端口表)

```typescript
model Port {
  id             String          @id @default(uuid())
  number         String          // 端口编号，如 "0/0/1"
  label          String?         // 端口标签，如 "GE0/0/1"
  status         PortStatus      // 端口状态
  physicalStatus PhysicalStatus  // 物理状态
  panelId        String          // 所属面板ID
  panel          Panel           // 关联面板
  portType       String?         // RJ45, SFP, SFP+, QSFP, QSFP28 等
  rotation       Float?          // 旋转角度 (0, 90, 180, 270)
  position       Json?           // 位置 {x, y}
  size           Json?           // 尺寸 {width, height}
  cableEndpoints CableEndpoint[] // 连接的线缆端点
  opticalModule  OpticalModule?  // 关联光模块
  createdAt      DateTime
  updatedAt      DateTime
}
```

**端口状态**:
- `AVAILABLE` - 可用 ⭐
- `OCCUPIED` - 占用
- `RESERVED` - 预留
- `FAULTY` - 故障

**物理状态**:
- `EMPTY` - 空槽位（未安装模块）
- `MODULE_ONLY` - 已安装模块但未连接线缆
- `CONNECTED` - 已连接线缆 ⭐

**常用端口类型**:
- `RJ45` - 标准以太网口
- `SFP` - 小型可插拔光模块
- `SFP+` - 增强型SFP (10G)
- `QSFP` - 四通道SFP (40G)
- `QSFP28` - 28G QSFP (100G)
- `QSFP-DD` - 双密度QSFP (400G)

### 2.5 Cable (线缆表)

```typescript
model Cable {
  id               String                @id @default(uuid())
  label            String?               // 线缆标签，如 "CAB-001"
  type             CableType             // 线缆类型
  length           Float?                // 长度（米）
  color            String?               // 颜色（用于管理）
  notes            String?               // 备注
  isBranched       Boolean               // 是否为分支线缆（1对多）
  inventoryStatus  CableInventoryStatus  // 入库状态
  endpoints        CableEndpoint[]       // 线缆端点（通常2个）
  createdAt        DateTime
  updatedAt        DateTime
}
```

**线缆类型**（路由器常用）:
- `CAT5E` - 超五类双绞线
- `CAT6` - 六类双绞线 ⭐
- `CAT6A` - 超六类双绞线
- `CAT7` - 七类双绞线
- `FIBER_SM` - 单模光纤 ⭐
- `FIBER_MM` - 多模光纤 ⭐
- `QSFP_TO_SFP` - QSFP转SFP分支线缆
- `QSFP_TO_QSFP` - QSFP直连
- `SFP_TO_SFP` - SFP直连
- `OTHER` - 其他

### 2.6 CableEndpoint (线缆端点表)

```typescript
model CableEndpoint {
  id        String   @id @default(uuid())
  shortId   Int?     // 端点标签的shortID（用于扫码）
  cableId   String   // 所属线缆ID
  cable     Cable    // 关联线缆
  portId    String?  // 连接的端口ID（可选）
  port      Port?    // 关联端口
  endType   String   // "A" 或 "B" (或 "B1", "B2" 用于分支线缆)
  createdAt DateTime
}
```

## 3. API 接口文档

### 3.1 设备管理 API

#### 创建路由器
```http
POST http://localhost:3000/api/v1/devices/create
Content-Type: application/json

{
  "name": "核心路由器-1",
  "type": "ROUTER",
  "model": "Cisco ISR 4451",
  "serialNo": "FCW2150ABCD",
  "cabinetId": "6cd6e3f1-e18f-421a-aeb3-d49c95ca148e",
  "uPosition": 1,
  "uHeight": 2
}
```

#### 查询所有设备
```http
GET http://localhost:3000/api/v1/devices
```

#### 查询特定设备
```http
POST http://localhost:3000/api/v1/devices/get
Content-Type: application/json

{
  "id": "<设备UUID>"
}
```

#### 搜索设备
```http
GET http://localhost:3000/api/v1/devices?search=路由器
```

#### 更新设备
```http
POST http://localhost:3000/api/v1/devices/update
Content-Type: application/json

{
  "id": "<设备UUID>",
  "name": "更新后的名称",
  "model": "新型号"
}
```

#### 删除设备
```http
POST http://localhost:3000/api/v1/devices/delete
Content-Type: application/json

{
  "id": "<设备UUID>"
}
```

### 3.2 面板管理 API

#### 创建面板
```http
POST http://localhost:3000/api/v1/panels/create
Content-Type: application/json

{
  "name": "GE0/0/0-23",
  "type": "NETWORK",
  "deviceId": "<路由器UUID>",
  "templateId": "<模板UUID，可选>"
}
```

### 3.3 端口管理 API

#### 创建端口
```http
POST http://localhost:3000/api/v1/ports/create
Content-Type: application/json

{
  "number": "0/0/1",
  "label": "GE0/0/1",
  "panelId": "<面板UUID>",
  "portType": "RJ45",
  "status": "AVAILABLE"
}
```

### 3.4 线缆管理 API

#### 创建线缆
```http
POST http://localhost:3000/api/v1/cables/create
Content-Type: application/json

{
  "label": "CAB-R1-R2-001",
  "type": "FIBER_SM",
  "length": 10.0,
  "color": "yellow",
  "isBranched": false
}
```

#### 创建线缆端点（连接端口）
```http
POST http://localhost:3000/api/v1/cable-endpoints/create
Content-Type: application/json

{
  "cableId": "<线缆UUID>",
  "portId": "<端口UUID>",
  "endType": "A"
}
```

## 4. 常用查询示例

### 4.1 使用 Prisma 查询所有路由器

```typescript
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const routers = await prisma.device.findMany({
  where: {
    type: 'ROUTER',
  },
  include: {
    cabinet: {
      include: {
        room: {
          include: {
            dataCenter: true,
          },
        },
      },
    },
    panels: {
      include: {
        ports: {
          include: {
            cableEndpoints: {
              include: {
                cable: true,
              },
            },
            opticalModule: true,
          },
        },
      },
    },
  },
});
```

### 4.2 查询路由器的完整连接拓扑

```typescript
const routerTopology = await prisma.device.findMany({
  where: { type: 'ROUTER' },
  include: {
    panels: {
      include: {
        ports: {
          include: {
            cableEndpoints: {
              include: {
                cable: {
                  include: {
                    endpoints: {
                      include: {
                        port: {
                          include: {
                            panel: {
                              include: {
                                device: true,
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});
```

### 4.3 查询路由器之间的直接连接

```typescript
const routerConnections = await prisma.cableEndpoint.findMany({
  where: {
    port: {
      panel: {
        device: {
          type: 'ROUTER',
        },
      },
    },
  },
  include: {
    cable: {
      include: {
        endpoints: {
          where: {
            port: {
              panel: {
                device: {
                  type: 'ROUTER',
                },
              },
            },
          },
          include: {
            port: {
              include: {
                panel: {
                  include: {
                    device: true,
                  },
                },
              },
            },
          },
        },
      },
    },
  },
});
```

### 4.4 查询特定路由器的端口使用情况

```typescript
const routerId = '<路由器UUID>';
const portUsage = await prisma.port.findMany({
  where: {
    panel: {
      deviceId: routerId,
    },
  },
  include: {
    panel: true,
    cableEndpoints: {
      include: {
        cable: true,
      },
    },
    opticalModule: true,
  },
});

// 统计
const totalPorts = portUsage.length;
const connectedPorts = portUsage.filter(p => p.cableEndpoints.length > 0).length;
const availablePorts = portUsage.filter(p => p.status === 'AVAILABLE').length;
const utilization = (connectedPorts / totalPorts) * 100;
```

## 5. 操作流程

### 5.1 创建路由器的完整流程

**步骤1: 创建路由器设备**
```typescript
const router = await prisma.device.create({
  data: {
    name: '核心路由器-1',
    type: 'ROUTER',
    model: 'Cisco ISR 4451',
    serialNo: 'FCW2150ABCD',
    cabinetId: '6cd6e3f1-e18f-421a-aeb3-d49c95ca148e',
    uPosition: 1,
    uHeight: 2,
  },
});
```

**步骤2: 创建面板**
```typescript
const panel = await prisma.panel.create({
  data: {
    name: 'GigabitEthernet 0/0/0-23',
    type: 'NETWORK',
    deviceId: router.id,
  },
});
```

**步骤3: 批量创建端口**
```typescript
const ports = [];
for (let i = 0; i < 24; i++) {
  ports.push({
    number: `0/0/${i}`,
    label: `GE0/0/${i}`,
    panelId: panel.id,
    portType: 'RJ45',
    status: 'AVAILABLE',
    physicalStatus: 'EMPTY',
  });
}

await prisma.port.createMany({
  data: ports,
});
```

### 5.2 连接两台路由器

**步骤1: 确保两台路由器都有可用端口**
```typescript
const router1Port = await prisma.port.findFirst({
  where: {
    panel: { device: { name: '核心路由器-1' } },
    status: 'AVAILABLE',
  },
});

const router2Port = await prisma.port.findFirst({
  where: {
    panel: { device: { name: '核心路由器-2' } },
    status: 'AVAILABLE',
  },
});
```

**步骤2: 创建线缆**
```typescript
const cable = await prisma.cable.create({
  data: {
    label: 'CAB-R1-R2-001',
    type: 'FIBER_SM',
    length: 10.0,
    color: 'yellow',
    isBranched: false,
    inventoryStatus: 'IN_USE',
  },
});
```

**步骤3: 创建线缆端点并连接**
```typescript
// 连接到路由器1
await prisma.cableEndpoint.create({
  data: {
    cableId: cable.id,
    portId: router1Port.id,
    endType: 'A',
  },
});

// 连接到路由器2
await prisma.cableEndpoint.create({
  data: {
    cableId: cable.id,
    portId: router2Port.id,
    endType: 'B',
  },
});
```

**步骤4: 更新端口状态**
```typescript
await prisma.port.updateMany({
  where: {
    id: { in: [router1Port.id, router2Port.id] },
  },
  data: {
    status: 'OCCUPIED',
    physicalStatus: 'CONNECTED',
  },
});
```

## 6. 实用脚本

### 6.1 查询路由器脚本
文件位置: `/Users/uaih3k9x/code/DCAgent/backend/query-routers.ts`

运行命令:
```bash
cd /Users/uaih3k9x/code/DCAgent/backend
npx ts-node query-routers.ts
```

功能:
- 查询所有路由器设备
- 显示路由器的详细信息（名称、型号、位置等）
- 显示面板和端口信息
- 显示连接详情
- 统计端口利用率
- 列出路由器之间的连接关系

### 6.2 查询所有设备脚本
文件位置: `/Users/uaih3k9x/code/DCAgent/backend/query-all-devices.ts`

运行命令:
```bash
cd /Users/uaih3k9x/code/DCAgent/backend
npx ts-node query-all-devices.ts
```

功能:
- 按类型统计所有设备
- 显示设备详细信息
- 显示设备连接拓扑

### 6.3 路由器操作指南脚本
文件位置: `/Users/uaih3k9x/code/DCAgent/backend/router-usage-guide.ts`

运行命令:
```bash
cd /Users/uaih3k9x/code/DCAgent/backend
npx ts-node router-usage-guide.ts
```

功能:
- 显示如何创建路由器的示例代码
- 显示如何查询路由器的方法
- 显示如何添加面板和端口
- 显示如何创建连接
- 显示数据模型详解
- 显示实用查询示例

## 7. 最佳实践

### 7.1 命名规范

**路由器命名**:
- 核心路由器: `核心路由器-1`, `核心路由器-2`
- 汇聚路由器: `汇聚路由器-A`, `汇聚路由器-B`
- 接入路由器: `接入路由器-1F-01`, `接入路由器-2F-01`
- 边界路由器: `边界路由器-ISP1`, `边界路由器-ISP2`

**面板命名**:
- 千兆以太网: `GigabitEthernet 0/0/0-23` 或 `GE0/0/0-23`
- 万兆接口: `TenGigabitEthernet 0/1/0-3` 或 `TE0/1/0-3`
- 光接口: `SFP+ 0/2/0-7`

**端口命名**:
- 使用标准命名: `0/0/1`, `0/0/2` (槽位/子槽位/端口)
- 标签使用完整名称: `GE0/0/1`, `TE0/1/0`

**线缆命名**:
- 格式: `CAB-<源>-<目标>-<编号>`
- 示例: `CAB-R1-R2-001`, `CAB-R1-SW1-001`

### 7.2 端口类型选择

| 速率 | 端口类型 | 常用场景 |
|------|---------|---------|
| 100Mbps | RJ45 | 低速接入 |
| 1Gbps | RJ45, SFP | 标准接入 |
| 10Gbps | SFP+, XFP | 高速接入、上行 |
| 40Gbps | QSFP, QSFP+ | 核心互联 |
| 100Gbps | QSFP28 | 数据中心核心 |
| 400Gbps | QSFP-DD, OSFP | 超高速核心 |

### 7.3 线缆类型选择

| 距离 | 速率 | 推荐线缆 |
|------|------|---------|
| < 100m | 1Gbps | CAT6 双绞线 |
| < 100m | 10Gbps | CAT6A 双绞线 |
| 100m-2km | 1-10Gbps | 多模光纤 (FIBER_MM) |
| 2km-10km | 1-10Gbps | 单模光纤 (FIBER_SM) |
| > 10km | 任意 | 单模光纤 (FIBER_SM) |

### 7.4 数据完整性

1. **始终记录**:
   - 设备序列号（便于保修和追踪）
   - U位位置（便于定位）
   - 线缆长度和颜色（便于管理）

2. **保持更新**:
   - 端口状态要及时更新
   - 线缆连接要准确记录
   - 设备变更要及时反映

3. **使用 shortID**:
   - 为面板分配 shortID（便于扫码）
   - 为线缆端点分配 shortID（便于扫码）
   - 预先打印标签池

## 8. 故障排查

### 8.1 常见问题

**问题1: 找不到路由器**
```sql
-- 检查设备类型
SELECT type, COUNT(*) FROM Device GROUP BY type;

-- 确认设备类型正确
SELECT * FROM Device WHERE name LIKE '%路由器%';
```

**问题2: 端口显示未连接但实际已连接**
```typescript
// 检查端口的线缆端点
const port = await prisma.port.findUnique({
  where: { id: '<端口ID>' },
  include: {
    cableEndpoints: {
      include: {
        cable: true,
      },
    },
  },
});

// 更新端口状态
await prisma.port.update({
  where: { id: '<端口ID>' },
  data: {
    status: 'OCCUPIED',
    physicalStatus: 'CONNECTED',
  },
});
```

**问题3: 线缆连接显示不完整**
```typescript
// 检查线缆的所有端点
const cable = await prisma.cable.findUnique({
  where: { id: '<线缆ID>' },
  include: {
    endpoints: {
      include: {
        port: {
          include: {
            panel: {
              include: {
                device: true,
              },
            },
          },
        },
      },
    },
  },
});
```

## 9. 性能优化建议

### 9.1 查询优化

1. **使用索引**:
   - `Device.type` 已有索引
   - `Port.status` 已有索引
   - `Port.panelId` 有外键索引

2. **分页查询**:
```typescript
const routers = await prisma.device.findMany({
  where: { type: 'ROUTER' },
  skip: (page - 1) * pageSize,
  take: pageSize,
});
```

3. **选择性加载**:
```typescript
// 只加载需要的关联数据
const routers = await prisma.device.findMany({
  where: { type: 'ROUTER' },
  select: {
    id: true,
    name: true,
    model: true,
    panels: {
      select: {
        id: true,
        name: true,
        ports: {
          select: {
            id: true,
            number: true,
            status: true,
          },
        },
      },
    },
  },
});
```

### 9.2 批量操作

使用 `createMany` 而不是多次 `create`:
```typescript
// 好的做法
await prisma.port.createMany({
  data: ports,
});

// 避免
for (const port of ports) {
  await prisma.port.create({ data: port });
}
```

## 10. 下一步行动

### 10.1 如果要添加路由器数据

1. 使用 API 创建路由器设备
2. 为路由器添加网络面板
3. 为面板添加端口
4. 创建线缆连接路由器

### 10.2 推荐的测试数据

```typescript
// 创建2台路由器用于测试
const routers = [
  {
    name: '核心路由器-1',
    type: 'ROUTER',
    model: 'Cisco ISR 4451',
    serialNo: 'FCW2150R1001',
    cabinetId: '6cd6e3f1-e18f-421a-aeb3-d49c95ca148e',
    uPosition: 1,
    uHeight: 2,
  },
  {
    name: '核心路由器-2',
    type: 'ROUTER',
    model: 'Cisco ISR 4451',
    serialNo: 'FCW2150R2001',
    cabinetId: '6cd6e3f1-e18f-421a-aeb3-d49c95ca148e',
    uPosition: 3,
    uHeight: 2,
  },
];
```

## 11. 相关文件

| 文件路径 | 说明 |
|---------|------|
| `/Users/uaih3k9x/code/DCAgent/backend/prisma/schema.prisma` | Prisma 数据库模型定义 |
| `/Users/uaih3k9x/code/DCAgent/backend/src/services/deviceService.ts` | 设备服务逻辑 |
| `/Users/uaih3k9x/code/DCAgent/backend/src/routes/devices.ts` | 设备 API 路由 |
| `/Users/uaih3k9x/code/DCAgent/backend/query-routers.ts` | 路由器查询脚本 |
| `/Users/uaih3k9x/code/DCAgent/backend/query-all-devices.ts` | 所有设备查询脚本 |
| `/Users/uaih3k9x/code/DCAgent/backend/router-usage-guide.ts` | 路由器操作指南 |

---

**报告生成者**: Claude (Database Explorer)
**数据库**: PostgreSQL (通过 Prisma ORM)
**项目**: DCAgent - 数据中心资产管理系统
