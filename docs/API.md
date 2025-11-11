# DCAgent API 文档

## 目录
- [API 设计规范](#api-设计规范)
- [通用响应格式](#通用响应格式)
- [数据中心管理](#数据中心管理)
- [机房管理](#机房管理)
- [机柜管理](#机柜管理)
- [设备管理](#设备管理)
- [面板管理](#面板管理)
- [端口管理](#端口管理)
- [线缆管理](#线缆管理)
- [光模块管理](#光模块管理)
- [面板模板管理](#面板模板管理)
- [ShortID 池管理](#shortid-池管理)
- [全局搜索](#全局搜索)
- [SNMP 监控](#snmp-监控)

## API 设计规范

### 基础 URL
```
http://localhost:3000/api/v1
```

### 请求规范

**重要：** 所有 API 统一使用 **POST 方法 + body 传参**

```typescript
// 正确的方式
POST /api/v1/cabinets/get
Content-Type: application/json

{
  "id": "cabinet-uuid-here"
}

// 不使用的方式
GET /api/v1/cabinets/:id  // ❌ 不拼接 URL
```

**原因：**
- 参数复杂时更灵活
- 避免 URL 编码问题
- 统一的请求格式
- 便于日志记录和审计

### 数据验证

所有请求使用 **Zod** 进行运行时验证：

```typescript
// UUID 验证
z.string().uuid()

// 枚举验证
z.enum(['CAT5E', 'CAT6', 'FIBER_SM', ...])

// 必填/可选字段
z.object({
  name: z.string(),          // 必填
  description: z.string().optional()  // 可选
})
```

### 错误处理

统一的错误响应格式：

```json
{
  "error": "错误信息",
  "details": {
    // 详细的错误信息（可选）
  }
}
```

常见 HTTP 状态码：
- `200 OK` - 成功
- `400 Bad Request` - 请求参数错误
- `404 Not Found` - 资源不存在
- `500 Internal Server Error` - 服务器错误

## 通用响应格式

### 列表查询

```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```

### 单个资源

```json
{
  "id": "uuid",
  "name": "资源名称",
  ...
}
```

### 级联数据

```json
{
  "id": "device-uuid",
  "name": "Server-01",
  "cabinet": {
    "id": "cabinet-uuid",
    "name": "A01",
    "room": {
      "id": "room-uuid",
      "name": "Room 1"
    }
  }
}
```

## 数据中心管理

**路由前缀：** `/api/v1/datacenters`

### 获取所有数据中心

```http
GET /api/v1/datacenters/
```

**响应：**
```json
[
  {
    "id": "uuid",
    "name": "北京数据中心",
    "location": "北京市朝阳区",
    "createdAt": "2025-01-01T00:00:00Z",
    "updatedAt": "2025-01-01T00:00:00Z",
    "_count": {
      "rooms": 5
    }
  }
]
```

### 获取单个数据中心

```http
POST /api/v1/datacenters/get
Content-Type: application/json

{
  "id": "datacenter-uuid"
}
```

### 根据 shortID 查询

```http
POST /api/v1/datacenters/by-shortid
Content-Type: application/json

{
  "shortId": 123
}
```

### 创建数据中心

```http
POST /api/v1/datacenters/create
Content-Type: application/json

{
  "name": "北京数据中心",
  "location": "北京市朝阳区"
}
```

### 更新数据中心

```http
POST /api/v1/datacenters/update
Content-Type: application/json

{
  "id": "datacenter-uuid",
  "name": "北京数据中心（更新）",
  "location": "北京市海淀区"
}
```

### 删除数据中心

```http
POST /api/v1/datacenters/delete
Content-Type: application/json

{
  "id": "datacenter-uuid"
}
```

**注意：** 级联删除所有关联的机房、机柜、设备等

## 机房管理

**路由前缀：** `/api/v1/rooms`

### 获取所有机房

```http
GET /api/v1/rooms/
```

**可选查询参数：**
- `dataCenterId` - 筛选指定数据中心的机房

### 获取单个机房

```http
POST /api/v1/rooms/get
Content-Type: application/json

{
  "id": "room-uuid"
}
```

**响应包含：**
- 机房基本信息
- 关联的数据中心信息
- 机柜数量统计

### 根据 shortID 查询

```http
POST /api/v1/rooms/by-shortid
Content-Type: application/json

{
  "shortId": 1
}
```

### 创建机房

```http
POST /api/v1/rooms/create
Content-Type: application/json

{
  "name": "Room 1",
  "floor": "2F",
  "dataCenterId": "datacenter-uuid",
  "shortId": 1  // 可选，不提供则自动分配
}
```

### 更新机房

```http
POST /api/v1/rooms/update
Content-Type: application/json

{
  "id": "room-uuid",
  "name": "Room 1（更新）",
  "floor": "3F"
}
```

### 删除机房

```http
POST /api/v1/rooms/delete
Content-Type: application/json

{
  "id": "room-uuid"
}
```

## 机柜管理

**路由前缀：** `/api/v1/cabinets`

### 获取所有机柜

```http
GET /api/v1/cabinets/
```

**可选查询参数：**
- `roomId` - 筛选指定机房的机柜

### 获取单个机柜

```http
POST /api/v1/cabinets/get
Content-Type: application/json

{
  "id": "cabinet-uuid"
}
```

**响应包含：**
- 机柜基本信息（名称、位置、U数）
- shortID
- 关联的机房和数据中心信息
- 设备数量统计

### 根据 shortID 查询

```http
POST /api/v1/cabinets/by-shortid
Content-Type: application/json

{
  "shortId": 100
}
```

### 创建机柜

```http
POST /api/v1/cabinets/create
Content-Type: application/json

{
  "name": "A01",
  "position": "Row A, Position 01",
  "height": 42,
  "roomId": "room-uuid",
  "shortId": 100  // 可选，不提供则自动分配
}
```

### 更新机柜

```http
POST /api/v1/cabinets/update
Content-Type: application/json

{
  "id": "cabinet-uuid",
  "name": "A01（更新）",
  "position": "Row A, Position 01",
  "height": 48
}
```

### 删除机柜

```http
POST /api/v1/cabinets/delete
Content-Type: application/json

{
  "id": "cabinet-uuid"
}
```

## 设备管理

**路由前缀：** `/api/v1/devices`

### 获取所有设备

```http
GET /api/v1/devices/
```

**可选查询参数：**
- `cabinetId` - 筛选指定机柜的设备
- `type` - 筛选设备类型（SERVER, SWITCH, ROUTER, etc.）

### 获取单个设备

```http
POST /api/v1/devices/get
Content-Type: application/json

{
  "id": "device-uuid"
}
```

### 根据 shortID 查询

```http
POST /api/v1/devices/by-shortid
Content-Type: application/json

{
  "shortId": 200
}
```

### 创建设备

```http
POST /api/v1/devices/create
Content-Type: application/json

{
  "name": "Server-01",
  "type": "SERVER",
  "model": "Dell PowerEdge R740",
  "serialNo": "SN123456",
  "uPosition": 10,
  "uHeight": 2,
  "cabinetId": "cabinet-uuid"
}
```

**设备类型枚举：**
- `SERVER` - 服务器
- `SWITCH` - 交换机
- `ROUTER` - 路由器
- `FIREWALL` - 防火墙
- `STORAGE` - 存储
- `PDU` - 电源分配单元
- `OTHER` - 其他

### 批量创建设备

```http
POST /api/v1/devices/bulk-create
Content-Type: application/json

{
  "devices": [
    {
      "name": "Server-01",
      "type": "SERVER",
      "cabinetId": "cabinet-uuid",
      ...
    },
    {
      "name": "Server-02",
      "type": "SERVER",
      "cabinetId": "cabinet-uuid",
      ...
    }
  ]
}
```

### 更新设备

```http
POST /api/v1/devices/update
Content-Type: application/json

{
  "id": "device-uuid",
  "name": "Server-01（更新）",
  "uPosition": 12
}
```

### 删除设备

```http
POST /api/v1/devices/delete
Content-Type: application/json

{
  "id": "device-uuid"
}
```

## 面板管理

**路由前缀：** `/api/v1/panels`

### 获取所有面板

```http
GET /api/v1/panels/
```

**可选查询参数：**
- `deviceId` - 筛选指定设备的面板

### 获取单个面板

```http
POST /api/v1/panels/get
Content-Type: application/json

{
  "id": "panel-uuid"
}
```

**响应包含：**
- 面板基本信息
- shortID
- 端口列表
- 模板信息（如果使用模板）

### 根据 shortID 查询

```http
POST /api/v1/panels/by-shortid
Content-Type: application/json

{
  "shortId": 300
}
```

### 创建面板

```http
POST /api/v1/panels/create
Content-Type: application/json

{
  "name": "Front Panel",
  "type": "NETWORK",
  "deviceId": "device-uuid",
  "shortId": 300,  // 可选
  "templateId": "template-uuid",  // 可选，使用模板
  "position": {"x": 0, "y": 0},
  "size": {"width": 482.6, "height": 44.45}
}
```

**面板类型枚举：**
- `NETWORK` - 网络面板
- `POWER` - 电源面板
- `CONSOLE` - 控制台/串口面板
- `USB` - USB 面板
- `MIXED` - 混合功能面板
- `OTHER` - 其他

### 更新面板

```http
POST /api/v1/panels/update
Content-Type: application/json

{
  "id": "panel-uuid",
  "name": "Front Panel（更新）",
  "backgroundColor": "#f0f0f0"
}
```

### 删除面板

```http
POST /api/v1/panels/delete
Content-Type: application/json

{
  "id": "panel-uuid"
}
```

## 端口管理

**路由前缀：** `/api/v1/ports`

### 获取所有端口

```http
GET /api/v1/ports/
```

**可选查询参数：**
- `panelId` - 筛选指定面板的端口

### 获取单个端口

```http
POST /api/v1/ports/get
Content-Type: application/json

{
  "id": "port-uuid"
}
```

### 创建端口

```http
POST /api/v1/ports/create
Content-Type: application/json

{
  "number": "1",
  "label": "Port 1",
  "panelId": "panel-uuid",
  "portType": "RJ45",
  "position": {"x": 10, "y": 10},
  "size": {"width": 15, "height": 12}
}
```

**端口类型：**
- `RJ45` - 以太网口
- `SFP` - 1G 光模块
- `SFP_PLUS` - 10G 光模块
- `QSFP` - 40G 光模块
- `QSFP28` - 100G 光模块
- `QSFP_DD` - 400G 光模块
- `LC` - LC 光纤接口
- `SC` - SC 光纤接口
- `USB_A` - USB-A 接口
- `USB_C` - USB-C 接口
- `SERIAL` - 串口
- `POWER_C13` - 电源 C13
- `POWER_C19` - 电源 C19

### 批量创建端口

```http
POST /api/v1/ports/create-bulk
Content-Type: application/json

{
  "panelId": "panel-uuid",
  "ports": [
    {
      "number": "1",
      "portType": "RJ45",
      "position": {"x": 10, "y": 10}
    },
    {
      "number": "2",
      "portType": "RJ45",
      "position": {"x": 30, "y": 10}
    }
  ]
}
```

### 更新端口

```http
POST /api/v1/ports/update
Content-Type: application/json

{
  "id": "port-uuid",
  "label": "Port 1（更新）",
  "status": "RESERVED"
}
```

### 更新端口状态

```http
POST /api/v1/ports/update-status
Content-Type: application/json

{
  "id": "port-uuid",
  "status": "OCCUPIED",
  "physicalStatus": "CONNECTED"
}
```

**端口状态：**
- `AVAILABLE` - 可用
- `OCCUPIED` - 占用
- `RESERVED` - 预留
- `FAULTY` - 故障

**物理状态：**
- `EMPTY` - 空槽位
- `MODULE_ONLY` - 已安装模块但未连线
- `CONNECTED` - 已连接线缆

### 删除端口

```http
POST /api/v1/ports/delete
Content-Type: application/json

{
  "id": "port-uuid"
}
```

### 查询可用端口

```http
POST /api/v1/ports/available
Content-Type: application/json

{
  "panelId": "panel-uuid"
}
```

## 线缆管理

**路由前缀：** `/api/v1/cables`

详细说明见 [CABLE_MANAGEMENT.md](CABLE_MANAGEMENT.md)

### 获取所有线缆

```http
GET /api/v1/cables/
```

### 获取单个线缆

```http
POST /api/v1/cables/get
Content-Type: application/json

{
  "id": "cable-uuid"
}
```

### 根据 shortID 查询

```http
POST /api/v1/cables/by-shortid
Content-Type: application/json

{
  "shortId": 10001
}
```

**注意：** 返回该 shortID 对应的线缆端点和完整线缆信息

### 创建线缆（双端连接）

```http
POST /api/v1/cables/create
Content-Type: application/json

{
  "type": "CAT6",
  "label": "Cable-001",
  "length": 3.5,
  "color": "blue",
  "endpoints": [
    {
      "portId": "port-a-uuid",
      "endType": "A",
      "shortId": 10001
    },
    {
      "portId": "port-b-uuid",
      "endType": "B1",
      "shortId": 10002
    }
  ]
}
```

**线缆类型：**
- `CAT5E` - 五类线
- `CAT6` - 六类线
- `CAT6A` - 超六类线
- `CAT7` - 七类线
- `FIBER_SM` - 单模光纤
- `FIBER_MM` - 多模光纤
- `QSFP_TO_SFP` - QSFP 转 SFP 分支线缆
- `QSFP_TO_QSFP` - QSFP 直连
- `SFP_TO_SFP` - SFP 直连
- `POWER` - 电源线
- `OTHER` - 其他

### 手动入库线缆

```http
POST /api/v1/cables/manual-inventory
Content-Type: application/json

{
  "type": "FIBER_SM",
  "label": "Cable-002",
  "length": 5.0,
  "color": "yellow",
  "shortIdA": 10003,
  "shortIdB": 10004
}
```

**说明：** 创建线缆记录但不连接端口，用于预先入库

### 单端连接

```http
POST /api/v1/cables/connect-single-port
Content-Type: application/json

{
  "shortId": 10003,
  "portId": "port-uuid"
}
```

**说明：** 扫描插头 shortID，连接到指定端口

### 查询端口连接

```http
POST /api/v1/cables/port-connection
Content-Type: application/json

{
  "portId": "port-uuid"
}
```

**响应：** 返回端口连接的线缆和对端端口信息

### 查询面板连接

```http
POST /api/v1/cables/panel-connections
Content-Type: application/json

{
  "panelId": "panel-uuid"
}
```

**响应：** 返回面板所有端口的连接情况

### 查询网络拓扑

```http
POST /api/v1/cables/network-topology
Content-Type: application/json

{
  "panelId": "panel-uuid",
  "depth": 3
}
```

**说明：** 查询多跳网络拓扑（用于 ReactFlow 可视化）

### 线缆拓扑图 URL 传参

**前端路由：** `/cable-topology`

**支持的 URL 参数：**

1. **通过面板 ID 跳转**
   ```
   /cable-topology?panelId=<panel-uuid>
   ```
   - 自动加载以该面板为起点的拓扑图
   - 示例：`/cable-topology?panelId=550e8400-e29b-41d4-a716-446655440000`

2. **通过面板 shortID 跳转**
   ```
   /cable-topology?shortId=<panel-shortid>
   ```
   - 自动查询面板并加载拓扑图
   - 支持格式：数字格式（如 `300`）或显示格式（如 `P-00300`）
   - 示例：`/cable-topology?shortId=300` 或 `/cable-topology?shortId=P-00300`

3. **通过线缆端子 shortID 跳转**
   ```
   /cable-topology?shortId=<endpoint-shortid>
   ```
   - 自动查询线缆端子，定位到所连接的面板，并高亮该线缆
   - 支持格式：数字格式（如 `10001`）或显示格式（如 `E-10001`）
   - 示例：`/cable-topology?shortId=10001` 或 `/cable-topology?shortId=E-10001`

4. **通过面板 ID + 线缆 ID 跳转并高亮**
   ```
   /cable-topology?panelId=<panel-uuid>&cableId=<cable-uuid>
   ```
   - 加载拓扑图并高亮指定线缆
   - 示例：`/cable-topology?panelId=550e8400-e29b-41d4-a716-446655440000&cableId=660e8400-e29b-41d4-a716-446655440001`

**使用场景：**

- 从搜索结果页面跳转到拓扑图
- 从机柜详情页面查看特定面板的连接
- 扫描线缆端子标签后直接定位到拓扑图
- 从其他页面链接到特定的网络拓扑视图

**注意事项：**

- URL 参数优先级高于路由状态（`location.state`）
- 如果线缆端子未连接到任何端口，会提示无法定位
- shortID 会自动识别是面板还是线缆端子
- 所有 URL 参数都会被自动处理，无需手动解析

### 获取线缆端点信息

```http
POST /api/v1/cables/endpoints
Content-Type: application/json

{
  "cableId": "cable-uuid"
}
```

### 根据 shortID 获取端点

```http
POST /api/v1/cables/endpoints-by-shortid
Content-Type: application/json

{
  "shortId": 10001
}
```

### 检查 shortID 可用性

```http
POST /api/v1/cables/check-shortid
Content-Type: application/json

{
  "shortId": 10001
}
```

**响应：**
```json
{
  "available": false,
  "bound": true,
  "entityType": "CABLE_ENDPOINT",
  "entityId": "endpoint-uuid"
}
```

### 批量检查 shortID

```http
POST /api/v1/cables/check-multiple-shortids
Content-Type: application/json

{
  "shortIds": [10001, 10002, 10003]
}
```

### 更新线缆信息

```http
POST /api/v1/cables/update
Content-Type: application/json

{
  "id": "cable-uuid",
  "label": "Cable-001（更新）",
  "color": "red"
}
```

### 删除线缆

```http
POST /api/v1/cables/delete
Content-Type: application/json

{
  "id": "cable-uuid"
}
```

**注意：** 同时删除 Neo4j 中的拓扑关系

## 光模块管理

**路由前缀：** `/api/v1/optical-modules`

详细说明见 [OPTICAL_MODULE.md](OPTICAL_MODULE.md)

### 创建光模块

```http
POST /api/v1/optical-modules/
Content-Type: application/json

{
  "serialNo": "SN-OM-001",
  "model": "QSFP28-100G-SR4",
  "vendor": "Cisco",
  "moduleType": "QSFP28",
  "wavelength": "850nm",
  "distance": "100m",
  "ddmSupport": true,
  "supplier": "供应商名称",
  "purchaseDate": "2025-01-01",
  "price": 1500.00
}
```

### 获取所有光模块

```http
GET /api/v1/optical-modules/
```

**可选查询参数：**
- `status` - 筛选状态（IN_STOCK, INSTALLED, FAULTY, etc.）
- `moduleType` - 筛选类型（SFP, QSFP28, etc.）

### 获取单个光模块

```http
POST /api/v1/optical-modules/get
Content-Type: application/json

{
  "id": "module-uuid"
}
```

### 根据序列号查询

```http
POST /api/v1/optical-modules/by-serial
Content-Type: application/json

{
  "serialNo": "SN-OM-001"
}
```

### 更新光模块信息

```http
POST /api/v1/optical-modules/:id/update
Content-Type: application/json

{
  "notes": "更新备注信息"
}
```

### 安装光模块

```http
POST /api/v1/optical-modules/:id/install
Content-Type: application/json

{
  "portId": "port-uuid",
  "operator": "张三"
}
```

### 卸载光模块

```http
POST /api/v1/optical-modules/:id/uninstall
Content-Type: application/json

{
  "operator": "张三",
  "notes": "维护卸下"
}
```

### 转移光模块

```http
POST /api/v1/optical-modules/:id/transfer
Content-Type: application/json

{
  "toPortId": "new-port-uuid",
  "operator": "张三"
}
```

### 报废光模块

```http
POST /api/v1/optical-modules/:id/scrap
Content-Type: application/json

{
  "operator": "张三",
  "notes": "物理损坏"
}
```

### 查询光模块历史

```http
POST /api/v1/optical-modules/:id/history
Content-Type: application/json

{
  "id": "module-uuid"
}
```

**响应：** 返回所有移动记录（PURCHASE, INSTALL, TRANSFER, etc.）

### 删除光模块

```http
DELETE /api/v1/optical-modules/:id
```

### 统计信息

```http
GET /api/v1/optical-modules/statistics
```

**响应：**
```json
{
  "byStatus": {
    "IN_STOCK": 50,
    "INSTALLED": 200,
    "FAULTY": 5,
    "SCRAPPED": 10
  },
  "byType": {
    "SFP": 30,
    "SFP_PLUS": 50,
    "QSFP28": 100
  },
  "total": 265
}
```

## 面板模板管理

**路由前缀：** `/api/v1/panel-templates`

### 获取所有模板

```http
GET /api/v1/panel-templates/
```

### 获取单个模板

```http
GET /api/v1/panel-templates/:id
```

### 创建模板

```http
POST /api/v1/panel-templates/
Content-Type: application/json

{
  "name": "24口交换机面板",
  "type": "NETWORK",
  "portCount": 24,
  "description": "标准 24 口千兆交换机面板",
  "layoutConfig": {
    "portsPerRow": 12,
    "rowSpacing": 10,
    "portSize": {"width": 15, "height": 12},
    "spacing": 5
  },
  "portDefinitions": [...]
}
```

### 更新模板

```http
PUT /api/v1/panel-templates/:id
Content-Type: application/json

{
  "name": "24口交换机面板（更新）",
  "description": "更新描述"
}
```

### 删除模板

```http
DELETE /api/v1/panel-templates/:id
```

### 从模板创建面板

```http
POST /api/v1/panel-templates/:id/create-panel
Content-Type: application/json

{
  "deviceId": "device-uuid",
  "name": "Front Panel"
}
```

**说明：** 自动创建面板和所有端口

### 解绑面板模板

```http
POST /api/v1/panel-templates/unbind/:panelId
```

**说明：** 将面板标记为自定义（isCustomized = true）

### 初始化系统模板

```http
POST /api/v1/panel-templates/init-system-templates
```

**说明：** 创建预设的系统模板（24口、48口交换机等）

## ShortID 池管理

**路由前缀：** `/api/v1/shortid-pool`

详细说明见 [SHORTID.md](SHORTID.md)

### 批量生成 shortID

```http
POST /api/v1/shortid-pool/generate
Content-Type: application/json

{
  "count": 100,
  "batchNo": "2025-Q1-001"
}
```

### 创建打印任务

```http
POST /api/v1/shortid-pool/print-task/create
Content-Type: application/json

{
  "name": "2025年第一批标签",
  "shortIds": [1, 2, 3, 4, 5],
  "createdBy": "张三"
}
```

### 导出打印任务

```http
GET /api/v1/shortid-pool/print-task/:id/export
```

**响应：** CSV 文件下载

### 完成打印任务

```http
POST /api/v1/shortid-pool/print-task/:id/complete
```

### 检查 shortID 状态

```http
POST /api/v1/shortid-pool/check
Content-Type: application/json

{
  "shortId": 100
}
```

### 绑定 shortID

```http
POST /api/v1/shortid-pool/bind
Content-Type: application/json

{
  "shortId": 100,
  "entityType": "CABINET",
  "entityId": "cabinet-uuid"
}
```

### 报废 shortID

```http
POST /api/v1/shortid-pool/cancel
Content-Type: application/json

{
  "shortId": 100,
  "notes": "标签损坏"
}
```

### 统计信息

```http
GET /api/v1/shortid-pool/stats
```

**响应：**
```json
{
  "GENERATED": 100,
  "PRINTED": 50,
  "BOUND": 200,
  "CANCELLED": 10,
  "total": 360
}
```

### 查询记录

```http
POST /api/v1/shortid-pool/records
Content-Type: application/json

{
  "status": "BOUND",
  "entityType": "CABINET"
}
```

### 查询打印任务

```http
POST /api/v1/shortid-pool/print-tasks
Content-Type: application/json

{
  "status": "COMPLETED"
}
```

## 全局搜索

**路由前缀：** `/api/v1/search`

### 全局搜索

```http
POST /api/v1/search/global
Content-Type: application/json

{
  "query": "Server-01"
}
```

**响应：** 返回匹配的所有实体（数据中心、机房、机柜、设备等）

### 根据 shortID 搜索

```http
POST /api/v1/search/by-shortid
Content-Type: application/json

{
  "shortId": 100
}
```

**响应：**
```json
{
  "entityType": "CABINET",
  "entityId": "cabinet-uuid",
  "entity": {
    "id": "cabinet-uuid",
    "name": "A01",
    "shortId": 100,
    ...
  }
}
```

## SNMP 监控

**路由前缀：** `/api/v1/monitoring`

**注意：** 该模块已隐藏，但代码保留

### 获取监控设备列表

```http
GET /api/v1/monitoring/devices
```

### 添加监控设备

```http
POST /api/v1/monitoring/devices
Content-Type: application/json

{
  "name": "Switch-01",
  "host": "192.168.1.100",
  "community": "public",
  "version": "2c"
}
```

### 删除监控设备

```http
DELETE /api/v1/monitoring/devices/:deviceId
```

### 测试连接

```http
POST /api/v1/monitoring/test-connection
Content-Type: application/json

{
  "host": "192.168.1.100",
  "community": "public"
}
```

### 查询温度

```http
GET /api/v1/monitoring/devices/:deviceId/temperature
```

### 查询风扇状态

```http
GET /api/v1/monitoring/devices/:deviceId/fans
```

### 查询电源状态

```http
GET /api/v1/monitoring/devices/:deviceId/power
```

### 查询健康状态

```http
GET /api/v1/monitoring/devices/:deviceId/health
```

### 查询所有传感器

```http
GET /api/v1/monitoring/devices/:deviceId/sensors
```

## 向后兼容

### 线缆 ShortID 池（已废弃）

**路由前缀：** `/api/v1/cable-shortid-pool`

**注意：** 该路由保留用于向后兼容，新功能请使用 `/api/v1/shortid-pool`

## 相关文档

- [数据库设计](DATABASE.md)
- [ShortID 系统详解](SHORTID.md)
- [线缆管理系统](CABLE_MANAGEMENT.md)
- [光模块管理系统](OPTICAL_MODULE.md)
- [前端架构](FRONTEND.md)
