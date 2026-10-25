# 面板模板

面板模板描述一块面板上有哪些端口、端口叫什么、在面板上的位置。模板可以关联设备型号：新建这个型号的设备时直接按模板生成面板，或者把模板批量套用到已有的同型号设备上。

代码位置：

| 部分 | 位置 |
|---|---|
| 生成器（纯函数，前后端共用） | `backend/src/contracts/panelGenerator.ts` |
| schema、DTO、导入文件格式 | `backend/src/contracts/panelTemplates.ts` |
| 业务逻辑（创建、套用、批量、导入导出） | `backend/src/services/panelTemplateService.ts` |
| 接口 | `panel-templates/*`（见 `docs/API.md`） |
| 页面 | 工具 / 面板模板（`/panel-templates`），`frontend/src/pages/PanelTemplateManagementPage.tsx`、`frontend/src/components/panelTemplate/` |
| 系统预设和资料包 | `template-kit/`（`examples/` 就是系统预设，文件格式见 `template-kit/README.md`） |
| 测试 | `backend/src/contracts/panelGenerator.test.ts`、`backend/test/panelTemplates.int.test.ts`、`backend/test/fixes.int.test.ts` |

## 两种定义方式

**参数化生成（推荐）**：模板保存一个 `generator`，端口由生成器算出来。一个生成器由若干组组成，每组是一串同类型端口：

```json
{
  "version": 1,
  "groups": [
    { "portType": "RJ45", "count": 48, "rows": 2, "order": "COLUMN_MAJOR", "numberPrefix": "ge", "ifNamePattern": "GigabitEthernet0/0/{n}" },
    { "portType": "SFP_PLUS", "count": 4, "numberPrefix": "xge", "ifNamePattern": "XGigabitEthernet0/0/{n}", "gapMm": 10 }
  ],
  "overrides": [{ "number": "ge1", "xMm": 30, "yMm": 6 }]
}
```

- 编号：`numberPrefix` + 序号（`startIndex` 起，步长 `indexStep`），或者用 `names` 逐个命名（`PSU1`、`BMC`、`VGA`）。
- 接口名：`ifNamePattern` 里的 `{n}` 换成序号，用于和交换机采集数据对上。
- 排布：`rows` 行，`ROW_MAJOR` 按行排，`COLUMN_MAJOR` 按列排（两行时就是交换机常见的"奇上偶下"）。
- 位置：不写 `xMm` 时接在上一组右边（间距 `gapMm`，默认 8mm），不写 `yMm` 时在面板高度内垂直居中；口距默认是端口尺寸加 2mm，端口尺寸按类型取 `PORT_SIZE_MM`。
- `overrides`：编辑器里拖动微调过的端口坐标。
- 编号重复、接口名重复、`names` 数量不对、`overrides` 指向不存在的编号时，生成器报 `VALIDATION_ERROR`，`details.issues` 列出每一处。

**逐口布局**：直接保存每个端口的编号、类型、接口名、坐标和尺寸。保存后模板不再带生成器参数。

页面上新建模板时可以"从预设开始"，左边改参数，右边画布实时预览（前端直接调用同一个 `generatePorts`），预览接口是 `panel-templates/generate-preview`，不落库。

## 版本

模板有 `revision`。端口真正变化时才加 1（只改说明不升版本）。套用过的面板记着套用时的 `templateRevision`，模板升版本后面板上会提示可以重新套用。

## 套用到面板

先 `panel-templates/apply-preview` 看差异，再 `panel-templates/apply`（带上预览时的 `expectedRevision`，期间模板被改过就返回 `TEMPLATE_REVISION_MISMATCH`）。端口按编号匹配：

| 情况 | 处理 |
|---|---|
| 模板有、面板没有 | 新建端口 |
| 两边都有 | 更新类型、排序、接口名、坐标、尺寸、旋转。状态、标签、备注、连接一律不动 |
| 面板有、模板没有 | 能删才删：端口在用（线缆、光模块、IP、工作站、采集记录），或者人工填过东西（状态是预留/故障、有标签、有备注），都保留下来，排到模板端口后面，并在差异里写明原因 |

冲突时整体拒绝（`TEMPLATE_CONFLICT`），什么都不写：

- 一个保留下来的端口占着模板需要的接口名；
- 一个匹配上的端口装着光模块，而新的端口类型装不下这个模块。

光模块的移动记录（`ModuleMovement`）在写入时就保存了"设备 面板 端口"的文字路径，端口以后被删或改名，历史里仍然看得到模块当时在哪里。

## 批量套用

模板关联了设备型号时，`panel-templates/batch-preview` 列出这个型号的所有设备，以及每台要套用到哪块面板（已经绑定这个模板的面板 > 同朝向的唯一面板 > 同名面板），没有合适面板的设备会新建一块。`panel-templates/batch-apply` 在一个事务里执行，任何一台有冲突就全部不做。

## 新建设备时生成面板

新建设备的表单里，如果所选型号关联了模板，会列出来供勾选；保存时调用 `panel-templates/create-panels`，每个模板生成一块面板，并自动分配面板标签。

## 解绑、删除

- `panel-templates/unbind`：面板和模板脱钩，之后可以自由改端口，不再收到升版本提示。
- 删除模板：已套用的面板和端口原样保留，只解除关联。

## 导入导出和系统预设

- 文件格式 `{"format":"dcagent.panel-template","version":1,"templates":[...]}`，字段说明见 `template-kit/README.md`。
- `panel-templates/export` 导出：生成器模板同时写出生成器和生成好的端口，方便没有生成器的读者。
- `panel-templates/import`：`create` 模式遇到同名模板报错；`upsert` 模式按名字更新，内容相同的不动、不升版本。模板里的 `deviceModel` 按 厂商+名称 复用或新建型号（型号高度可以不写，表示未知）。
- 系统预设：页面上"导入系统预设"或后端 `npm run templates:presets`，把 `template-kit/examples/*.json` 全部导入，幂等。2026-10-25 重建真实库后导入了 7 个预设，它们是迁移之后新增的数据，不属于旧库对账范围。

## 注意

- 迁移脚本 `--target=prod --apply` 会整表重建，导入的模板也算"迁移之后的新数据"，脚本会因此拒绝执行，见 `GETTING_STARTED.md`。
