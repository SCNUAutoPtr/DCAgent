# OpenAPI 文档和 Swagger UI 集成指南

## 概述

DCAgent 使用 OpenAPI 3.0.3 规范来定义所有 API 端点。本文档说明如何查看和使用 API 文档。

## 文件说明

- `backend/openapi.yaml` - 主 OpenAPI 规范文件（包含 schemas 和部分 paths）
- `docs/api-additions.yaml` - 新增端点定义（待整合到主文件）

## 集成 Swagger UI

### 1. 安装依赖

在 backend 目录下运行：

```bash
cd backend
npm install swagger-ui-express yamljs
npm install --save-dev @types/yamljs
```

### 2. 启用 Swagger UI

在 `backend/src/index.ts` 中，取消以下行的注释：

```typescript
// 第 5-6 行
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';

// 第 22 行
const openApiDocument = YAML.load(path.join(__dirname, '../openapi.yaml'));

// 第 67 行
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
```

### 3. 访问 API 文档

启动后端服务后，访问：

```
http://localhost:3000/api-docs
```

您将看到一个交互式 API 文档界面，可以：
- 浏览所有 API 端点
- 查看请求/响应 schema
- 直接在浏览器中测试 API

## 已实现的端点

### 数据中心管理（DataCenters）
- `GET /api/v1/datacenters` - 获取列表（支持 search 参数）
- `POST /api/v1/datacenters/get` - 获取详情
- `POST /api/v1/datacenters/by-shortid` - 根据 shortId 查询
- `POST /api/v1/datacenters/create` - 创建
- `POST /api/v1/datacenters/update` - 更新
- `POST /api/v1/datacenters/delete` - 删除

### 机房管理（Rooms）
- `GET /api/v1/rooms` - 获取列表（支持 dataCenterId, search 参数）
- `POST /api/v1/rooms/get` - 获取详情
- `POST /api/v1/rooms/by-shortid` - 根据 shortId 查询
- `POST /api/v1/rooms/create` - 创建
- `POST /api/v1/rooms/update` - 更新
- `POST /api/v1/rooms/delete` - 删除

### 机柜管理（Cabinets）
- `GET /api/v1/cabinets` - 获取列表（支持 roomId, search 参数）
- `POST /api/v1/cabinets/get` - 获取详情
- `POST /api/v1/cabinets/by-shortid` - 根据 shortId 查询
- `POST /api/v1/cabinets/create` - 创建
- `POST /api/v1/cabinets/update` - 更新
- `POST /api/v1/cabinets/delete` - 删除

### 设备管理（Devices）
- `GET /api/v1/devices` - 获取列表（支持 cabinetId, search 参数）
- `POST /api/v1/devices/get` - 获取详情
- `POST /api/v1/devices/by-shortid` - 根据 shortId 查询
- `POST /api/v1/devices/create` - 创建
- `POST /api/v1/devices/update` - 更新
- `POST /api/v1/devices/delete` - 删除

### 面板管理（Panels）
- `GET /api/v1/panels` - 获取列表（支持 deviceId, type, search 参数）
- `POST /api/v1/panels/get` - 获取详情
- `POST /api/v1/panels/by-shortid` - 根据 shortId 查询
- `POST /api/v1/panels/create` - 创建
- `POST /api/v1/panels/update` - 更新
- `POST /api/v1/panels/delete` - 删除

### 端口管理（Ports）
- `GET /api/v1/ports` - 获取列表（支持 panelId, status, search 参数）
- `POST /api/v1/ports/get` - 获取详情
- `POST /api/v1/ports/by-shortid` - 根据 shortId 查询
- `POST /api/v1/ports/create` - 创建
- `POST /api/v1/ports/create-bulk` - 批量创建
- `POST /api/v1/ports/update` - 更新
- `POST /api/v1/ports/update-status` - 更新状态
- `POST /api/v1/ports/delete` - 删除
- `POST /api/v1/ports/available` - 获取面板可用端口

### 线缆管理（Cables）
- `GET /api/v1/cables` - 获取列表（支持 search 参数）
- `POST /api/v1/cables/get` - 获取详情
- `POST /api/v1/cables/by-shortid` - 根据 shortId 查询
- `POST /api/v1/cables/create` - 创建
- `POST /api/v1/cables/update` - 更新
- `POST /api/v1/cables/delete` - 删除
- `POST /api/v1/cables/port-connection` - 获取端口连接
- `POST /api/v1/cables/panel-connections` - 获取面板连接
- `POST /api/v1/cables/network-topology` - 获取网络拓扑
- `POST /api/v1/cables/endpoints` - 获取线缆端点信息
- `POST /api/v1/cables/endpoints-by-shortid` - 根据 shortId 获取线缆端点

### 全局搜索（Search）
- `POST /api/v1/search/global` - 全局搜索（在所有实体中搜索）
- `POST /api/v1/search/by-shortid` - 根据 shortId 查找实体

## 使用示例

### 扫码查询示例

当扫码枪扫描到 shortId 为 12345 时：

1. **查找实体类型**
   ```
   POST /api/v1/search/by-shortid
   Body: { "shortId": 12345 }
   ```

2. **如果是线缆，查询端点信息**
   ```
   POST /api/v1/cables/endpoints-by-shortid
   Body: { "shortId": 12345 }
   ```
   返回线缆连接的两个端口及其完整层级信息（端口→面板→设备→机柜→机房→数据中心）

### 全局搜索示例

```
POST /api/v1/search/global
Body: { "query": "switch" }
```

返回所有名称、标签、描述等字段包含 "switch" 的实体。

## 数据模型

### 核心字段

所有实体都包含以下核心字段：
- `id` (string) - UUID 主键
- `shortId` (integer) - 用于二维码的短整数ID
- `createdAt` (datetime) - 创建时间
- `updatedAt` (datetime) - 更新时间

### SearchResult 结构

```typescript
{
  type: 'DataCenter' | 'Room' | 'Cabinet' | 'Device' | 'Cable' | 'Panel' | 'Port'
  id: string
  shortId: number
  name?: string
  label?: string
  description?: string
  metadata?: object
}
```

## 注意事项

1. 所有 POST 端点都需要 Content-Type: application/json
2. shortId 查询支持所有7种实体类型
3. 线缆端点查询返回完整的层级关系，便于前端显示
4. 全局搜索会在所有实体中并发搜索，性能较好

## 待办事项

- [ ] 将 `docs/api-additions.yaml` 中的定义整合到 `backend/openapi.yaml`
- [ ] 为所有端点添加完整的 request/response schema
- [ ] 添加示例数据
- [ ] 添加认证相关的 security schemes（如需要）
