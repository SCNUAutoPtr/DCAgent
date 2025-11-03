# DCAgent 开发待办清单

## 当前状态

### 已完成 (Phase 1)

- [x] 项目基础结构搭建
- [x] 后端框架配置 (Express + TypeScript)
- [x] Prisma 数据模型设计
- [x] Neo4j 图数据库集成
- [x] 设备管理 API (CRUD)
- [x] 线缆跟踪 API
- [x] 图数据库查询服务
- [x] 前端框架配置 (React + Vite + Ant Design)
- [x] 基础页面和布局
- [x] Docker Compose 配置
- [x] 项目文档

### 已完成 (Phase 2 开始 - 2025-11-04)

- [x] 修复前端图标导入问题
  - [x] AppSidebar.tsx - ServerOutlined -> DatabaseOutlined
  - [x] Dashboard.tsx - ServerOutlined -> CloudServerOutlined
- [x] API 版本化 (改为 /api/v1 格式)
- [x] API 设计模式统一
  - [x] 只使用 POST/GET 方法 (不使用 PUT/DELETE)
  - [x] 所有参数通过 body JSON 传递 (包括 ID)
  - [x] 统一路由模式: GET / (列表), POST /get (详情), POST /create, POST /update, POST /delete
- [x] 数据中心管理 (DataCenter)
  - [x] dataCenterService.ts - 服务层
  - [x] datacenters.ts - 路由层
  - [x] dataCenterService.ts (前端) - API 调用层
  - [x] 完整 CRUD + 搜索功能
- [x] 机房管理 (Room)
  - [x] roomService.ts - 服务层
  - [x] rooms.ts - 路由层
  - [x] roomService.ts (前端) - API 调用层
  - [x] 完整 CRUD + 搜索功能
  - [x] 按数据中心过滤
- [x] 机柜管理 (Cabinet)
  - [x] cabinetService.ts - 服务层
  - [x] cabinets.ts - 路由层
  - [x] cabinetService.ts (前端) - API 调用层
  - [x] 完整 CRUD + 搜索功能
  - [x] 按机房过滤
- [x] 设备管理 API 重构
  - [x] devices.ts - 更新为统一的 API 模式
  - [x] deviceService.ts (前端) - 更新 API 调用
- [x] 线缆管理 API 重构
  - [x] cables.ts - 更新为统一的 API 模式
  - [x] cableService.ts (前端) - 更新 API 调用

## 下一步要做的事情

### 优先级 1 - 核心功能继续扩展

#### 1. 面板和端口管理
- [ ] 创建 Panel CRUD API
- [ ] 创建 Port CRUD API
- [ ] 面板类型管理 (ETHERNET, FIBER, POWER 等)
- [ ] 端口状态管理 (AVAILABLE, OCCUPIED, RESERVED, FAULTY)
- [ ] 前端管理界面

#### 2. 数据中心管理前端界面
- [ ] 数据中心列表页面
- [ ] 创建/编辑数据中心表单
- [ ] 机房列表页面
- [ ] 创建/编辑机房表单
- [ ] 机柜列表页面
- [ ] 创建/编辑机柜表单
- [ ] 树形结构导航 (数据中心 -> 机房 -> 机柜 -> 设备)

#### 3. 设备管理完善
- [ ] 完善设备创建表单 (关联到机柜)
- [ ] 完善设备编辑功能
- [ ] 添加设备删除确认
- [ ] 设备搜索和过滤
- [ ] 设备详情页面
- [ ] 显示设备所在位置 (数据中心 -> 机房 -> 机柜)

#### 4. 添加测试数据
- [ ] 使用 Prisma Studio 添加测试数据中心
- [ ] 添加测试机房
- [ ] 添加测试机柜
- [ ] 添加测试设备
- [ ] 测试所有 API 端点

### 优先级 2 - IP和电源管理

#### 5. IP地址管理功能
- [ ] 扩展 Device 模型添加 IP 字段
  ```prisma
  ipAddresses  String[]  // 设备的所有IP
  managementIp String?   // 管理IP
  ```
- [ ] 扩展 Port 模型添加网络字段
  ```prisma
  ipAddress String?
  vlan      String?
  speed     String?  // 1G, 10G, 25G等
  ```
- [ ] 创建 IP 管理 API
- [ ] 创建 IP 管理前端页面
- [ ] 添加 IP 地址与端口映射展示

#### 6. 电源管理功能
- [ ] 扩展 Device 模型添加电源字段
  ```prisma
  powerPhase  String?  // L1, L2, L3
  powerSource PowerSource?  // MAINS, UPS
  ```
- [ ] 创建 PowerSource 枚举
- [ ] 创建电源连接 API
- [ ] 创建电源管理前端页面
- [ ] PDU 端口映射功能

#### 7. 线缆管理完善
- [ ] 线缆列表页面
- [ ] 创建线缆连接表单
- [ ] 编辑线缆信息
- [ ] 删除线缆连接
- [ ] 查看线缆两端端口

### 优先级 3 - 可视化功能

#### 8. 网状拓扑图可视化 (React Flow)
- [ ] 安装 React Flow 依赖
- [ ] 创建拓扑图组件
- [ ] 从 API 获取拓扑数据
- [ ] 将数据转换为 React Flow 格式
- [ ] 实现节点和边的自定义样式
- [ ] 添加交互功能：
  - [ ] 点击节点查看详情
  - [ ] 高亮选中路径
  - [ ] 搜索节点
  - [ ] 缩放和平移
  - [ ] 导出拓扑图

#### 9. U位可视化
- [ ] 创建 2D 机柜视图组件
- [ ] 显示机柜 U 位网格
- [ ] 显示设备在机柜中的位置
- [ ] 设备占用 U 位高亮
- [ ] 拖拽调整设备位置
- [ ] 显示设备信息卡片

#### 10. 仪表板数据统计
- [ ] 实现设备统计 API
- [ ] 实现线缆统计 API
- [ ] 实现端口占用率统计
- [ ] 更新仪表板数据展示
- [ ] 添加图表展示 (ECharts)

### 优先级 4 - 高级功能

#### 11. SNMP 集成
- [ ] 研究 SNMP 库 (net-snmp)
- [ ] 创建 SNMP 服务
- [ ] 设备 SNMP 配置管理
- [ ] 定时采集设备数据
- [ ] 存储监控数据
- [ ] 展示监控数据

#### 12. IPMI 集成
- [ ] 研究 IPMI 库
- [ ] 创建 IPMI 服务
- [ ] 设备 IPMI 配置管理
- [ ] 获取设备健康状态
- [ ] 电源管理功能
- [ ] 远程控制功能

#### 13. 资产盘点功能
- [ ] 二维码生成功能
- [ ] 二维码扫描功能
- [ ] 盘点清单管理
- [ ] 盘点报告生成
- [ ] 差异对比

#### 14. 报表功能
- [ ] 设备清单报表
- [ ] 线缆连接报表
- [ ] IP 地址分配报表
- [ ] 端口使用率报表
- [ ] 导出为 Excel/PDF

### 优先级 5 - 智能化

#### 15. AI 布局优化
- [ ] 收集布局数据
- [ ] 训练优化模型
- [ ] 布局建议 API
- [ ] 前端展示建议
- [ ] 应用优化方案

## 重启后立即执行的任务

1. **启动数据库**
   ```bash
   docker ps  # 检查 Neo4j 和 PostgreSQL 是否运行
   ```

2. **启动后端**
   ```bash
   cd backend
   npm run dev
   ```

3. **启动前端**
   ```bash
   cd frontend
   npm run dev
   ```

4. **验证服务**
   - 前端: http://localhost:5174
   - 后端: http://localhost:3000/health
   - API 文档: http://localhost:3000/api/v1
   - Neo4j: http://localhost:7474

## API 端点清单

### v1 API (当前 - 统一模式)

**API 设计原则:**
- 只使用 GET 和 POST 方法
- 所有参数通过 body JSON 传递 (包括 ID)
- 统一路由模式

**数据中心 (DataCenter)**
- GET /api/v1/datacenters - 列表
- GET /api/v1/datacenters?search=query - 搜索
- POST /api/v1/datacenters/get - 获取详情 (body: {id})
- POST /api/v1/datacenters/create - 创建 (body: {name, location})
- POST /api/v1/datacenters/update - 更新 (body: {id, name?, location?})
- POST /api/v1/datacenters/delete - 删除 (body: {id})

**机房 (Room)**
- GET /api/v1/rooms - 列表
- GET /api/v1/rooms?dataCenterId=xxx - 按数据中心过滤
- GET /api/v1/rooms?search=query - 搜索
- POST /api/v1/rooms/get - 获取详情 (body: {id})
- POST /api/v1/rooms/create - 创建 (body: {name, floor?, dataCenterId})
- POST /api/v1/rooms/update - 更新 (body: {id, name?, floor?})
- POST /api/v1/rooms/delete - 删除 (body: {id})

**机柜 (Cabinet)**
- GET /api/v1/cabinets - 列表
- GET /api/v1/cabinets?roomId=xxx - 按机房过滤
- GET /api/v1/cabinets?search=query - 搜索
- POST /api/v1/cabinets/get - 获取详情 (body: {id})
- POST /api/v1/cabinets/create - 创建 (body: {name, position?, height?, roomId})
- POST /api/v1/cabinets/update - 更新 (body: {id, name?, position?, height?})
- POST /api/v1/cabinets/delete - 删除 (body: {id})

**设备 (Device)**
- GET /api/v1/devices - 列表
- GET /api/v1/devices?cabinetId=xxx - 按机柜过滤
- GET /api/v1/devices?search=query - 搜索
- POST /api/v1/devices/get - 获取详情 (body: {id})
- POST /api/v1/devices/create - 创建 (body: {name, type, model?, serialNo?, uPosition?, uHeight?, cabinetId})
- POST /api/v1/devices/update - 更新 (body: {id, ...})
- POST /api/v1/devices/delete - 删除 (body: {id})

**线缆 (Cable)**
- GET /api/v1/cables - 列表
- POST /api/v1/cables/get - 获取详情 (body: {id})
- POST /api/v1/cables/create - 创建 (body: {label?, type, length?, color?, notes?, portAId, portBId})
- POST /api/v1/cables/update - 更新 (body: {id, ...})
- POST /api/v1/cables/delete - 删除 (body: {id})
- POST /api/v1/cables/port-connection - 获取端口连接 (body: {portId})
- POST /api/v1/cables/panel-connections - 获取面板连接 (body: {panelId})
- POST /api/v1/cables/network-topology - 获取网络拓扑 (body: {panelId, depth?})

## 技术债务

- [ ] 添加错误处理中间件
- [ ] 添加请求日志
- [ ] 添加数据验证
- [ ] 编写单元测试
- [ ] 编写集成测试
- [ ] 添加 API 文档 (Swagger)
- [ ] 性能优化
- [ ] 安全加固

## 已知问题

- 前端图标问题已修复 (ServerOutlined 不存在)
- 后端启动时需要确保端口 3000 未被占用

## 想法和改进

- 考虑添加用户认证和权限管理
- 考虑添加操作审计日志
- 考虑添加数据备份功能
- 考虑添加多租户支持
- 考虑移动端适配

---

**更新日期**: 2025-11-04
**当前 Phase**: Phase 2 进行中 - 基础设施管理 API 完成
**最近更新**:
- 完成所有 API 重构，统一使用 POST/GET 模式，所有参数通过 body JSON 传递
- 完成前后端 API 调用服务文件创建和更新
- 数据中心/机房/机柜/设备/线缆的完整 CRUD API 全部完成并统一模式

