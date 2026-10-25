# 面板模板资料包

这个目录给视觉模型和人工整理面板模板用。

## 文件说明

- `prompt-for-vision-model.md`：给视觉模型的标准提示词
- `known-models.md`：已导入设备里已知型号清单
- `unknown-models-to-collect.md`：还需要补型号/面板照片的设备清单
- `examples/`：可直接导入的模板文件，同时也是系统预设

## 建议工作流

1. 先看 `unknown-models-to-collect.md`
2. 收集设备正反面照片、型号铭牌、端口特写
3. 把图片和 `prompt-for-vision-model.md` 一起喂给视觉模型
4. 视觉模型按 `examples/` 的结构输出 JSON
5. 在「面板模板」页点「导入 JSON」导入；几何不准的在编辑器里拖动微调

`examples/` 里的文件就是系统预设：页面上「导入系统预设」或后端 `npm run templates:presets` 会把它们全部导入。导入是幂等的，内容相同不会重复插入，也不会升版本。

## 文件格式

```json
{
  "format": "dcagent.panel-template",
  "version": 1,
  "templates": [ { ...模板... } ]
}
```

每个模板：

| 字段 | 说明 |
|------|------|
| `name` | 模板名，库内唯一 |
| `type` | 面板类型：`NETWORK` `POWER` `CONSOLE` `USB` `OTHER` |
| `face` | `FRONT` 或 `REAR` |
| `deviceModel` | 关联型号 `{vendor,name,deviceType,uHeight?,depthMm?}`，不关联写 `null`；导入时按 vendor+name 复用或新建 |
| `widthMm` `heightMm` | 面板尺寸（mm），19 寸 1U 为 482.6 x 44.45 |
| `description` | 说明，可为 `null` |
| `generator` | 参数化生成器（推荐），见下 |
| `ports` | 逐口坐标，没有生成器时必填 |

`generator` 和 `ports` 至少给一个；两者都有时以 `generator` 为准，`ports` 会被忽略（导出文件里两者都会写出，方便没有生成器的读者）。

### 生成器 `generator`

```json
{
  "version": 1,
  "groups": [
    { "portType": "RJ45", "count": 48, "rows": 2, "order": "COLUMN_MAJOR", "numberPrefix": "ge", "ifNamePattern": "GigabitEthernet0/0/{n}" },
    { "portType": "SFP_PLUS", "count": 4, "numberPrefix": "xge", "gapMm": 10 }
  ],
  "overrides": [ { "number": "ge1", "xMm": 30, "yMm": 6 } ]
}
```

每组的可选参数：`numberPrefix` `startIndex` `indexStep`（编号规则），`names`（逐个命名，如 PSU1、BMC），`ifNamePattern`（`{n}` 换成序号），`rows` `order`（`ROW_MAJOR` 按行；`COLUMN_MAJOR` 配合 2 行就是奇上偶下），`xMm` `yMm` `gapMm` `pitchXMm` `pitchYMm` `wMm` `hMm` `rotation`。不填的由生成器补默认值：分组接在上一组后面，不填 `yMm` 时垂直居中。`overrides` 记录编辑器里拖动微调过的端口位置。具体取值范围以 `backend/src/contracts/panelTemplates.ts` 为准。

### 逐口 `ports`

每个端口：`number`（编号，面板内唯一）、`sortIndex`、`portType`、`ifName`（可为 `null`）、`xMm` `yMm`（左上角）、`wMm` `hMm`、`rotation`（0/90/180/270）。

### 端口类型 `portType`

只能取：`RJ45` `SFP` `SFP_PLUS` `SFP28` `QSFP` `QSFP28` `QSFP_DD` `CONSOLE` `USB` `POWER` `OTHER`。VGA 等不在列表里的接口用 `OTHER`。
