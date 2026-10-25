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

- [x] 目标
  - 让 `backend` 稳定通过 `npm run build`
  - 2026-10-24 达成：`tsc --noEmit` 0 错误（原 152 个，主要是路由 `return res.xxx()` 的隐式返回），行为不变

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

### 16. 学生机（教室终端）纳入 DCAgent（2026-10-20 备忘，等控制平面理清后再做）

背景: 学生机管理平台（https://10.99.31.201，云课堂 VOI/VDI，后端 thor）已能通过 `~/code/lab-power` 读取全部终端并按教室关机。
数据源: `lab-power export` 导出 CSV（教室, 名字, IP, MAC, 状态），10/20 快照在 `CiderLLM/network/学生机清单-20261020.csv`，共 263 台。

| 平台教室 | 台数 | IP 段 | 合并到 Room |
| --- | --- | --- | --- |
| 110教室 | 100 | 10.99.31.1-100 | 110 |
| 工科楼445A学生机 / 教师机 | 54 / 1 | 198.51.100.5-58 / .59 | 445A |
| 工科楼445B学生机 / 教师机 | 56 / 1 | 198.51.100.70-125 / .126 | 445B |
| 工科楼446教室 / 教师机 | 50 / 1 | 198.51.100.160-209 / .150 | 446 |

现有模型已够用，不改 schema:
- `Room.workstations` -> `Workstation`（code 唯一、ipAddress、macAddress、os、status、floorPlanPosition）
- 接口: `/api/v1/workstations/by-code`、`/create`、`/update`、`/update-status`（body 传参）
- `IpSubnet` 登记 198.51.100.0/24（业务 VLAN1，445A/445B/446 共用）和 10.99.31.0/24（110），每台登记 `IpAddress` ALLOCATED + hostname + MAC

- [ ] 确认/新建 Room: 445A、445B、446、110（Room 需要 shortID，`E-xxxxx` 号段由 9x 分配）
- [ ] 导入脚本放 lab-power（`lab-power sync-dcagent`），DCAgent 不改代码
  - 映射: code = name = 机器名（如 `C446-01`）；os = windows10；教师机写进 notes；平台 status 0 -> OFFLINE，其余 -> ONLINE
  - 幂等: 先 `/by-code`，有则 update，无则 create；先演练打印新增/更新清单，9x 确认后再写
- [ ] 登记两个 IpSubnet 和 263 个 IpAddress
- [ ] 后续: 执行器定时把在线状态推到 `/update-status`，看板显示各教室开机数
- [ ] 后续: 用 MAC 对交换机 MAC 表（SNMP），补 Workstation 到交换机端口的归属
- 前置: 9x 先把 k8s 控制平面理清（lab-power 执行器计划做成 hostNetwork Pod 钉在 VLAN1 节点）
- 注意: 后端由 9x 自己启动（3000 / 5173），导入前确认已开

## 近期建议执行顺序

1. 先做运行时验证：
   - 机房/机柜保存失败提示是否展示后端 message
   - Room / Cabinet / Device 层级迁移的 DB-backed 验证
2. 安装 Playwright 并执行第一批 E2E。
3. 继续清理 `backend` TypeScript 构建债（优先 `#15` / `#17`）。
4. 再决定 `Panel` 是否支持跨设备迁移。

## 可观测性（2026-10-24 夜间，Claude）

详见 `docs/observability/README.md`。

- [x] 后端 `/api/v1/observability`：goflow2 流量导入与 Top 流、华为端口体检与快照、工作站开关机/接线同步、座位数字影子
- [x] 数据库：`Workstation.switchName/switchPort/lastSeenAt`，新表 `PortObservation`（迁移已应用；之前的库备份在 `db-backups/dcagent-before-observability-20261024.dump`）
- [x] 前端「可观测性」页面（座位 / 流量 / 端口体检），中英日三语
- [x] 采集器 `scripts/collect-observability.ts`（flows / switches / power），导入脚本 `scripts/import-classroom-workstations.ts`
- [x] 已导入 445A、445B、446、110 共 263 台工作站（445A/445B 带接线位置）
- [x] E2E 清库保护：`E2E_ALLOW_RESET=1` 才允许 `data:seed:reset`
- [x] 交换机互联导入线缆拓扑 `scripts/import-switch-links.ts`（数据来自 CiderLLM `topo.py --json`）：新增 8 条、教室交换机 7 台、端口标签写座位号 111 个
- [ ] 服务器千兆口归属：F13 GE0/0/11–15 五个 AMI BMC、GE0/0/17–24 OpenStack 那批的网卡、A38 GE0/0/6 的 BMC，巡检里只有 MAC，要先对上是哪台服务器才能连线
  - 图灵 7 台里有两台新的 3647 平台机器，凭据还没移交；等移交后登 BMC 读 MAC，再把 7 台建成设备、连到 F13 GE17–24（2026-10-24 挂起）
- [ ] 采集器常驻：flows 模式放到 jumper 或 221 上跑（systemd），switches / power 定时跑
- [ ] 流量窗口目前在内存里，重启即丢；需要长期留存时再接时序库
- [x] 座位按真实排布（445A/445B 已写入坐标，`--layout`）；446、110 的排布参数待补
- [ ] 446、110 的接线位置还没定位（需要那边交换机的 MAC 表）
- [ ] 端口快照关联 DCAgent 设备：库里设备名是"F13 核心交换机"，sysname 是"445C-F13"，目前要手动传 deviceId
- [ ] 老 bug（清类型错误时发现，未改以免改变接口输出）：`routes/monitoring.ts` 的 temperature / fans 接口读 `s.value` / `f.value`，但 SNMP 服务返回的是 `reading` / `speed`，接口里的数值一直是 undefined（Dell 温度的 name 也是）
- [ ] 前端还有 89 个老的类型错误（`npm run build` 会失败），可以用同样的办法清

## 2026-10-25 夜间重构

分支 `night/20261025-modernize`，基线 `ecef2e5`。方案和每条决策的理由见 `docs/REFACTOR_PLAN_20261025.md`。

### 做了什么

- 数据层
  - 去掉 Neo4j，只用 PostgreSQL；迁移历史压成一个 `0001_baseline`（生成的 DDL + 末尾手写的 CHECK、EXCLUDE、触发器）。
  - shortID 只认 `Label` 一张表：一个号最多贴一个实体，机柜、面板、线缆端子提交时必须有标签（延迟约束触发器），实体删除后标签自动解绑但不会被重新分配。
  - 派生状态不再存：端口是否连接、线缆在库/在用、工作站在线都在读取时推导。
  - 层级容器删除改为 RESTRICT，服务层先检查、非空返回 409；所有写用例都在一个事务里。
- 接口：统一 `POST /api/v1/<资源>/<动作>`，参数全部在 body；前后端共用 `backend/src/contracts/` 的 zod schema 和 DTO；错误统一 `{code,message,details}`。旧的 OpenAPI/Apifox 文件和脚本已删除，接口列表见 `docs/API.md`。
- 测试隔离：测试、E2E、迁移演练只用 `dcagent_test`（库名不以 `_test` 结尾就拒绝）；E2E 自己起 3100/5174；`playwright.night.config.ts` 只读巡检真实环境。
- 新功能：面板模板参数化生成器与批量套用（`docs/PANEL_TEMPLATES.md`）、3D 机房（`docs/DATACENTER_3D.md`）、命令面板、仪表板改版。
- 验收复审后的修正（同一晚）：
  - 删除设备不再悄悄带走端口观测历史：`PortObservation.deviceId` 改为 RESTRICT；有面板、观测历史或管理 IP 时返回 `NOT_EMPTY` 并列出内容，确认后 force 才删除历史、解除 IP 绑定（地址记录保留）。删除被外键 RESTRICT 拦下时也返回 `NOT_EMPTY` 而不是 `NOT_FOUND`。
  - 套用模板不再删除状态为预留/故障、有标签或有备注的端口，差异里写明保留原因；光模块移动记录写入时保存端口文字路径，端口删掉后历史仍可读。
  - 设备高度未知（旧库 10 台 `uHeight` 为空）不再写成 1U：`Device.uHeight`、`DeviceModel.uHeight` 可空，界面显示"高度未知"，排位冲突按 1U 计。
  - 型号目录不再包含占位文字：`未确认`、`台式机` 不建型号，原文写进设备备注最后一行（`迁移前型号字段：...`）；`SR650` 型号按厂商规格记 2U。型号从 14 个变为 12 个。
  - 名称列（机房、机柜、设备、面板、端口号、工作站、子网、型号、模板）用 ICU `natural` 排序规则，`S110-9 < S110-10 < S110-100`，分页列表也对。
  - 可观测性：手工认领观测记录时校验端口属于所选设备；座位页默认打开有座位布局的机房，没有布局或没有接线记录时给出说明。
  - 迁移脚本：Neo4j 证据改为直接读只读备份文件，逐个节点和连接核对，孤儿（父节点在旧库已删除）单独列出；`--target=prod --apply` 在真实库有迁移之后录入的数据时拒绝执行（按表比较 digest），需要 `--overwrite-live`。
  - `docker-compose.yml` 保持 `postgres:16-alpine`，与现有数据卷一致（换成 Debian 镜像会让文本索引排序失配）。
  - 界面：IP 子网表列宽和固定操作列、仪表板 3D 卡片按钮箭头（原因是 `.dash-3d svg` 选择器连按钮图标一起绝对定位了）、语言选择框、英日文菜单过长、统计卡副标题截断、3D 悬停指针残留、机柜视图补"未设置 U 位的设备"区。

### 怎么用

- 启动、测试、迁移步骤见 `GETTING_STARTED.md`；后端脚本见 `backend/README.md`。
- 真实库已按新结构重建：`db:deploy` -> `migrate:legacy --target=prod --apply`（报告 `backend/migration-reports/20261024T200937-prod.json`，全部对账项通过，digest `1dab5a33a537c1da8466f0960f2cdf39`，与 dcagent_test 演练一致）-> `templates:presets`（7 个预设）。
- 对账基线（旧 -> 新）：DataCenter 1 -> 1，Room 6 -> 6，Cabinet 11 -> 11，Device 35 -> 35，Panel 41 -> 41，Port 180 -> 180，Cable 42 -> 42，CableEndpoint 84 -> 84，Workstation 263 -> 263，PortObservation 127 -> 127，ShortIdPool 120 -> Label 192（+72 补号），IpSubnet 6 -> 8（+2 个终端 /24），IpAddress 33 -> 296（+263 条由工作站 IP/MAC 迁入），PanelTemplate 0 -> 0（之后导入 7 个预设），DeviceModel 新表 12。
- Neo4j 备份核对：Panel 79 = 41 在旧库 + 38 孤儿，Port 239 = 180 + 59 孤儿，Cable 33 = 32 + 1 孤儿（E2E Dual Cable），没有无法解释的节点或连接。
- 本次操作前后的整库备份：`db-backups/dcagent-before-review-fixes-20261024-1309.dump`（重建前）、`db-backups/dcagent-after-review-fixes-20261024-1309.dump`（重建并导入预设后）。重构前的两份只读备份未动，校验和与 `SHA256SUMS-20261025` 一致。

### 遗留

- [ ] 补打标签：72 个迁移补号（机柜、面板、线缆端子），清单 `backend/migration-reports/labels-to-print-20261024T200937-prod.csv`。
- [ ] 确认 10 台高度未知设备的 U 高：445A-U6/U9/U12、445B-U6/U8/U11、446stack、A柜30T缓存（SR650，应为 2U）、A柜人院服务器1、D柜电子班牌服务器。在设备表单里填上即可。
- [ ] 确认 10 台型号为"未确认"/"台式机"的设备的真实型号（备注最后一行有原文），确认后建型号、关联模板。
- [ ] "447实验室 虚拟机柜"要不要删（D12，数据清理，留给 9x 决定）。
- [ ] 110 和 446 两个教室没有座位坐标和接线记录（旧库就没有），需要那边交换机的 MAC 表和排布参数。
- [ ] `docs/` 下重构前的旧文档（ARCHITECTURE、DATABASE、SHORTID、IMPLEMENTATION_SUMMARY、CABINET_VISUALIZATION、PORT_*、SNMP*、批量上架助手使用说明）描述的是旧接口，需要按新结构重写或删除。
- [ ] 未切换 Express 5，旧页面还没有全部改成 react-query（D14）。
- [ ] 前端主包 1MB、3D 包 880KB，可以再拆分。
