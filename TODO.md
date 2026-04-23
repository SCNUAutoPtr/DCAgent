# DCAgent TODO

更新日期: 2026-04-22

## 已完成概览

- [x] 核心资源管理: DataCenter / Room / Cabinet / Device / Panel / Port 基础 CRUD
- [x] 线缆拓扑可视化和相关前后端接口
- [x] 批量上架助手
- [x] ShortID 池、打印、格式化显示
- [x] Docker Compose、本地开发环境、基础文档

## P0 当前阻塞项

### 1. 修复已确认的后端业务 Bug

- [x] 修复 `Room` 更新接口无法修改 `dataCenterId`
  - 已完成:
    - `backend/src/routes/rooms.ts`
    - `backend/src/services/roomService.ts`
    - `frontend/src/services/roomService.ts`
  - 自动化验证:
    - `backend/src/routes/hierarchy-migration.test.ts`

- [x] 修复 `Cabinet` 更新接口无法修改 `roomId`
  - 已完成:
    - `backend/src/routes/cabinets.ts`
    - `backend/src/services/cabinetService.ts`
    - `frontend/src/services/cabinetService.ts`
  - 自动化验证:
    - `backend/src/routes/hierarchy-migration.test.ts`

- [x] 复核其他层级迁移能力，避免只修一半
  - `Device` 已保留 `cabinetId` 回归测试
  - 自动化验证:
    - `backend/src/routes/hierarchy-migration.test.ts`

- [ ] `Panel` 是否支持跨设备迁移待单独决策
  - 当前编辑器仍默认绑定当前设备
  - 需要先决定是否支持跨设备迁移，再决定是否补 API/UI

### 2. 统一后端错误处理语义

- [x] 为资源 CRUD 路由补统一错误分类
  - `ZodError` -> 400
  - 业务 `Error` -> 400
  - `PrismaClientKnownRequestError` `P2002` -> 409，并返回 `code` / `conflictFields`

- [x] 覆盖以下路由的 `create/update` 错误返回
  - `backend/src/routes/rooms.ts`
  - `backend/src/routes/cabinets.ts`
  - `backend/src/routes/devices.ts`
  - `backend/src/routes/panels.ts`

- [x] 把重复的 `try/catch` 逻辑收敛成可复用 helper
  - `backend/src/utils/crudRouteHandler.ts`
  - 自动化验证:
    - `backend/src/utils/crudRouteHandler.test.ts`
    - `backend/src/app.test.ts`

### 3. 统一前端错误展示

- [ ] 机房和机柜页面不要只显示通用失败提示
  - 代码已完成:
    - `frontend/src/pages/RoomList.tsx`
    - `frontend/src/pages/CabinetList.tsx`
  - 剩余工作:
    - 待前后端运行时 UI 验证 toast 展示的是后端返回 message，而不是通用失败文案

- [x] 设备保存失败时优先展示后端返回的具体错误
  - 场景: `serialNo` 唯一约束冲突
  - 已实现:
    - toast 展示后端错误
    - `serialNo` 字段级错误展示
  - 自动化验证:
    - `backend/src/app.test.ts`

- [x] 明确前端对冲突类错误的展示方式
  - 设备 `serialNo` 冲突: toast + 表单字段级错误
  - 其他保存失败: toast 优先展示后端返回 message

### 4. 引入 Playwright E2E

- [ ] 在 `frontend` 安装 `@playwright/test`
  - 配置和脚本已落地
  - 待本地执行:
    - `cd frontend && npm install --save-dev @playwright/test`
    - `npx playwright install chromium`

- [x] 新增 `frontend/playwright.config.ts`

- [x] 在 `frontend/package.json` 添加 E2E 脚本

- [x] 设计本地执行方式
  - 当前方案: 不自动拉起前后端，依赖本地已有 3000 / 5173 服务
  - 运行方式:
    - `cd frontend && npm run e2e`

- [x] 确定测试数据策略
  - 使用 `backend` 的 `data:seed:reset`
  - 辅助代码:
    - `frontend/e2e/helpers/reset.ts`
    - `frontend/e2e/helpers/setup.ts`

- [x] 第一批 E2E 用例
  - `frontend/e2e/room-hierarchy.spec.ts`
  - `frontend/e2e/cabinet-hierarchy.spec.ts`
  - `frontend/e2e/unique-constraint.spec.ts`
  - 当前状态: spec 已编写，待本地环境实际执行

- [x] 不把 `Room/Cabinet shortId` 冲突作为第一优先 UI E2E
  - 原因: 前端已有 `shortId` 预检查，很多情况下不会真正打到后端冲突分支

## P1 近期工程债

### 5. 修复前端环境变量命名不一致

- [x] 统一使用 `VITE_API_BASE_URL`
  - 已更新:
    - `frontend/.env.example`
    - `frontend/src/vite-env.d.ts`
    - `docker-compose.yml`
    - `frontend/README.md`
    - `frontend/ENV_SETUP.md`

- [x] 补一条说明: 本地开发、Docker、E2E 三种运行方式都要使用同一变量名

### 6. 清理后端 TypeScript 构建错误

- [x] 先做一次错误分组，不要无差别平推
  - 已分组:
    - 路由返回类型问题
    - 路由/服务契约不匹配
    - 测试与工具类型清理
    - 历史脚本 / 监控漂移

- [x] 优先处理明显的接口定义缺口
  - 已处理:
    - `deviceService.getDeviceByShortId`
    - `dataCenterService.getDataCenterByShortId`
    - `cableService.getCableByShortId`

- [ ] 修复资源路由里的返回类型问题
  - 仍有大量 `Not all code paths return a value`
  - 主要跟踪任务:
    - `#15 Fix backend route handler return typing`

- [ ] 处理 DTO 与 Prisma nullable 类型不一致
  - 已处理一部分:
    - `Device`
    - `Subnet`
    - 若干 service/contract mismatch
  - 剩余清理仍在继续

- [ ] 目标
  - 让 `backend` 稳定通过 `npm run build`
  - 当前仍未达成

### 7. 测试可维护性改造

- [x] 给关键页面补稳定选择器
  - 已完成:
    - 机房创建/编辑弹窗
    - 机柜创建/编辑弹窗
    - 设备创建/编辑弹窗
    - 错误区域可通过表单容器选择器稳定定位

- [ ] 给常用测试路径补最小化测试工具
  - 已有:
    - `frontend/e2e/helpers/reset.ts`
    - `frontend/e2e/helpers/setup.ts`
  - 待补:
    - 更通用的数据创建 helper
    - 登录/初始化 helper（如果后续引入认证）

## P2 中期功能项

### 8. 机柜和设备可视化完善

- [ ] 梳理现有 2D/3D 机柜可视化能力，区分“已实现但未打磨”和“完全未做”
- [ ] 完善设备在 U 位中的展示、移动、占用冲突校验
- [ ] 明确机柜详情页、设备详情页、可视化视图之间的导航关系

### 9. 仪表板和统计

- [ ] 实现设备统计 API
- [ ] 实现线缆统计 API
- [ ] 实现端口占用率统计
- [ ] 更新 Dashboard 展示
- [ ] 决定是否引入图表库，避免为了统计页过早增加复杂度

### 10. 网络与电源管理

- [ ] 重新评估 IP 管理功能，先对照当前仓库已有的 `ipAddresses/subnets` 能力，避免重复设计
- [ ] 明确“设备 IP”“端口网络属性”“子网归属”的边界
- [ ] 电源管理先从数据模型和连接关系建模开始，不急着上完整 UI

### 11. 设备/线缆管理补齐

- [ ] 梳理设备详情、搜索、位置展示是否还缺独立页面，还是已有能力只是交互未收口
- [ ] 明确线缆列表、编辑、删除、两端查看的最终入口
- [ ] 评估是否需要单独的线缆管理页，而不是继续分散在多个页面中

## P3 延后项

### 12. 认证与审计

- [ ] 用户认证
- [ ] 权限模型
- [ ] 操作审计日志

### 13. 盘点与报表

- [ ] 二维码生成和扫码盘点
- [ ] 盘点清单和差异报告
- [ ] 设备/线缆/IP/端口报表导出

### 14. 监控集成

- [ ] SNMP 能力梳理和最小可用接入
- [ ] IPMI 能力梳理和最小可用接入
- [ ] 明确监控数据采集、存储、展示边界

### 15. 探索项

- [ ] 多租户
- [ ] 移动端适配
- [ ] AI 布局优化

## 近期建议执行顺序

1. 先做运行时验证：
   - 机房/机柜保存失败提示是否展示后端 message
   - Room / Cabinet / Device 层级迁移的 DB-backed 验证
2. 安装 Playwright 并执行第一批 E2E。
3. 继续清理 `backend` TypeScript 构建债（优先 `#15` / `#17`）。
4. 再决定 `Panel` 是否支持跨设备迁移。
