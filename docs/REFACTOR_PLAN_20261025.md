# DCAgent 地基重构方案（2026-10-25 夜）

分支 `night/20261025-modernize`，基线提交 `ecef2e5`。本文档是今晚重构的唯一依据，汇总了 schema、backend、graph、frontend、tooling 五份审计。

目标：把审计列出的设计缺陷一次修完，不保留兼容层、旧接口和旧表。真实数据通过可重复执行的迁移脚本完整迁回，并逐表对账。

底线：
- `db-backups/dcagent-before-night-modernize-20261025-0057.dump` 和 `db-backups/neo4j-before-night-modernize-20261025-0057.cypher` 只能读，不能覆盖、移动或删除。
- 新库上线后，基线中的每一条记录都要在新库里找到对应行，或者在对账报告里写明去向。

---

## 0. 关键决策

| # | 决策 | 理由 |
|---|---|---|
| D1 | **去掉 Neo4j。** 删除 `backend/src/graph/`、`neo4j-driver`、`NEO4J_*` 环境变量、compose 里的 neo4j 服务，以及 `syncCablesToNeo4j`、`checkNeo4jConnection` 两个脚本。迁移不从 Neo4j 回灌任何数据。 | 实测 PG 是 Neo4j 的严格超集。Neo4j 多出的 38 个 Panel、59 个 Port、1 条 Cable 都是孤儿。模型中只有单跳连接，一次 Prisma include 就能查到。双写没有事务，已经产生漂移。 |
| D2 | **shortID 只认 `Label` 一张表。** 实体表不再保存 shortId。`Label` 上为每种实体各开一个可空的 `@unique` 外键，再加 CHECK `num_nonnulls(...) <= 1`。删除 `ShortIdPool`、`CableShortIdPool`、`globalShortIdService` 和 `EntityType` 枚举。 | 跨表唯一由数据库保证，"抢占已绑定号"这个漏洞在结构上不再可能出现。多态字符串 entityId 也随之消失。 |
| D3 | **标签状态只记录物理生命周期**：`GENERATED / PRINTED / VOID`。"是否绑定"由外键是否非空推导。用 `firstBoundAt` 记录"贴出去过"，绑定过的标签不再参与自动分配。 | 实体删除后外键 SetNull，标签自动解绑，但不会被重新发给别的实体，现场扫码就不会扫错。是否复用由人工决定。 |
| D4 | **机柜、面板、线缆端子必须有标签**，由数据库的延迟约束触发器在提交时检查。机房可以有标签，也可以没有。 | 对应 9x 的规则。规则没有要求机房，现有 6 个机房里 2 个有号，所以保持可选。 |
| D5 | **派生状态不再存储**：删除 `Port.status` 中 OCCUPIED/AVAILABLE 这部分、`Port.physicalStatus`、`Cable.inventoryStatus`、`Cable.isBranched`、`Workstation` 的 ONLINE/OFFLINE/IN_USE/IDLE。读取时从端点、模块、时间戳推导。 | 原先 11 处以上靠手写同步维护这些值，删除时也不回退，属于结构性漂移源。 |
| D6 | **层级容器删除改为 Restrict**（DataCenter→Room→Cabinet→Device，Room→Workstation）。由服务层先检查，非空就返回 409。组成关系（Device→Panel→Port）保留 Cascade，但服务层在删除前检查是否有占用（线缆、模块、IP），有占用就拒绝。 | 删一个 Room 不会再连带删掉 263 台工作站，删 Port 也不会把实物插头一起删掉。 |
| D7 | **所有写用例都包在一个 `prisma.$transaction(async tx => ...)` 里**，service 函数统一接收 `tx`。 | 去掉 Neo4j 后，全部写入都在同一个 PG 事务内，不会再留下半成品。 |
| D8 | **接口统一为 RPC 风格**：`POST /api/v1/<resource>/<action>`，参数全部放 JSON body。删除所有 GET 查询、`:id` 路径参数和 PUT/DELETE。 | 这是 9x 的规矩，前后端一起改，不保留旧路由。 |
| D9 | **前后端共用 `backend/src/contracts/` 下的 zod schema 和 DTO 类型。** 前端通过 tsconfig paths 和 vite alias `@contracts` 引用，只用 `import type`；枚举常量放在没有依赖的 `contracts/enums.ts`。 | 一份事实源，同时解决前端类型脱节、PanelType 枚举过期、`any` 泛滥三个问题。 |
| D10 | **测试一律跑独立库 `dcagent_test`**（同一个 postgres 容器，不同 database）。重置脚本先断言库名以 `_test` 结尾。E2E 由 Playwright 的 webServer 自行启动 3100（backend）和 5174（vite）。删除 `clear-all-data.ts`、`data:reset`、`data:seed:reset`。 | 从此任何测试都碰不到 `dcagent`，真实库也不再有清空入口。 |
| D11 | **迁移历史压成一个 `0001_baseline`。** 原生 CHECK、EXCLUDE 和触发器手写追加在同一个 migration.sql 里。 | `prisma migrate diff` 已确认当前没有漂移，压平是安全的。这些约束 Prisma 不建模，也不会被它的 diff 删掉。 |
| D12 | **不在今晚自动删除"447实验室 虚拟机柜"**，只是把 `Device.cabinetId` 改成可空。这台机柜和它的标签 941306 原样迁移。 | 这一条属于数据清理，不是设计问题，删不删要 9x 决定。保留它可以让 Cabinet 对账保持 11 条。 |
| D13 | **缺号的实体一律发全新号**，从当前最大号 941307 往后递增，状态为 GENERATED，并输出补打清单。现有 54 个 GENERATED 号保持未绑定。 | 这 54 个号有可能已经在系统外打印过，复用它们可能和抽屉里的实物标签撞号。 |
| D14 | **今晚不切换 Express 5，也不把所有旧页面都改成 react-query**，原因见第 9 节。新功能线统一使用 react-query hooks。 | 需要控制一夜的工作量和风险。 |

---

## 1. 新 schema（逐模型）

总原则：
- id 继续使用 uuid，迁移时**原样保留旧 id**。这样对账可以按主键逐条比对，前端书签和已打印的二维码（如果编码的是 id）也不会失效。
- 数据库层的约束统一写在 `0001_baseline/migration.sql` 末尾的 "-- native constraints" 段落里。

### 1.1 层级

```prisma
model DataCenter {
  id        String   @id @default(uuid())
  name      String   @unique
  location  String?
  rooms     Room[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Room {
  id           String     @id @default(uuid())
  name         String
  floor        String?
  notes        String?
  dataCenterId String
  dataCenter   DataCenter @relation(fields: [dataCenterId], references: [id], onDelete: Restrict)
  widthM       Float?     // 原 floorPlanWidth，3D/平面图用
  depthM       Float?     // 原 floorPlanHeight
  label        Label?
  cabinets     Cabinet[]
  devices      Device[]   // 不在机柜里的设备
  workstations Workstation[]
  ipSubnets    IpSubnet[]
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
  @@unique([dataCenterId, name])
}

model Cabinet {
  id           String   @id @default(uuid())
  name         String
  positionCode String?  // 原 position（"A"、"A-01" 这类文本位号）
  heightU      Int      @default(42)
  notes        String?
  roomId       String
  room         Room     @relation(fields: [roomId], references: [id], onDelete: Restrict)
  // 平面图 / 3D：机房坐标系，单位米，(fpX,fpY) 为机柜左前角；fpRotation 为正面朝向
  fpX          Float?
  fpY          Float?
  fpW          Float?   // 宽，空 = 前端默认 0.6
  fpD          Float?   // 深，空 = 前端默认 1.2
  fpRotation   Int      @default(0)
  label        Label?
  devices      Device[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@unique([roomId, name])
}
```

改动及原因：
- 删除实体上的 `shortId`，统一改用 `Label` 反向持有（D2）。
- `floorPlanPosition`/`floorPlanSize` 从 Json 拆成 Float 列，可以排序、可以做 CHECK，3D 也能直接用。
- 新增 `fpRotation`，供 3D 视图使用。
- CHECK：`(fpX IS NULL) = (fpY IS NULL)`、`(fpW IS NULL) = (fpD IS NULL)`、`fpRotation IN (0,90,180,270)`、`heightU BETWEEN 1 AND 60`。
- 增加同父级下名称唯一。
- 上级关系改为 Restrict（D6）。

### 1.2 设备与设备型号

```prisma
model DeviceModel {          // 新增：给面板模板、3D 尺寸留位置
  id         String     @id @default(uuid())
  vendor     String     @default("")
  name       String               // 型号，如 "S5735-L48T4X"
  deviceType DeviceType
  uHeight    Int        @default(1)
  depthMm    Int?                 // 3D 用
  notes      String?
  devices    Device[]
  templates  PanelTemplate[]
  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt
  @@unique([vendor, name])
}

model Device {
  id            String       @id @default(uuid())
  name          String
  type          DeviceType
  deviceModelId String?
  deviceModel   DeviceModel? @relation(fields: [deviceModelId], references: [id], onDelete: SetNull)
  serialNo      String?      @unique
  sysname       String?      @unique   // 与网络设备对齐的键，如 "445A-U6"
  cabinetId     String?
  cabinet       Cabinet?     @relation(fields: [cabinetId], references: [id], onDelete: Restrict)
  roomId        String?                // 仅当不在机柜里时填写
  room          Room?        @relation(fields: [roomId], references: [id], onDelete: Restrict)
  uPosition     Int?
  uHeight       Int          @default(1)
  notes         String?
  panels        Panel[]
  ipAddresses   IpAddress[]
  observations  PortObservation[]
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  @@unique([cabinetId, name])
  @@unique([roomId, name])
}
```

改动及原因：
- `cabinetId` 改为可空，新增 `roomId`。CHECK `num_nonnulls("cabinetId","roomId") = 1`，即设备要么在机柜里，要么直接挂在机房下。
- 只有在机柜里的设备才有 U 位：CHECK `("uPosition" IS NULL) OR ("cabinetId" IS NOT NULL AND "uPosition" >= 1)`，并且 `uHeight >= 1`。
- 防止 U 位重叠：`EXCLUDE USING gist ("cabinetId" WITH =, int4range("uPosition","uPosition"+"uHeight") WITH &&) WHERE ("uPosition" IS NOT NULL)`，需要 `CREATE EXTENSION btree_gist`。
- "设备不超出机柜高度"涉及两张表，由服务层校验，越界时报 `U_OUT_OF_RANGE`。
- 自由文本 `model` 改成 `DeviceModel` 外键，为模板和 3D 尺寸留位置。
- 新增 `sysname`，解决可观测性数据和设备永远对不上的问题。
- 删除 `GPU6`、`445A-U9` 这类名字里重复编码柜号的写法，是**数据层面**的事，今晚不改名字。

### 1.3 面板、端口、模板

```prisma
enum PanelType  { NETWORK POWER CONSOLE USB OTHER }          // 删 MIXED
enum PanelFace  { FRONT REAR }
enum PortType   { RJ45 SFP SFP_PLUS SFP28 QSFP QSFP28 QSFP_DD CONSOLE USB POWER OTHER }
enum PortAdminState { NORMAL RESERVED FAULTY }

model Panel {
  id               String         @id @default(uuid())
  name             String
  type             PanelType
  face             PanelFace      @default(FRONT)
  notes            String?
  deviceId         String
  device           Device         @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  templateId       String?
  template         PanelTemplate? @relation(fields: [templateId], references: [id], onDelete: SetNull)
  templateRevision Int?           // 套用时模板的 revision；与模板当前 revision 不同即"模板已更新"
  widthMm          Float?
  heightMm         Float?
  label            Label?
  ports            Port[]
  parkedEndpoints  CableEndpoint[] @relation("ParkedOnPanel")
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
  @@unique([deviceId, name])
}

model Port {
  id            String         @id @default(uuid())
  panelId       String
  panel         Panel          @relation(fields: [panelId], references: [id], onDelete: Cascade)
  number        String         // 显示编号，如 "ge11"
  sortIndex     Int            // 排序用，取代按字符串排序
  ifName        String?        // 规范接口名，如 "GigabitEthernet0/0/11"
  portType      PortType
  label         String?
  adminState    PortAdminState @default(NORMAL)
  notes         String?
  // 相对面板左上角，单位 mm；四个要么全有要么全无
  xMm           Float?
  yMm           Float?
  wMm           Float?
  hMm           Float?
  rotation      Int            @default(0)
  cableEndpoint CableEndpoint?          // 一口最多一个插头（portId @unique）
  opticalModule OpticalModule?
  ipAddress     IpAddress?
  attachedWorkstations Workstation[]
  observations  PortObservation[]
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  @@unique([panelId, number])
  @@unique([panelId, ifName])
  @@index([panelId, sortIndex])
}

model PanelTemplate {
  id            String              @id @default(uuid())
  name          String              @unique
  type          PanelType
  face          PanelFace           @default(FRONT)
  deviceModelId String?
  deviceModel   DeviceModel?        @relation(fields: [deviceModelId], references: [id], onDelete: SetNull)
  widthMm       Float               @default(482.6)
  heightMm      Float               @default(44.45)
  generator     Json?               // 参数化生成器的参数，结构由 contracts/panelTemplate.ts 的 zod 定义，带 version 字段
  revision      Int                 @default(1)   // 每次修改端口定义 +1
  description   String?
  ports         PanelTemplatePort[]
  panels        Panel[]
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
}

model PanelTemplatePort {
  id         String        @id @default(uuid())
  templateId String
  template   PanelTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)
  number     String
  sortIndex  Int
  portType   PortType
  ifName     String?       // 可含占位符，如 "GigabitEthernet0/0/{n}"，套用时展开
  xMm        Float
  yMm        Float
  wMm        Float
  hMm        Float
  rotation   Int           @default(0)
  @@unique([templateId, number])
}
```

改动及原因：
- 删除 `Port.status`（OCCUPIED/AVAILABLE）和 `physicalStatus`、`PhysicalStatus` 枚举。只保留人工意图 `adminState`（D5）。
- 删除 Panel 上的 `isCustomized`、`backgroundColor`、`image`、`svgPath`，以及 Panel/Port 的 Json `position`/`size`。实测这些字段全部 0 行有值。
- 布局改成带类型的 mm 列，供模板线和 3D 使用。
- `rotation` 改为 Int，加 CHECK `IN (0,90,180,270)`。几何字段加"全有或全无"的 CHECK。
- `portType` 从自由字符串改为枚举。现有数据只有 RJ45 和 SFP。
- 新增 `sortIndex`：迁移时取 number 尾部的数字，没有数字就按原顺序递增。
- 新增 `ifName`，并加 `@@unique([panelId, ifName])`。
- 模板的端口定义从 Json 数组改为 `PanelTemplatePort` 表。新增 `deviceModelId`、`revision`、`face`。
- `Panel.templateRevision` 用于判断"模板已更新、可以重新套用"。
- 套用规则见第 7 节。

### 1.4 线缆

```prisma
enum CableMedium   { CAT5E CAT6 CAT6A CAT7 FIBER_SM FIBER_MM DAC AOC POWER OTHER }
enum ConnectorType { RJ45 LC SC MPO SFP SFP_PLUS QSFP QSFP28 OTHER }
enum CableEnd      { A B }

model Cable {
  id        String          @id @default(uuid())
  medium    CableMedium
  label     String?         // 人工备注标签；拓扑描述展示时实时拼，不入库
  lengthM   Float?
  color     String?
  notes     String?
  endpoints CableEndpoint[]
  createdAt DateTime        @default(now())
  updatedAt DateTime        @updatedAt
}

model CableEndpoint {
  id            String         @id @default(uuid())
  cableId       String
  cable         Cable          @relation(fields: [cableId], references: [id], onDelete: Cascade)
  end           CableEnd
  connector     ConnectorType?
  portId        String?        @unique
  port          Port?          @relation(fields: [portId], references: [id], onDelete: SetNull)
  parkedPanelId String?        // 挂在面板上但没插口（悬挂端）
  parkedPanel   Panel?         @relation("ParkedOnPanel", fields: [parkedPanelId], references: [id], onDelete: SetNull)
  label         Label?
  notes         String?
  createdAt     DateTime       @default(now())
  updatedAt     DateTime       @updatedAt
  @@unique([cableId, end])
  @@index([parkedPanelId])
}
```

改动及原因：
- `type` 改名为 `medium`。介质和端子形态拆开：端子形态放到端点的 `connector` 上。`QSFP_TO_SFP` 等旧值都是 0 行，可以直接删。
- 删除 `inventoryStatus` 和 `isBranched`。线缆状态由端点推导：已接端口数为 0 视为"在库"，大于 0 视为"在用"。
- `CableEndpoint.portId` 加 `@unique`，从数据库层禁止一口多插。
- 端口或面板被删时，外键改为 SetNull，**实物插头和它的标签都还在**。
- 原来 `panelId` 和 `portId` 双写，现在 `panelId` 改名为 `parkedPanelId`，只表示悬挂。CHECK `"portId" IS NULL OR "parkedPanelId" IS NULL`。插在端口上的端点，所在面板一律经 `port.panel` 获取。
- `endType` 从自由字符串改为枚举 `A/B`。将来要做分支线缆时再加 B1..Bn。
- 一根线缆必须正好两个端点（A 和 B），由创建用例保证，并由集成测试覆盖。

### 1.5 标签（shortID）

```prisma
enum LabelState { GENERATED PRINTED VOID }

model Label {
  shortId         Int            @id
  state           LabelState     @default(GENERATED)
  printTaskId     String?
  printTask       PrintTask?     @relation(fields: [printTaskId], references: [id], onDelete: SetNull)
  printedAt       DateTime?
  batchNo         String?
  notes           String?
  firstBoundAt    DateTime?      // 一旦非空，永不清空；自动分配跳过这些号
  boundAt         DateTime?      // 最近一次绑定时间（信息性）
  roomId          String?        @unique
  room            Room?          @relation(fields: [roomId], references: [id], onDelete: SetNull)
  cabinetId       String?        @unique
  cabinet         Cabinet?       @relation(fields: [cabinetId], references: [id], onDelete: SetNull)
  panelId         String?        @unique
  panel           Panel?         @relation(fields: [panelId], references: [id], onDelete: SetNull)
  cableEndpointId String?        @unique
  cableEndpoint   CableEndpoint? @relation(fields: [cableEndpointId], references: [id], onDelete: SetNull)
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt
  @@index([state])
}

enum PrintTaskStatus { PENDING COMPLETED FAILED }
model PrintTask {
  id          String          @id @default(uuid())
  name        String
  status      PrintTaskStatus @default(PENDING)
  notes       String?
  createdBy   String?
  labels      Label[]
  createdAt   DateTime        @default(now())
  completedAt DateTime?
  updatedAt   DateTime        @updatedAt
}
```

原生约束：
- CHECK `num_nonnulls("roomId","cabinetId","panelId","cableEndpointId") <= 1`：一个号最多绑定一个实体，跨表唯一由此保证。
- CHECK `state <> 'VOID' OR num_nonnulls(...) = 0`：已作废的号不能绑定实体。
- CHECK `num_nonnulls(...) = 0 OR "firstBoundAt" IS NOT NULL`：绑定过的号必须有首次绑定时间。
- 延迟约束触发器 `CONSTRAINT TRIGGER ... AFTER INSERT ON "Cabinet"/"Panel"/"CableEndpoint" DEFERRABLE INITIALLY DEFERRED`。提交时检查 `EXISTS (SELECT 1 FROM "Label" WHERE "<fk>" = NEW.id)`，不满足就报 `LABEL_REQUIRED`（D4）。
- 另有一条 `AFTER UPDATE OF <fk> ON "Label"` 的延迟触发器：如果旧实体仍然存在却已经没有标签，就报错。这样"换标签"必须在同一个事务里同时绑上新号。实体被删除引发的 SetNull 不受影响，因为那时旧实体已经不在了。

删除的内容：
- `ShortIdPool`、`CableShortIdPool`、`EntityType`、`ShortIdPoolStatus`。
- `ShortIdPool` 上重复的 `@@index([shortId])`。
- `PrintTask.count` 和 `filePath`：count 由关联标签数推导；CSV 改为实时导出，不落盘。

### 1.6 光模块

```prisma
enum TransceiverForm { SFP SFP_PLUS SFP28 QSFP QSFP28 QSFP_DD OTHER }
model OpticalModule  { ... moduleType TransceiverForm; currentPortId String? @unique, onDelete: Restrict ... }
model ModuleMovement { ... fromPortId String?, fromPort Port? (SetNull); toPortId String?, toPort Port? (SetNull) ... }
```

改动及原因：
- `moduleType` 从 String 改为枚举。
- CHECK `("status" = 'INSTALLED') = ("currentPortId" IS NOT NULL)`，保证安装状态与端口一致。
- 端口上装着模块时，数据库层不允许删除该端口。
- ModuleMovement 的 from/to 补上外键。
- 现有数据为 0 行，不涉及迁移。

### 1.7 IP 管理

```prisma
enum IpStatus { ALLOCATED RESERVED BLOCKED }        // 删 FREE：空闲 = 没有行
model IpSubnet {
  id String @id @default(uuid())
  name String
  network String @unique @db.Inet   // 带前缀，如 "192.168.99.0/24"；cidr 由 masklen 推导
  gateway String? @db.Inet
  vlan Int?
  dnsServers String[]
  description String?
  roomId String?  (Room, SetNull)
  ipAddresses IpAddress[]
  ...
}
model IpAddress {
  id String @id @default(uuid())
  subnetId String (IpSubnet, onDelete: Restrict)
  address String @db.Inet
  status IpStatus @default(ALLOCATED)
  portId String? @unique (SetNull)
  deviceId String? (SetNull)          // 仅用于无端口的管理地址
  workstationId String? @unique (SetNull)
  hostname String?
  macAddress String?
  description String?
  ...
  @@unique([subnetId, address])
}
```

改动及原因：
- IP 和网段改用 `inet` 类型，排序和包含判断都由 Postgres 原生完成，修掉".10 排在 .2 前面"的问题。
- 地址唯一改为子网内唯一。
- CHECK `num_nonnulls("portId","deviceId","workstationId") <= 1`，消除 portId 和 deviceId 双绑定。
- CHECK `network(network)::inet = network`：网段的主机位必须为 0。
- 触发器 `ip_in_subnet`：要求 `address << subnet.network`，否则报 `IP_OUT_OF_SUBNET`。
- 建子网**不再预生成 65536 行**。next-available 改用 `generate_series` 和反连接计算。
- `dnsServers` 改为数组，修掉双重 JSON 编码。
- `vlan` 改为 Int，CHECK `1..4094`。

### 1.8 工作站与可观测性

```prisma
enum WorkstationAdminState { ACTIVE MAINTENANCE FAULTY RETIRED }
model Workstation {
  id String @id @default(uuid())
  name String
  code String? @unique
  roomId String (Room, Restrict)
  cpu/memory/storage/gpu/os String?
  adminState WorkstationAdminState @default(ACTIVE)
  assignedTo String?
  fpX/fpY/fpW/fpD Float?
  notes String?
  attachedPortId String? (Port, SetNull)   // 取代 switchName/switchPort
  lastSeenAt    DateTime?   // 最近一次探测到在线
  lastCheckedAt DateTime?   // 最近一次探测（无论结果）
  ipAddress IpAddress?      // IP/MAC 只在 IpAddress
  @@unique([roomId, name])
}
model PortObservation {
  id String @id @default(uuid())
  deviceId String (Device, Cascade)       // 必填
  portId String? (Port, SetNull)
  ifName String                            // 采集到的原始接口名，历史行保留
  ...计数器字段不变...
  collectedAt DateTime @default(now())
  @@index([deviceId, ifName, collectedAt])
}
enum UnmatchedSource { WORKSTATION_ATTACH PORT_OBSERVATION }
model ObservationUnmatched {     // 解析不了 sysname/ifName 的原始数据暂存，不丢
  id String @id @default(uuid())
  source UnmatchedSource
  sysname String
  ifName String?
  workstationId String? (Workstation, Cascade)
  payload Json
  createdAt DateTime @default(now())
}
```

改动及原因：
- 在线与否由数据推导：`lastSeenAt IS NOT NULL AND lastSeenAt >= lastCheckedAt`。采集程序不再覆盖人工设置的 MAINTENANCE 状态。
- `switchName`/`switchPort` 改为外键 `attachedPortId`。
- `ipAddress`/`macAddress` 迁到 IpAddress。
- PortObservation 改为必须关联设备。采集时通过 `Device.sysname` 和 `Port.ifName` 解析，解析不了的写入 `ObservationUnmatched`，不再写自由文本。
- 接口名统一规范化：`GE` 写成 `GigabitEthernet`，`XGE` 写成 `XGigabitEthernet`。规范化函数放在 `contracts/ifName.ts`，前后端共用。
- `Workstation @@unique([roomId,name])` 写入前，迁移脚本要先检查重名，有重名就停下报告。

---

## 2. 数据库、环境与工具链

| 库 | 用途 | 谁能动 |
|---|---|---|
| `dcagent` | 真实数据，由 3000 端口的服务使用 | 只允许 `prisma migrate deploy` 和 `migrate-from-legacy --apply` |
| `dcagent_legacy` | 从备份恢复出来的旧结构，只读数据源 | `scripts/restore-legacy.sh` 每次 drop 后重建 |
| `dcagent_test` | 单元集成测试、E2E 测试、迁移演练 | 测试 globalSetup 用 `migrate reset --force` |
| `dcagent_shadow` | 生成新迁移时 `prisma migrate dev` 用的 shadow 库 | 仅开发时使用，**绝不能指向 dcagent** |

- `backend/src/config/env.ts`：作为入口的第一个 import，按 `NODE_ENV` 加载 `.env` 或 `.env.test`，用 zod 校验 `DATABASE_URL`、`PORT`、`HOST`、`CORS_ORIGIN`、`ONLINE_STALE_MINUTES`，缺任何一项就启动失败。不设任何默认凭据。
- `backend/src/utils/prisma.ts` 是唯一的 PrismaClient。删除 5 处 `new PrismaClient()`。启动时注册 SIGTERM，收到后执行 `$disconnect`。
- 新增 `backend/scripts/lib/assertDb.ts`，导出 `assertTestDb(url)` 和 `assertNotLegacy(url)`，所有破坏性脚本都要先调用。
- `package.json` scripts 调整为：
  - `test:unit`：不连数据库的纯单元测试。
  - `test:int`：用 `.env.test` 跑 `*.int.test.ts`，前置 `db:test:reset`。
  - `test` 同时跑以上两项。
  - `db:deploy`、`db:test:reset`、`db:legacy:restore`、`migrate:legacy`、`typecheck`（使用 `tsconfig.check.json`，覆盖 src、scripts、prisma、test）。
  - 删除 `prisma:migrate`、`data:*`、`dev:clean`、`kill`、`test:snmp`、`test:lenovo`、`test:template`、`snmp:walk`、`topology:447:import`。
- 构建用的 tsconfig 排除 `*.test.ts`。
- `docker-compose.yml`：
  - 合并 dev 和正式两份 compose，删掉 `version` 字段。
  - 删除 neo4j 服务、APOC 和对应的卷声明。现有 neo4j 容器和卷今晚只 `docker stop`，**不删**（见 deferred）。
  - 端口只绑 `127.0.0.1`。口令写成 `${POSTGRES_PASSWORD:?}`，从 `.env` 读取。
- 前端环境变量：删除 `.env.development`、`.env.production`、`.env.local.example`，只保留 `.env.example`。浏览器一律走同源 `/api/v1`。vite proxy 的转发目标读不带 VITE_ 前缀的 `API_PROXY_TARGET`，默认 `http://localhost:3000`。删除 `VITE_API_BASE_URL`。
- CORS 限制为 `CORS_ORIGIN`，默认 `http://localhost:5173`。

---

## 3. 数据迁移方案

### 3.1 步骤（按顺序执行，每步都要能重跑）

1. **停服务、补一份当前快照**
   - 停掉 3000 和 5173。
   - `docker exec dcagent-postgres pg_dump -U dcagent -Fc dcagent > db-backups/dcagent-pre-reset-<YYYYMMDD-HHMM>.dump`。文件名带时间戳，绝不覆盖已有文件。
   - 对两份基线备份执行 `chmod a-w`，并记录 `shasum -a 256` 到 `db-backups/SHA256SUMS-20261025`（新文件）。
2. **恢复 legacy 库**：执行 `scripts/restore-legacy.sh`，内容为：
   - `DROP DATABASE IF EXISTS dcagent_legacy WITH (FORCE)`，然后 `CREATE DATABASE dcagent_legacy`。
   - `docker exec -i dcagent-postgres pg_restore -U dcagent -d dcagent_legacy --no-owner --no-privileges < db-backups/dcagent-before-night-modernize-20261025-0057.dump`。只通过 stdin 读取备份文件。
   - 最后打印各表行数。
3. **在测试库上演练**：
   - `db:test:reset` 把 `dcagent_test` 建成新结构。
   - 执行 `migrate:legacy --target=test --apply`，查看对账报告。
   - 对账全部绿色之后才能进入下一步。
4. **重置真实库**：
   - `DROP DATABASE dcagent WITH (FORCE)`，然后 `CREATE DATABASE dcagent`。
   - 执行 `prisma migrate deploy`，建出 0001_baseline。
   - 执行 `migrate:legacy --target=prod --apply`。
5. **验证**：
   - 对账报告全部绿色。
   - 启动服务，手工抽查若干记录。
   - 执行 `migrate:legacy --target=prod --apply` 第二次，结果应当与第一次逐条相同，以此证明可重复执行。

### 3.2 `backend/scripts/migrate-from-legacy.ts`

参数与行为：
- 必填参数：`--target=test|prod`，分别对应 `.env.test` 和 `.env` 中的 `DATABASE_URL`。
- legacy 连接串来自 `LEGACY_DATABASE_URL`，默认值是把 `DATABASE_URL` 的库名换成 `dcagent_legacy`。
- 不带 `--apply` 时为 dry-run：完整执行一遍，然后回滚。
- 启动前断言：target 的库名不能是 `dcagent_legacy`；target 和 legacy 的 URL 不能相同。

实现要点：
- 用两个 PrismaClient。legacy 那一个只用 `$queryRaw` 读取旧表，因为旧结构没有对应的 Prisma 类型。
- 写入在**一个交互式事务**中完成，超时设为 120 秒。
  - 第一步：`TRUNCATE` 新库所有业务表，`RESTART IDENTITY CASCADE`。
  - 第二步：按依赖顺序写入，**保留旧 id**。
- 事务提交后执行对账，输出控制台表格，同时写入 `backend/migration-reports/<ts>.json`（该目录加入 .gitignore）。
- 任一项对账失败，进程以非零码退出。

### 3.3 映射规则

| 旧 | 新 | 规则 |
|---|---|---|
| DataCenter 1 | DataCenter 1 | 原样迁移 |
| Room 6 | Room 6 | `floorPlanWidth/Height` 映射为 `widthM/depthM`；shortId 处理见 Label |
| Cabinet 11 | Cabinet 11 | `position` 映射为 `positionCode`；`height` 映射为 `heightU`；`floorPlanPosition{x,y}` 映射为 fpX/fpY；`floorPlanSize{width,depth}` 映射为 fpW/fpD；虚拟机柜原样保留（D12） |
| Device 35 | Device 35 | 迁移后全部有 `cabinetId`、`roomId` 为空。`uHeight` 为空的 8 台设为 1。`model` 去重后建 DeviceModel（预计 14 条，vendor 为 `""`，deviceType 取第一台设备的 type），再回填 `deviceModelId`。`sysname` 的规则见表后 |
| Panel 41 | Panel 41 | `type` 原值保留（只有 NETWORK）；`face` 按名字推导：含"后"为 REAR，其余为 FRONT；布局字段全部为空，直接丢弃（实测 0 行有值） |
| Port 180 | Port 180 | 状态：`status` 为 RESERVED 映射为 RESERVED，FAULTY 映射为 FAULTY，其余映射为 NORMAL，`physicalStatus` 丢弃；`portType` 字符串转枚举，遇到未知值就中止；`sortIndex` 取 number 尾部数字；`ifName` 的规则见表后 |
| Cable 42 | Cable 42 | `type` 映射为 `medium`（CAT6 和 FIBER_SM 同名）；`length` 映射为 `lengthM`；`label`、`color`、`notes` 原样；`inventoryStatus`、`isBranched` 丢弃 |
| CableEndpoint 84 | CableEndpoint 84 | `endType` 映射为 `end`；有 `portId` 时 `parkedPanelId` 置空；没有 `portId` 但有 `panelId`（20 条悬挂端）时，`panelId` 映射为 `parkedPanelId`；`connector` 对 CAT* 线缆填 RJ45，其余留空 |
| ShortIdPool 120 | Label 120 + 新号 | 见表后的标签规则 |
| （缺号实体） | Label +72（预计） | 见表后的标签规则 |
| CableShortIdPool 0 | 删除 | 迁移前断言该表为 0 行，不是 0 行就中止 |
| PrintTask / OpticalModule / ModuleMovement / PanelTemplate 0 | 0 | 迁移前断言为 0 行；如果不是 0 行，按字段迁移（PrintTask.status 字符串转枚举） |
| IpSubnet 6 | IpSubnet 8 | 原 6 条：`network + "/" + cidr` 映射为 inet，`dnsServers` 反序列化后转为数组，`vlan` 转 Int（现在全部为空）。另外为工作站 IP 自动建 2 个 /24（10.99.31.0/24 和 198.51.100.0/24），name 为"教室终端 <net>（迁移自动建）"，roomId 只在全部工作站属于同一机房时填写 |
| IpAddress 33 | IpAddress 296 | 原 33 条：19 条同时有 port 和 device 的，清空 deviceId，并断言 `port.panel.deviceId` 等于原 deviceId，不等就中止。另外每台工作站生成一条 ALLOCATED 记录，包含 address、macAddress 和 workstationId，共 263 条 |
| Workstation 263 | Workstation 263 | 状态：ONLINE、OFFLINE、IN_USE、IDLE 映射为 ACTIVE；MAINTENANCE 和 FAULTY 原样。时间戳：ONLINE 的 `lastCheckedAt` 取 `lastSeenAt`；其余取 legacy 的 `updatedAt`，也就是该行状态最后一次被写入的时间，属于真实数据。连接口：switchName/switchPort 映射为 `attachedPortId`，解析不了的整行原值写入 `ObservationUnmatched(WORKSTATION_ATTACH)` |
| PortObservation 127 | PortObservation + Unmatched = 127 | 按 switchName 和 sysname 找设备，`interface` 映射为 `ifName`，再解析 portId（可以为空）；找不到设备的写入 `ObservationUnmatched(PORT_OBSERVATION)` |

**Device.sysname 规则。** 名字匹配 `^(\S+-U\d+|\d+stack)\s` 的，取前缀作为 sysname，例如 `445A-U6 交换机` 得到 `445A-U6`。另有一张显式覆盖表 `{ "F13 核心交换机": "445C-F13" }`。其余设备的 sysname 留空。覆盖表写在脚本里，并在对账报告中列出。

**Port.ifName 规则。** 只对已经有 sysname、且不是 stack 的交换机生效。number 匹配 `^ge(\d+)$` 时生成 `GigabitEthernet0/0/<n>`，匹配 `^xge(\d+)$` 时生成 `XGigabitEthernet0/0/<n>`，其余留空。这是启发式规则，对账报告会列出每台交换机生成了多少个 ifName、有多少个工作站或观测因此解析成功，交给 9x 复核。

**标签规则。**
- 旧 BOUND 66 条：按 `entityType/entityId` 回填对应的外键列。`state` 为 PRINTED（如果有 `printedAt` 或 `printTaskId`），否则为 GENERATED。`firstBoundAt` 和 `boundAt` 取旧的 `boundAt`，旧值为空时取 `updatedAt`。
- 旧 GENERATED 54 条：原样迁移，不绑定。
- 旧 CANCELLED（现在为 0 条）：映射为 VOID。
- 迁移前做一致性断言：旧四张实体表上的 `shortId` 集合，必须等于池中 BOUND 记录的集合，并且一一对应。不相等就中止，打印差异。
- 缺号实体：机柜 3、面板 7、端点 62，共 72 个（以实际数量为准）。从 `max(shortId)+1` 起依次发新号，状态为 GENERATED，立即绑定，`notes` 写"迁移补号 20261025"。全部写入 `backend/migration-reports/labels-to-print-<ts>.csv`，列为 shortId、实体类型、所在位置路径，供 9x 打印。
- 房间缺号不补（D4）。

### 3.4 对账（脚本最后执行，全部为绿色才算成功）

1. **行数**：每张表都列出 legacy 行数、new 行数、预期差值和原因，例如 `IpAddress: 33 → 296 (+263 workstation)`、`Label: 120 → 192 (+72 补号)`、`ShortIdPool → Label`、`CableShortIdPool 0 → 删除`。
2. **主键集合**：Device、Panel、Port、Cable、CableEndpoint、Cabinet、Room、Workstation、IpSubnet（原 6 条）、IpAddress（原 33 条）、PortObservation，在新库中的 id 集合必须等于 legacy 的 id 集合。PortObservation 的比较方式是"新表 id 集合加上 unmatched.payload.id 集合"。
3. **关系元组**：
   - `(cableId, end, portId)` 共 84 条，与 legacy 的 `(cableId, endType, portId)` 逐条相等。
   - 悬挂端 `(cableId, end, parkedPanelId)` 等于 legacy 中 `portId` 为空那部分的 `panelId`。
   - `Port.panelId`、`Panel.deviceId`、`Device.cabinetId`、`Cabinet.roomId`、`Workstation.roomId` 逐条相等。
4. **标签**：
   - 旧 66 条 `(shortId, entityType, entityId)` 在新库中都能查到相同的绑定。
   - 新库里没有任何一个机柜、面板或端点缺标签。
   - 新库标签总数等于 120 加上补号数。
5. **派生状态与旧缓存一致**：
   - 有端点的端口集合等于 legacy 中 `status = OCCUPIED` 的集合，共 64 个。
   - 推导为"在用"的线缆等于 legacy 中的 IN_USE（32 条），"在库"等于 INVENTORIED（10 条）。
   - 推导为在线的工作站等于 legacy 中的 ONLINE（61 台）。
   - IP 推导出的设备等于 legacy 中的 `deviceId`。
6. **业务字段抽样哈希**：Device、Cabinet、Panel、Port、Cable、Workstation 的业务字段经过列名映射后拼接，分别计算 md5，逐行比较新旧两边。
7. **Neo4j 证据（可选，不阻塞）**：如果 `dcagent-neo4j` 还在运行，只读查询 Port-Cable-Port 三元组，确认 PG 包含 Neo4j 的全部三元组，多出的部分只能是那条 E2E 残留 `8bbeb37d…`。结果写入报告。

---

## 4. 后端重构

### 4.1 结构

```
backend/src/
  config/env.ts
  contracts/          # zod schema + DTO + enums（前端共享）
    enums.ts  errors.ts  ifName.ts  common.ts
    labels.ts hierarchy.ts devices.ts panels.ts cables.ts ip.ts workstations.ts
    observability.ts panelTemplates.ts search.ts dashboard.ts scene.ts
  http/
    rpc.ts            # rpc(router, 'action', schema, (body, ctx) => service...)
    errors.ts         # AppError 及子类 + 唯一的错误中间件
  services/           # 每个用例 (tx?, input) => DTO；只抛 AppError
  routes/             # 只有 parse/调 service/返回
  utils/prisma.ts
```

- **错误处理**：
  - 统一的错误中间件负责映射：ZodError 映射为 400 `VALIDATION_ERROR`；AppError 用自身的状态码；Prisma P2002 映射为 409 `UNIQUE_VIOLATION`，P2025 映射为 404 `NOT_FOUND`；原生约束和触发器的错误按约束名或 SQLSTATE 映射成具体 code（例如 `LABEL_REQUIRED`、`U_SPACE_CONFLICT`、`IP_OUT_OF_SUBNET`、`PORT_OCCUPIED`）。其余一律 500 `INTERNAL`，不回显内部 message。
  - 响应体固定为 `{ code, message, details }`。
  - 删除 `crudRouteHandler.ts` 和各路由里重复的 try/catch。
- **标签服务** `labelService`：
  - `bind(tx, shortId, target)`：用 `updateMany where { shortId, state ≠ VOID, 四个 FK 全空 }` 并检查 count === 1，否则报 `LABEL_NOT_AVAILABLE`。
  - `autoAllocate(tx, n)`：只从"GENERATED 且 firstBoundAt 为空"的号里按升序取，不够就生成新号，用 `SELECT ... FOR UPDATE SKIP LOCKED`。
  - `rebind(tx, entity, newShortId, oldPolicy: VOID|KEEP)`、`void(shortIds[], reason)`（只允许未绑定的号）、`resolve(shortId)`、`missing()`。
  - **删除通用的 `/bind` 接口。**
- **线缆服务**：
  - `create`：一次建两端。每端可以选择 labelShortId、portId、parkedPanelId，不传 labelShortId 就自动分配。
  - `connectEnd({endpointId|labelShortId, portId})`：取代 connect-single-port，修掉"扫第二个插头时又新建一根线缆"的问题。
  - `disconnectEnd({endpointId, parkPanelId?})`。
  - `delete({id, voidLabels})`，报废时 `voidLabels = true`。
  - `panelConnections({panelId})` 用一次 include 查询完成，包含同一面板内的 loopback。
  - 端口是否被占用由 `portId @unique` 的唯一冲突判定，映射为 `PORT_OCCUPIED`，不再先读后写。
- **删除用例**：
  - Room、Cabinet、Device 非空时返回 409 `NOT_EMPTY`，details 中列出子项。
  - Panel、Port 有占用（端点、模块、IP、工作站挂接）时返回 409 `PORT_HAS_DEPENDENTS`，details 中列出占用。
  - 传 `force: true` 时，在同一事务里先把端点断开成悬挂（parked 到同一面板之外，即置空），解除 IP 绑定，然后再删除。光模块必须先手工卸下。
- **IP**：
  - 子网创建不再生成 IP 行。
  - `nextAvailable`、`batchAllocate` 用原生 SQL：`generate_series(network+1, broadcast-1)` 反连接已分配地址，在单个事务内完成。
- **可观测性**：
  - `recordSwitchSnapshot` 通过 `sysname` 找设备，找不到时整批写入 unmatched 并返回 `unmatched`。
  - `syncPower` 只写 `lastCheckedAt`，在线时再写 `lastSeenAt`。
  - `syncPorts` 解析 `attachedPortId`，解析不了的写入 unmatched。
  - `seatMap` 和 `workstations/list` 的结果中带上推导出的 `online` 字段。
- **搜索**：`globalSearch` 用 `Promise.all` 并发查询，每类 `take ≤ 20`，统一 `mode: 'insensitive'`。纯数字查询会额外查 Label。
- **删除死代码**：
  - 路由和服务：`routes/monitoring.ts`、`services/snmpService.ts`、`config/deviceTemplates.ts`、`globalShortIdService.ts`、`cableShortIdPoolService.ts`、`routes/cableShortIdPool.ts`、`graph/`。
  - src 下的工具和脚本：`src/test-*.ts`、`src/snmp-walk.ts`、`src/scripts/*`。
  - backend 根目录的一次性脚本：`check-*`、`fix-*`、`query-*`、`test-*`、`clear-*`、`create-mesh-network.*`、`get-switch-ports.ts`、`router-usage-guide.ts`、`snmp-walk-*.json`。
  - scripts 目录：`syncCablesToNeo4j.ts`、`checkNeo4jConnection.ts`、`import-447-topology.ts`、`import-switch-links.ts(+test)`、`import-classroom-workstations.ts(+test)`。这三个导入脚本的数据早已落库，脚本又绕开 service，以后需要时从 git 历史找回，改为调用 service 即可。
  - 种子：`prisma/seed.ts` 改为 `backend/test/fixtures/seed.ts`，**只通过 service 创建数据**，并且只在 `_test` 库上执行。
  - 删除 `prisma/migrations/fix_shortid_system.sql` 和全部旧迁移目录。
  - `collect-observability.ts` 的跳板地址改为必填参数，不再设默认值。
- emoji：随上面的删除，大部分会自然消失。剩下的改成 `[ok]`/`[warn]` 这样的纯文本前缀。`typecheck` 脚本里加一条 grep，拦住新引入的 emoji。

### 4.2 测试（TDD，先红后绿）

集成测试 `*.int.test.ts` 跑在 `dcagent_test` 上。每个文件开始前 TRUNCATE，然后通过 fixture 建最小数据。至少覆盖：

1. 已绑定给机柜的号，再拿去建线缆端点，返回 409 `LABEL_NOT_AVAILABLE`。
2. 直接 SQL 插入一个没有标签的 Cabinet，提交时报错。
3. 删除带连接的 Port：不带 force 时返回 409；带 force 时线缆两端都还在，对端仍然连接，标签仍然绑定。
4. 删除 Panel 后，原面板标签解绑、`firstBoundAt` 保留，`autoAllocate` 不会发出这个号。
5. 同一个端口不能被两个端点占用（并发两次 connectEnd，只有一次成功）。
6. 线缆创建的事务中途注入异常（第二个标签不可用），Cable、Endpoint、Label 全部回滚。
7. U 位重叠被 EXCLUDE 拒绝，超出机柜高度被服务层拒绝。
8. 建 /16 子网只写 1 行，`nextAvailable` 返回 `.1`（或网关之后的第一个地址），排序正确。
9. IP 不在网段内时被触发器拒绝；portId 和 deviceId 同时非空时被 CHECK 拒绝。
10. 采集写入 ONLINE 状态不会覆盖 MAINTENANCE；在线状态推导正确。
11. 删除非空 Room 返回 409。
12. 模板套用：有线缆、模块或 IP 的端口不会被删除（见第 7 节）。
13. `migrate-from-legacy` 在 `dcagent_test` 上跑两遍，对账全部绿色，并且两遍结果一致。这一项需要先执行 `db:legacy:restore`。

现有用 monkey-patch 的路由测试：路由壳改写后，**删掉随之失效的部分**。保留的路由测试只覆盖"zod 拒绝"和"错误码映射"两类，用 `supertest` 风格对接测试库，不再替换单例。纯逻辑单元测试（observability 的 parser/plan、ifName 规范化）保留。

---

## 5. 接口变更清单

全部是 `POST /api/v1/...`，参数放 JSON body。下表中不出现的旧路径一律删除，不保留兼容。

| 资源 | 新动作 | 取代或删除的旧接口 |
|---|---|---|
| datacenters | list, get, create, update, delete | 删 `GET /`、`by-shortid` |
| rooms | list{dataCenterId?,search?}, get, create, update, delete, **scene**{roomId} | 删 `GET /`、`by-shortid`；`floor-plan` 并入 `scene` |
| cabinets | list{roomId?,search?}, get, create{...,labelShortId?}, update（不含标签）, delete | 删 `GET /`、`by-shortid` |
| devices | list{cabinetId?,roomId?,type?,search?}, get, create, update, delete, bulk-create, **move**{id,cabinetId\|roomId,uPosition?} | 删 `GET /`、`by-shortid`（原来恒 404） |
| device-models（新） | list, get, create, update, delete | — |
| panels | list{deviceId?,type?}, get, create{...,labelShortId?}, update（不含标签和布局以外的字段）, delete{id,force?} | 删 `GET /`、`by-shortid`；删 positionX/positionY |
| ports | list{panelId}（带推导状态）, get, create, create-bulk（createMany）, update, **set-admin-state**, delete{id,force?} | 删 `GET /`、`update-status`、`available`（并入 list 的 filter） |
| cables | list{filter:{state?,medium?,search?}}, get, create, update, **connect-end**, **disconnect-end**, delete{id,voidLabels}, panel-connections{panelId}, dangling-by-device | 删 `GET /`、`by-shortid`、`endpoints-by-shortid`（并入 `labels/resolve`）、`manual-inventory`（并入 create）、`connect-single-port`（并入 create/connect-end）、`check-shortid`、`check-multiple-shortids`、`network-topology`；`port-connection` 改为由 `ports/get` 返回 |
| labels（取代 shortid-pool） | list{state?,bound?,kind?,range?}, stats, generate{count}\|{rangeExpr}, **resolve**{shortId}, void{shortIds,reason}, rebind{shortId,target,oldPolicy}, missing{kind?}, print-tasks/list, print-tasks/create, print-tasks/export{id}（返回 CSV blob）, print-tasks/complete{id} | 删整个 `/shortid-pool/*`（含 `bind`、`cancel`、`batch-cancel`、`check`、`records`）；删整个 `/cable-shortid-pool/*` |
| optical-modules | list{status?,moduleType?,search?}, get, by-serial, statistics, create, update, delete, install{id,portId}, uninstall{id}, transfer{id,toPortId}, scrap{id}, history{id} | 删 `POST /`、`GET /`、`/:id/*`、`DELETE /:id`、`GET /statistics` |
| subnets | list, get, create, update, delete, calculate, statistics | 删 `GET /`、`GET /statistics` |
| ip-addresses | list{subnetId,status?}, get, get-by-address, allocate, release, batch-allocate, next-available, update, delete, check-conflicts | 删 `GET /` |
| workstations | list{roomId?,search?}, get, by-code, create, update, **set-admin-state**, delete | 删 `GET /`、`update-status` |
| observability | 原有 9 个动作保留，语义按 4.1 节调整；新增 **unmatched/list**、**unmatched/resolve**{id, deviceId?, portId?} | — |
| panel-templates | list{deviceModelId?}, get, create, update, delete, **generate-preview**{generator}, **apply-preview**{templateId,panelId}, **apply**{templateId,panelId,expectedRevision}, create-panel{templateId,deviceId,face?,labelShortId?}, unbind{panelId}, **export**{ids}, **import**{doc,mode:'create'\|'upsert'} | 删 `GET /`、`GET/PUT/DELETE /:id`、`/:id/create-panel`、`/unbind/:panelId`、`init-system-templates` |
| search | global{q,kinds?,take?} | `by-shortid` 并入 `labels/resolve` |
| dashboard | overview（扩展字段见第 7 节） | `GET /overview` 改为 POST |
| monitoring | — | 整体删除 |

`labels/resolve` 的返回：`{ shortId, state, bound: { kind: 'ROOM'|'CABINET'|'PANEL'|'CABLE_ENDPOINT', id, path: PathNode[] } | null }`，其中 `PathNode = {kind,id,name}`，从数据中心一直到实体。扫码跳转和命令面板都只调这一个接口。

---

## 6. 前端适配

1. **API 层**
   - `services/api.ts` 只导出 `rpc<Req,Res>(path, body)`，并统一解析 `{code,message,details}` 错误：用 `t('errors:<code>', details)` 弹提示。拼 URL 的写法在类型层面就写不出来。
   - 所有 service 统一写成 `export const xxxService = { ... }` 并使用具名导入，删除全部 default 导出，删除 `as any`。
   - 新增 `opticalModuleService`。`OpticalModuleList.tsx` 和 `OpticalModuleDetail.tsx` 删掉写死的 `fetch('http://localhost:3000')`，改为调用它。
2. **类型**
   - 删除 `types/index.ts` 中的实体类型，改为 `import type { ... } from '@contracts/...'`。
   - 选项从 `contracts/enums.ts` 遍历生成，文案放在 `<ns>:enums.<ENUM>.<VALUE>`。
   - PanelType 的旧值 ETHERNET/FIBER/SERIAL 全部删除。`panelLayoutGenerator.ts` 改为按 `portType` 计算尺寸（复用 `constants/portSizes`），其中重复的尺寸表删掉。
3. **字段语义变化（必须逐页适配）**
   - Port：`status`、`physicalStatus` 改为 `adminState`，外加推导字段 `connected` 和 `hasModule`，由后端在 DTO 里计算。
   - Cable：`type` 改名为 `medium`；`inventoryStatus` 改为推导出的 `state: 'STOCK'|'IN_USE'`；`endpoints[]` 每项包含 `end`、`label?.shortId` 和 `port→panel→device→cabinet→room` 路径。不再使用 portA/portB/panelA/panelB 平铺。
   - 实体的 `shortId` 改为 `label: { shortId, state } | null`。
   - 机柜和工作站的 `floorPlanPosition/Size` 改为 `fpX/fpY/fpW/fpD` 和 `fpRotation`。
   - Workstation：`status` 改为 `adminState` 加推导字段 `online`；`ipAddress/macAddress` 改为 `ip: {address, macAddress} | null`；`switchName/switchPort` 改为 `attachedPort: {id, ifName, deviceName} | null`。
   - Device：新增 `roomId`、`deviceModel`、`sysname`。删除不存在的 managementIp、powerPhase、powerSource、snmpEnabled、ipmiEnabled。`ipAddresses` 改为对象数组。
   - IP：子网字段为 `network`（带前缀）和推导出的 `cidr`。空闲 IP 不再有对应的行。
4. **扫码与跳转**
   - AppHeader 扫码改为调用 `labels/resolve`，用返回的 path 跳转，修掉 `device.label` 和 `panel.label` 永远显示兜底文案的问题。
   - 新建 `src/routes.ts`，集中声明路由和路径构造函数（`paths.cabinet(id)` 等）。可分享的定位信息只走路径段：`/cabinets/:id`、`/ports/:id`、`/cables/:id`、`/topology/panel/:id`。
   - 删除 `/cable-topology` 别名、`scanNavigationService`、`location.state` 的兼容分支。`PortDetailView` 改为读路径参数，刷新后不会变成空页面。
   - 菜单由 routes.ts 生成，选中项按最长前缀匹配，打开的分组由当前路由推出。
5. **删除的文件**
   - 页面和组件：`MonitoringPage`、`monitoringService`、`AddDeviceModal`、`SimplifiedTopology.tsx/.css`、`ConnectSingleCableModal`。
   - service 和工具：`cableShortIdPoolService`、`scanNavigationService`、`utils/portTemplates.ts`、`utils/portUtils.ts`，以及 `locales/index.ts` 里两个没人用的函数。
   - 空目录：`components/CommandPalette` 和 `components/dashboard`（外壳线会重建）。
6. **组件收敛（基础层今晚完成，供三条功能线使用）**
   - 新建只读的 `components/panel/PanelView.tsx`，使用 SVG 和 mm 坐标，接收 ports、高亮、连接状态和 onPortClick。
   - CableTopology 中内嵌的 canvas 版 `PortVisualization` 删掉，改用 PanelView，同时修掉逐设备串行请求的 N+1 问题（改用 `panels/list` 返回的层级数据）。
   - `CreateCableModal` 改为一次创建两端，单端接入改用 `connect-end`。
   - CableTopology 中的深度选择器和 `getNetworkTopology` 删除。
7. **i18n**
   - 新增 `errors` 命名空间（三语），覆盖所有错误码。
   - 新增 `src/i18next.d.ts`，声明 `CustomTypeOptions`，以 zh-CN 为基准，缺键在编译期报错。
   - `i18n.ts` 改为用 `import.meta.glob` 自动组装资源。
   - 新增 `frontend/scripts/locale-parity.test.mjs`，用 node --test 比较三种语言的键集合。
   - 补上 management.json 在 en-US 和 ja-JP 中缺的 16 个键，以及 `bulkDeployment.fields.notes`。
   - ESLint 加 `no-restricted-syntax` 规则，禁止 JSX 和 message 中出现 CJK 字面量；同时开启 `no-explicit-any: error`。
8. **环境**：按第 2 节调整，`vite.config.ts` 的 proxy 目标改为读 `API_PROXY_TARGET`。
9. **E2E**
   - `playwright.config.ts` 增加 `globalSetup`（执行 `db:test:reset` 并灌 fixture）和 `webServer`：backend 用 `NODE_ENV=test PORT=3100`；vite 用 `--port 5174 --strictPort`，并设 `API_PROXY_TARGET=http://localhost:3100`。`baseURL` 设为 `http://localhost:5174`。
   - spec 里写死的 `http://localhost:5173` 全部改成相对路径。
   - 删除 `e2e/helpers/reset.ts` 和 `E2E_ALLOW_RESET`。每个 spec 通过 API helper 建自己需要的数据，名字带唯一前缀。
10. **验收**：`npm run build` 也就是 `tsc && vite build`，必须零错误。

---

## 7. 给三条功能线的约定

**外壳、仪表板、命令面板**
- 路由和菜单只在 `src/routes.ts` 中注册，每条路由声明 `path`、`element`、`menuGroup`、`icon`、`labelKey`。菜单分组为：基础设施、连接、标签、网络、工具。
- 服务端数据使用 `@tanstack/react-query`，hooks 放在 `src/api/hooks/<resource>.ts`，query key 统一为 `['<resource>', '<action>', body]`。mutation 成功后 invalidate 对应 resource。
- 命令面板只调两个接口：`search/global {q, take}`，纯数字时再调 `labels/resolve {shortId}`，跳转使用 `paths.*`。
- `dashboard/overview` 返回：
  - 各实体计数；
  - 端口使用率（推导值）；
  - 线缆 STOCK/IN_USE 数量；
  - `labelsMissing`（应当为 0）、`labelsToPrint`（GENERATED 且已绑定）；
  - 工作站在线数；
  - `observationUnmatched` 数；
  - 各子网的使用率。

**three.js 3D 机房**
- 只调 `rooms/scene {roomId}` 一个接口，返回：
  - `room{widthM, depthM}`；
  - `cabinets[{id, name, label, fpX, fpY, fpW, fpD, fpRotation, heightU, devices[{id, name, type, uPosition, uHeight, deviceModel{depthMm}, panels[{id, face, name, portCount, connectedCount}]}]}]`；
  - 不在机柜里的设备 `looseDevices[]`；
  - `workstations[{id, name, fpX, fpY, fpW, fpD, online, adminState}]`。
- 坐标约定：单位为米，原点是机房左上角，x 向右，y 向里。`fpRotation` 为 0 表示机柜正面朝 -y。fpW/fpD 为空时使用默认值 0.6 / 1.2，这两个默认值放在 `contracts/scene.ts`。
- 写入坐标调用 `cabinets/update {id, fpX, fpY, fpRotation}`。

**面板模板（参数化生成、导入导出、套用）**
- 生成器参数用 `contracts/panelTemplate.ts` 中的 `generatorSchema` 定义（带 `version: 1`），由纯函数 `generatePorts(generator) => TemplatePortDraft[]` 实现，前后端共用。`generate-preview` 只调用这个纯函数，不写库。
- 导入导出的格式：`{ format: 'dcagent.panel-template', version: 1, templates: [{ name, type, face, deviceModel?: {vendor, name}, widthMm, heightMm, generator?, ports[] }] }`，由 zod 校验。导入时按 `(vendor, name)` upsert DeviceModel。
- 套用规则（`apply`，单个事务）：
  - 按 `number` 匹配端口。匹配上的更新 `portType`、`sortIndex`、几何字段和 `ifName`（展开 `{n}` 占位符）。**不改动** adminState、label、notes，也不改动连接。
  - 模板里有、面板上没有的端口：新建。
  - 面板上有、模板里没有的端口：只有当它没有任何 CableEndpoint、OpticalModule、IpAddress、attachedWorkstations 和 observations 时才删除；否则保留，并在结果的 `kept[]` 中列出原因。**不允许强制删除。**
  - 应用前比对 `expectedRevision` 和模板当前 `revision`，不一致返回 409 `TEMPLATE_REVISION_MISMATCH`。
  - 写入 `Panel.templateId`、`templateRevision`、`widthMm`、`heightMm`。
- `apply-preview` 返回同样的 diff（`create[]`、`update[]`、`delete[]`、`kept[]`），但不写库。

---

## 8. 执行顺序与验收门

| 阶段 | 内容 | 验收门 |
|---|---|---|
| P0 安全网 | 停服务，补时间戳快照，备份文件 chmod a-w，记录 SHA256 | `shasum` 与记录一致；两份基线备份的 mtime 没有变化 |
| P1 库与工具 | 建 `dcagent_legacy`、`dcagent_test`、`dcagent_shadow`；完成 `restore-legacy.sh`、`assertDb`、`config/env.ts`；整理 compose 和 env | legacy 的行数等于基线（Device 35、Panel 41、Port 180、Cable 42、Cabinet 11、Workstation 263 等） |
| P2 schema | 新的 schema.prisma；生成 0001_baseline 并追加原生约束；先写集成测试（红灯） | 能在 `dcagent_test` 上执行 `migrate reset`；测试为红灯 |
| P3 后端 | contracts、http/rpc、错误中间件、各 service 和路由重写、删除死代码和 Neo4j | `npm run typecheck`、`npm test`（unit + int）全部通过；grep 不到 emoji |
| P4 迁移（可与 P3 并行，schema 定稿后开始） | `migrate-from-legacy.ts` 加对账；先在 test 库演练，然后重置 `dcagent` 并正式迁移；重复执行一次 | 对账全部绿色；第二次执行结果与第一次相同；生成补打清单 CSV |
| P5 前端（与 P3 按 contracts 并行） | 第 6 节的全部内容 | `npm run build` 零错误；`npm run lint` 通过；locale parity 测试通过 |
| P6 E2E 与收尾 | E2E 跑在 3100/5174 和 `dcagent_test` 上；重启 3000/5173；更新 docs/DATABASE.md、API.md、ARCHITECTURE.md，删除 SHORTID.md 和 SNMP 系列文档 | E2E 全部通过；跑 E2E 前后 `dcagent` 的行数不变；人工抽查扫码、建线、断线、IP 分配、座位图 |

可以并行的部分：P3 拆成"标签与层级"、"线缆与端口"、"IP、工作站与可观测性"、"模板、搜索与仪表板"四块；P5 拆成"API 与 contracts 适配"、"拓扑与建线"、"机柜与设备"、"i18n 与 lint"四块。两边都以 `contracts/` 为唯一接口约定，contracts 必须先合入。

---

## 9. 今晚不做（deferred）

1. **删除"447实验室 虚拟机柜"并把 447 AR651C 改成直接挂在机房下。** 这是数据清理，涉及一个已绑定的标签 941306，要 9x 确认后在界面上操作。schema 已经支持。
2. **为 Room 补 shortID。** 规则没有要求，需要 9x 决定。
3. **删除 neo4j 容器和数据卷。** 今晚只 stop，保留几天作为回退证据，9x 确认后再 `docker rm` 和 `docker volume rm`。
4. **轮换 Postgres 口令，以及 `src/test-template.ts` 里出现的 SNMP community `rwcommstr`。** 后者如果是真口令，需要在交换机上修改，属于生产网络变更，要先只读核对并经 9x 批准。今晚只把它从代码里删掉。
5. **升级 Express 5。** 收益只是原生支持 async 错误，用 asyncHandler 已经能覆盖，今晚升级属于额外风险。
6. **所有旧页面都改用 react-query。** 今晚旧页面只改 service 调用和类型，新功能线一律使用 hooks。全部迁移涉及 11 个以上页面，留到外壳线逐页接手时完成，避免同一页面两套写法并存太久。
7. **硬编码中文全部清零（约 706 行）。** 今晚 lint 规则直接设为 error。基础层改动到的文件当场清理；剩下的文件放进 `eslint-cjk-allowlist.json`，只允许减少不允许增加，由 i18n 这条子线持续清理。原因是工作量大，而且大部分页面会被外壳线重写。
8. **CabinetList（1783 行）全面拆分。** 今晚只做 API 和类型适配，以及删除死代码，拆分交给外壳线和 3D 线，因为这两条线本来就要重做这个页面。CableTopology 的数据层和 PanelView 替换今晚就做。
9. **CI workflow。** 本地的 typecheck、test 和 e2e 入口今晚就绪，GitHub Actions 需要起 services 容器，放到下次。
10. **openapi.json/yaml 和 Apifox 同步。** 接口全部换掉后这些文件已经过期，等 contracts 稳定后再从 zod 生成，今晚先在 README 中标注过期。
11. **把设备名中的柜号和 U 位剥离、重命名。** 属于数据层面，等 sysname 和 U 位都可信后由 9x 决定。
12. **Port.ifName 的启发式结果人工复核，以及 446stack 的 slot 接口名。** 迁移报告会列出来，交给 9x 复核。
13. **配线架前后口直通（PortLink）和多跳递归 CTE 拓扑。** 当前模型里不存在多跳，等真有需求时再按 `WITH RECURSIVE ... CYCLE` 实现。
14. **分支线缆（B1..Bn）。** `CableEnd` 先只保留 A 和 B，有真实需求时再扩展枚举。
