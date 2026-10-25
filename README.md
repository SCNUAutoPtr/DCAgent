# DCAgent - 数据中心线缆与资产管理

**"見えない線を、見える化へ"**：把看不见的线，变成看得见的数据。

DCAgent 记录数据中心里每一台设备、每一个面板端口、每一根线缆两端插在哪里，并用贴在实物上的 shortID 标签把现场和系统对上。

- 前端：React 18 + Ant Design 5 + Vite + i18next（简体中文 / English / 日本語），3D 机房用 three.js（@react-three/fiber）
- 后端：Express + Prisma + PostgreSQL 16，TypeScript
- 只有一个数据库（PostgreSQL）。早期的 Neo4j 已经去掉：所有连接都是单跳，一次 Prisma include 就能读到

## 快速开始

详细步骤见 [GETTING_STARTED.md](GETTING_STARTED.md)。

```bash
# 1. 数据库（项目根目录的 .env 里写 POSTGRES_PASSWORD=...）
docker compose up -d postgres            # postgres:16-alpine，容器名 dcagent-postgres

# 2. 后端（端口 3000）
cd backend
npm install
cp .env.example .env                     # 填 DATABASE_URL 的密码
npm run db:deploy                        # 建表：prisma migrate deploy（0001_baseline）
npm run dev                              # nodemon，改代码自动重启

# 3. 前端（端口 5173，/api/v1 由 Vite 代理到 3000）
cd frontend
npm install
cp .env.example .env
npm run dev
```

打开 http://localhost:5173 。

## 数据库

| 库 | 用途 |
|---|---|
| `dcagent` | 真实数据（`backend/.env`）。只有 `npm run db:deploy` 和 `npm run migrate:legacy -- --target=prod --apply` 会写结构/整表 |
| `dcagent_test` | 单元/集成测试、E2E 和迁移演练（`backend/.env.test`，库名必须以 `_test` 结尾，重置脚本会检查） |
| `dcagent_legacy` | 重构前（2026-10-25）的数据快照，由 `npm run db:legacy:restore` 从只读备份恢复，迁移脚本只读它 |

`db-backups/dcagent-before-night-modernize-20261025-0057.dump` 和 `db-backups/neo4j-before-night-modernize-20261025-0057.cypher` 是重构前的完整备份，只读，不能覆盖或删除（校验和在 `db-backups/SHA256SUMS-20261025`）。

迁移、对账和重放方法见 [backend/README.md](backend/README.md) 和 [TODO.md](TODO.md) 末尾的"2026-10-25 夜间重构"一节。

## 测试

```bash
cd backend
npm run typecheck          # src + scripts + test，外加 emoji 检查
npm test                   # 单元测试，然后在 dcagent_test 上跑集成测试（会先重置 dcagent_test）

cd frontend
npm run typecheck && npm run lint
npm test                   # 三语 key 一致、无 emoji、错误码全覆盖、3D 布局计算
npm run build
npx playwright test        # E2E：自己起 3100（后端，dcagent_test）和 5174（Vite），不碰 3000/5173
npx playwright test -c playwright.night.config.ts   # 只读巡检真实环境 5173/3000，截图在 test-results/night-screenshots
```

## 功能

- **层级**：数据中心 → 机房 → 机柜 → 设备 → 面板 → 端口。机房平面图编辑器摆放机柜和工作站座位
- **线缆**：两端各一个端子（插在端口上，或暂挂在面板上），连接、拔出、对端查询；库存/在用状态从端子推导，不单独存
- **shortID 标签**（`E-xxxxxx`）：机柜、面板、线缆端子必须有标签，机房可选。标签表 `Label` 是唯一事实源，数据库保证一个号只贴一个实体；补号清单可直接打印
- **面板模板**：参数化生成端口布局，按型号批量套用，见 [docs/PANEL_TEMPLATES.md](docs/PANEL_TEMPLATES.md)
- **3D 机房**：按平面图坐标还原机柜、设备、线缆和工作站，见 [docs/DATACENTER_3D.md](docs/DATACENTER_3D.md)
- **光模块**：入库、安装、转移、拆卸、报废，移动记录保留当时所在位置
- **IP 管理**：子网、地址分配（端口、设备、工作站三选一归属）、冲突检查
- **可观测性**：座位开关机、交换机端口体检与快照、NetStream Top 流，见 [docs/observability/README.md](docs/observability/README.md)
- **全局搜索 / 命令面板**：Ctrl K，可直接输入或扫描 shortID

## 接口约定

所有接口都是 `POST /api/v1/<资源>/<动作>`，参数全部放 JSON body，不用 query string、路径参数、GET/PUT/DELETE。错误统一是 `{ code, message, details }`。请求 schema 和返回 DTO 在 `backend/src/contracts/`，前后端共用。接口列表见 [docs/API.md](docs/API.md)。

## 目录

```
backend/
  prisma/schema.prisma                     数据模型
  prisma/migrations/0001_baseline/         唯一的迁移：生成的 DDL + 末尾手写的约束、触发器、natural 排序规则
  src/contracts/                           zod schema、DTO 类型、无依赖的枚举和纯函数（前端也用）
  src/http/                                rpc 路由（读 / 单事务写）和统一错误处理
  src/services/                            业务用例，每个函数接收事务客户端
  src/routes/                              解析 body，调用 service
  scripts/migrate-from-legacy.ts           从 dcagent_legacy 迁移并对账
  test/                                    集成测试（只连 *_test 库）
frontend/
  src/pages/  src/components/  src/locales/<lang>/<ns>.json
  e2e/                                     Playwright
template-kit/                              面板模板资料包，examples/ 即系统预设
db-backups/                                数据库备份（重构前两份只读）
docs/                                      文档
```

## 文档

| 文档 | 内容 |
|---|---|
| [GETTING_STARTED.md](GETTING_STARTED.md) | 安装、启动、测试库、迁移脚本 |
| [backend/README.md](backend/README.md) | 后端结构、数据库约束、脚本 |
| [docs/API.md](docs/API.md) | 接口约定和资源/动作列表 |
| [docs/PANEL_TEMPLATES.md](docs/PANEL_TEMPLATES.md) | 面板模板与生成器 |
| [docs/DATACENTER_3D.md](docs/DATACENTER_3D.md) | 3D 机房 |
| [docs/observability/README.md](docs/observability/README.md) | 可观测性 |
| [docs/REFACTOR_PLAN_20261025.md](docs/REFACTOR_PLAN_20261025.md) | 2026-10-25 重构方案（schema 和决策的依据） |
| [docs/PUBLIC_SAFETY.md](docs/PUBLIC_SAFETY.md) | 公开仓库脱敏规范（推送前必读） |
| [TODO.md](TODO.md) | 待办和每次大改的记录 |

`docs/` 下其余文档（ARCHITECTURE、DATABASE、SHORTID、IMPLEMENTATION_SUMMARY、CABINET_VISUALIZATION、PORT_* 、SNMP*、批量上架助手使用说明）写于重构前，描述的是旧接口和旧表结构，只作历史参考，以代码和上表文档为准。

## 开发规范

- 不使用 emoji（代码、文案、提交信息）
- 请求参数一律走 body，不拼 URL
- 用图标前确认已经 import
- 新文案三语齐全（`frontend/src/locales/<lang>/<ns>.json`，`npm test` 会检查）
- import 方式与被导入模块的 export 方式一致
- 机柜、面板、线缆端子必须有 shortID
- 仓库是公开的：真实 IP、MAC、本机路径、密码不进 git，按 [docs/PUBLIC_SAFETY.md](docs/PUBLIC_SAFETY.md) 替换；`npm run typecheck` 会检查

## 许可证

MIT
