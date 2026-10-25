# DCAgent 快速开始

## 前置要求

- Node.js 20 以上（本机用的是 Homebrew Node）
- Docker（只跑 PostgreSQL）
- Chrome（E2E 用 `channel: 'chrome'`）

npm 报证书错误（`UNABLE_TO_GET_ISSUER_CERT` 等）时，先执行 `brew postinstall openssl@4` 再重试。

## 1. 数据库

项目根目录建 `.env`，写入 `POSTGRES_PASSWORD=...`，然后：

```bash
docker compose up -d postgres
```

镜像固定为 `postgres:16-alpine`。不要换成 Debian 版 `postgres:16` 再挂同一个数据卷：glibc 和 musl 对 `en_US.utf8` 的排序不同，旧卷里文本列上的 btree 索引会和新排序对不上（唯一约束和查询可能悄悄失效）。真要换镜像，先 `pg_dump`，换镜像后用新卷 `pg_restore`。名称类列（机房、机柜、设备、面板、端口号、工作站、子网、型号、模板）用的是 ICU 的 `natural` 排序规则（迁移里建的），不依赖 C 库，`S110-9 < S110-10 < S110-100`。

同一个容器里有几个库：

| 库 | 用途 | 谁会写 |
|---|---|---|
| `dcagent` | 真实数据 | 后端 3000；`npm run db:deploy`；`npm run migrate:legacy -- --target=prod --apply` |
| `dcagent_test` | 测试、E2E、迁移演练 | `npm test`、`npm run db:test:reset`、Playwright |
| `dcagent_legacy` | 重构前数据快照（迁移的只读来源） | 只有 `npm run db:legacy:restore` |
| `dcagent_shadow` | Prisma 生成迁移时的影子库 | Prisma |

## 2. 后端

```bash
cd backend
npm install
cp .env.example .env         # 真实库，填密码
cp .env.example .env.test    # 测试库：DATABASE_URL 改成 .../dcagent_test，PORT=3100，CORS_ORIGIN=http://localhost:5174
npm run db:deploy            # 建表（prisma migrate deploy）
npm run dev                  # http://localhost:3000，nodemon 监视 src/
```

`.env` 里每个键都必须有值，缺了服务拒绝启动。

## 3. 前端

```bash
cd frontend
npm install
cp .env.example .env         # API_PROXY_TARGET=http://127.0.0.1:3000
npm run dev                  # http://localhost:5173
```

浏览器只请求同源的 `/api/v1`，由 Vite 代理到后端。

## 4. 测试

后端：

```bash
cd backend
npm run typecheck            # tsc（src + scripts + test）+ emoji 检查
npm run test:unit            # 纯函数：契约、生成器、迁移转换、Neo4j 导出解析
npm run test:int             # 先重置 dcagent_test，再跑 test/*.int.test.ts
npm test                     # 两者都跑
npm run build
```

集成测试和重置脚本都先检查库名以 `_test` 结尾，指向别的库会直接报错退出。

前端：

```bash
cd frontend
npm run typecheck
npm run lint
npm test                     # 三语 key 一致、无 emoji、错误码文案齐全、3D 布局计算
npm run build
npx playwright test          # E2E
npx playwright test -c playwright.night.config.ts   # 只读巡检真实环境
```

`npx playwright test` 自己启动一套测试环境：后端 3100（先 `db:test:reset`，连 `dcagent_test`）和 Vite 5174，跑前检查这个后端是空库，所以不会碰 3000/5173 和真实数据。结果在 `test-results/e2e/`。

`playwright.night.config.ts` 只跑 `e2e/night-smoke.spec.ts`，对正在运行的 5173/3000 做只读巡检（亮暗主题、命令面板、3D 机房、面板模板预览、三语、旧页面），截图和问题清单在 `test-results/night-screenshots/`。

## 5. 从重构前的数据迁移

重构前的数据在只读备份 `db-backups/dcagent-before-night-modernize-20261025-0057.dump` 里。迁移脚本从 `dcagent_legacy` 读，整表重建目标库，在同一个事务里逐表对账，全部通过才提交。

```bash
cd backend
npm run db:legacy:restore                                  # 备份 -> dcagent_legacy（只通过 stdin 读备份文件）
npm run migrate:legacy -- --target=test                    # 在 dcagent_test 上演练，结束时回滚
npm run migrate:legacy -- --target=test --apply            # 在 dcagent_test 上提交
npm run migrate:legacy -- --target=prod --apply            # 写真实库 dcagent
npm run templates:presets                                  # 导入系统面板模板预设（迁移之后的新数据）
```

- 报告和补打标签清单写到 `backend/migration-reports/`（不进 git）：`<时间>-<target>.json`、`labels-to-print-<时间>-<target>.csv`。
- 对账项：行数、主键、关系、标签绑定、推导状态（端口已连、线缆在用、工作站在线）、逐行 md5，以及 Neo4j 备份里每个节点和连接要么在旧 PG 里、要么是父节点已删的孤儿。任一项不通过就整体回滚并以非零退出。
- 重复执行结果相同（`digest` 一样）。
- 保护：`--target=prod --apply` 时，真实库必须是空的，或者和上一次成功的 prod 迁移写进去的内容完全一样（按表比较 digest）。迁移之后录入的任何数据（包括 `templates:presets` 导入的模板）都会让脚本拒绝执行，并列出变化的表。确实要覆盖时，先 `pg_dump` 备份，再加 `--overwrite-live`。

重建真实库的完整步骤（会清空 `dcagent`，先备份）：

```bash
docker exec dcagent-postgres pg_dump -U dcagent -d dcagent -Fc > db-backups/dcagent-<说明>-$(date +%Y%m%d-%H%M).dump
docker exec dcagent-postgres psql -U dcagent -d dcagent -c 'DROP SCHEMA public CASCADE' -c 'CREATE SCHEMA public'
cd backend && npm run db:deploy && npm run migrate:legacy -- --target=prod --apply && npm run templates:presets
touch src/index.ts           # 让 nodemon 重启后端，丢掉旧连接上缓存的查询计划
```

## 常见问题

**后端报 `cached plan must not change result type`**：数据库结构变了，后端还拿着旧连接。`touch backend/src/index.ts` 让 nodemon 重启。

**端口被占用**：3000/5173 是日常开发用的后端和前端，3100/5174 是 E2E 自己起的测试环境。`lsof -iTCP:3000 -sTCP:LISTEN` 查看占用者。

**迁移脚本提示 `refused: ... tables changed since ...`**：真实库里有迁移之后录入的数据，见上面的保护说明。
