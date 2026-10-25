# DCAgent API

接口按 `backend/src/routes/*.ts` 整理（2026-10-25 重构后）。请求 schema（zod）和返回 DTO 的类型都在 `backend/src/contracts/`，以代码为准。

## 约定

- 每个接口都是 `POST /api/v1/<资源>/<动作>`，`Content-Type: application/json`，参数全部放在 body 里。没有 query string、路径参数和 GET/PUT/DELETE。
- 读接口直接查询；写接口整个用例跑在一个数据库事务里（进入事务后立即 `SET CONSTRAINTS ALL IMMEDIATE`），出错整体回滚，不会留下半成品。
- 成功时返回 DTO（HTTP 200）。失败时统一返回：

```json
{ "code": "NOT_EMPTY", "message": "device still has panels, observation history or IP addresses", "details": { "panels": [{ "id": "...", "name": "front" }] } }
```

| code | HTTP | 含义 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | body 不符合 schema（details 是 zod issues），或业务校验失败 |
| `NOT_FOUND` | 404 | 记录不存在，或引用的记录不存在 |
| `UNIQUE_VIOLATION` | 409 | 唯一约束冲突，details.target 是字段 |
| `LABEL_NOT_AVAILABLE` | 409 | 标签号已绑定、作废或贴过 |
| `LABEL_REQUIRED` | 409 | 机柜、面板、线缆端子提交时没有标签 |
| `PORT_OCCUPIED` | 409 | 端口上已经插着线 |
| `PORT_HAS_DEPENDENTS` | 409 | 端口有线缆、光模块、IP 或工作站 |
| `NOT_EMPTY` | 409 | 容器下还有内容；或删除被数据库外键 RESTRICT 拦下 |
| `U_SPACE_CONFLICT` | 409 | U 位重叠（高度未知的设备按 1U 占位） |
| `U_OUT_OF_RANGE` | 400 | 设备超出机柜高度 |
| `IP_OUT_OF_SUBNET` | 400 | 地址不在子网内 |
| `IP_CONFLICT` | 409 | 地址或归属冲突 |
| `TEMPLATE_REVISION_MISMATCH` | 409 | 预览之后模板又被改过 |
| `TEMPLATE_CONFLICT` | 409 | 套用模板会和在用端口冲突 |
| `INVALID_STATE` | 409 | 当前状态不允许这个操作 |
| `INTERNAL` | 500 | 未知错误 |

带 `force` 的删除（设备、面板、端口、子网）：不带 force 时有内容就返回 409 和 details（列出挡住删除的东西）；前端确认后再带 `force: true` 重试。设备的强制删除会删除它的端口观测历史、解除管理 IP 绑定（地址记录保留）；端口上仍有线缆、光模块、IP 或工作站时照样拒绝。

## 例子

```bash
curl -s -X POST http://localhost:3000/api/v1/cabinets/get -H 'content-type: application/json' -d '{"id":"<uuid>"}'
curl -s -X POST http://localhost:3000/api/v1/labels/resolve -H 'content-type: application/json' -d '{"shortId":941271}'
```

## 接口列表

| 路径 | 读/写 | 请求 schema |
|---|---|---|
| `datacenters/list` | 读 | `dataCenterListSchema` |
| `datacenters/get` | 读 | `idBody` |
| `datacenters/create` | 写（单事务） | `dataCenterCreateSchema` |
| `datacenters/update` | 写（单事务） | `dataCenterUpdateSchema` |
| `datacenters/delete` | 写（单事务） | `idBody` |
| `rooms/list` | 读 | `roomListSchema` |
| `rooms/get` | 读 | `idBody` |
| `rooms/scene` | 读 | `roomSceneSchema` |
| `rooms/create` | 写（单事务） | `roomCreateSchema` |
| `rooms/update` | 写（单事务） | `roomUpdateSchema` |
| `rooms/delete` | 写（单事务） | `idBody` |
| `cabinets/list` | 读 | `cabinetListSchema` |
| `cabinets/get` | 读 | `idBody` |
| `cabinets/create` | 写（单事务） | `cabinetCreateSchema` |
| `cabinets/update` | 写（单事务） | `cabinetUpdateSchema` |
| `cabinets/delete` | 写（单事务） | `idBody` |
| `devices/list` | 读 | `deviceListSchema` |
| `devices/get` | 读 | `idBody` |
| `devices/create` | 写（单事务） | `deviceCreateSchema` |
| `devices/bulk-create` | 写（单事务） | `deviceBulkCreateSchema` |
| `devices/update` | 写（单事务） | `deviceUpdateSchema` |
| `devices/move` | 写（单事务） | `deviceMoveSchema` |
| `devices/delete` | 写（单事务） | `deviceDeleteSchema` |
| `device-models/list` | 读 | `deviceModelListSchema` |
| `device-models/get` | 读 | `idBody` |
| `device-models/create` | 写（单事务） | `deviceModelCreateSchema` |
| `device-models/update` | 写（单事务） | `deviceModelUpdateSchema` |
| `device-models/delete` | 写（单事务） | `idBody` |
| `panels/list` | 读 | `panelListSchema` |
| `panels/get` | 读 | `idBody` |
| `panels/create` | 写（单事务） | `panelCreateSchema` |
| `panels/update` | 写（单事务） | `panelUpdateSchema` |
| `panels/delete` | 写（单事务） | `panelDeleteSchema` |
| `ports/list` | 读 | `portListSchema` |
| `ports/get` | 读 | `idBody` |
| `ports/create` | 写（单事务） | `portCreateSchema` |
| `ports/create-bulk` | 写（单事务） | `portCreateBulkSchema` |
| `ports/update` | 写（单事务） | `portUpdateSchema` |
| `ports/set-admin-state` | 写（单事务） | `portSetAdminStateSchema` |
| `ports/delete` | 写（单事务） | `portDeleteSchema` |
| `cables/list` | 读 | `cableListSchema` |
| `cables/get` | 读 | `idBody` |
| `cables/panel-connections` | 读 | `panelConnectionsSchema` |
| `cables/dangling-by-device` | 读 | `danglingByDeviceSchema` |
| `cables/create` | 写（单事务） | `cableCreateSchema` |
| `cables/update` | 写（单事务） | `cableUpdateSchema` |
| `cables/connect-end` | 写（单事务） | `cableConnectEndSchema` |
| `cables/disconnect-end` | 写（单事务） | `cableDisconnectEndSchema` |
| `cables/delete` | 写（单事务） | `cableDeleteSchema` |
| `labels/list` | 读 | `labelListSchema` |
| `labels/stats` | 读 | `emptyBody` |
| `labels/resolve` | 读 | `labelResolveSchema` |
| `labels/missing` | 读 | `labelMissingSchema` |
| `labels/generate` | 写（单事务） | `labelGenerateSchema` |
| `labels/void` | 写（单事务） | `labelVoidSchema` |
| `labels/rebind` | 写（单事务） | `labelRebindSchema` |
| `labels/print-tasks/list` | 读 | `printTaskListSchema` |
| `labels/print-tasks/create` | 写（单事务） | `printTaskCreateSchema` |
| `labels/print-tasks/complete` | 写（单事务） | `printTaskCompleteSchema` |
| `optical-modules/list` | 读 | `moduleListSchema` |
| `optical-modules/get` | 读 | `idBody` |
| `optical-modules/by-serial` | 读 | `moduleBySerialSchema` |
| `optical-modules/statistics` | 读 | `emptyBody` |
| `optical-modules/history` | 读 | `idBody` |
| `optical-modules/create` | 写（单事务） | `moduleCreateSchema` |
| `optical-modules/update` | 写（单事务） | `moduleUpdateSchema` |
| `optical-modules/install` | 写（单事务） | `moduleInstallSchema` |
| `optical-modules/uninstall` | 写（单事务） | `moduleUninstallSchema` |
| `optical-modules/transfer` | 写（单事务） | `moduleTransferSchema` |
| `optical-modules/scrap` | 写（单事务） | `moduleScrapSchema` |
| `optical-modules/delete` | 写（单事务） | `idBody` |
| `subnets/list` | 读 | `subnetListSchema` |
| `subnets/get` | 读 | `idBody` |
| `subnets/calculate` | 读 | `subnetCalculateSchema` |
| `subnets/statistics` | 读 | `emptyBody` |
| `subnets/create` | 写（单事务） | `subnetCreateSchema` |
| `subnets/update` | 写（单事务） | `subnetUpdateSchema` |
| `subnets/delete` | 写（单事务） | `subnetDeleteSchema` |
| `ip-addresses/list` | 读 | `ipListSchema` |
| `ip-addresses/get` | 读 | `idBody` |
| `ip-addresses/get-by-address` | 读 | `ipGetByAddressSchema` |
| `ip-addresses/next-available` | 读 | `ipNextAvailableSchema` |
| `ip-addresses/check-conflicts` | 读 | `ipCheckConflictsSchema` |
| `ip-addresses/allocate` | 写（单事务） | `ipAllocateSchema` |
| `ip-addresses/batch-allocate` | 写（单事务） | `ipBatchAllocateSchema` |
| `ip-addresses/update` | 写（单事务） | `ipUpdateSchema` |
| `ip-addresses/release` | 写（单事务） | `idBody` |
| `ip-addresses/delete` | 写（单事务） | `idBody` |
| `workstations/list` | 读 | `workstationListSchema` |
| `workstations/get` | 读 | `idBody` |
| `workstations/by-code` | 读 | `workstationByCodeSchema` |
| `workstations/create` | 写（单事务） | `workstationCreateSchema` |
| `workstations/update` | 写（单事务） | `workstationUpdateSchema` |
| `workstations/set-admin-state` | 写（单事务） | `workstationSetAdminStateSchema` |
| `workstations/delete` | 写（单事务） | `idBody` |
| `observability/flows/ingest` | 读 | `flowsIngestSchema` |
| `observability/flows/top` | 读 | `flowsTopSchema` |
| `observability/flows/status` | 读 | `emptyBody` |
| `observability/switches/snapshot` | 写（单事务） | `switchSnapshotSchema` |
| `observability/switches/list` | 读 | `emptyBody` |
| `observability/switches/history` | 读 | `switchHistorySchema` |
| `observability/workstations/sync-power` | 写（单事务） | `syncPowerSchema` |
| `observability/workstations/sync-ports` | 写（单事务） | `syncPortsSchema` |
| `observability/workstations/seat-map` | 读 | `seatMapSchema` |
| `observability/unmatched/list` | 读 | `unmatchedListSchema` |
| `observability/unmatched/resolve` | 写（单事务） | `unmatchedResolveSchema` |
| `panel-templates/list` | 读 | `templateListSchema` |
| `panel-templates/get` | 读 | `idBody` |
| `panel-templates/generate-preview` | 读 | `generatePreviewSchema` |
| `panel-templates/apply-preview` | 读 | `applyPreviewSchema` |
| `panel-templates/batch-preview` | 读 | `batchPreviewSchema` |
| `panel-templates/export` | 读 | `exportSchema` |
| `panel-templates/create` | 写（单事务） | `templateCreateSchema` |
| `panel-templates/update` | 写（单事务） | `templateUpdateSchema` |
| `panel-templates/delete` | 写（单事务） | `idBody` |
| `panel-templates/apply` | 写（单事务） | `applySchema` |
| `panel-templates/batch-apply` | 写（单事务） | `batchApplySchema` |
| `panel-templates/create-panel` | 写（单事务） | `createPanelFromTemplateSchema` |
| `panel-templates/create-panels` | 写（单事务） | `createPanelsFromTemplatesSchema` |
| `panel-templates/unbind` | 写（单事务） | `unbindSchema` |
| `panel-templates/import` | 写（单事务） | `importSchema` |
| `panel-templates/import-presets` | 写（单事务） | `importPresetsSchema` |
| `search/global` | 读 | `globalSearchSchema` |
| `dashboard/overview` | 读 | `emptyBody` |
