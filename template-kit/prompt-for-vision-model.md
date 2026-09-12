请根据设备前/后面板图片，输出一个可用于机房资产系统的面板模板 JSON。

## 输出要求

1. 只输出一个面板模板
2. 尺寸单位使用 mm
3. 必须输出：
   - 面板整体描述
   - 端口表
   - 最终 JSON
4. 最终 JSON 必须包含：
   - `name`
   - `type`
   - `portCount`
   - `description`
   - `width`
   - `height`
   - `layoutConfig`
   - `portDefinitions`
5. 每个端口必须包含：
   - `number`
   - `label`
   - `portType`
   - `position` `{x, y}`
   - `size` `{width, height}`
6. 如果图片里有 USB / VGA / Console / BMC / 电源口，也要单独列出
7. 如果某个端口类型不完全确定，只能从以下枚举中选最接近的：
   - `RJ45`
   - `SFP`
   - `SFP_PLUS`
   - `QSFP`
   - `USB_A`
   - `USB_C`
   - `SERIAL`
   - `POWER_C13`
   - `POWER_C19`
8. 不要输出 markdown 代码解释，不要输出多余分析，只输出要求内容

## 端口表格式

| number | label | portType | x | y | width | height |
|--------|-------|----------|---|---|-------|--------|
| 1 | GE1 | RJ45 | 30 | 8 | 14 | 12 |
| 2 | GE2 | RJ45 | 48 | 8 | 14 | 12 |

## JSON 模板格式

{
  "name": "设备面板名称",
  "type": "NETWORK",
  "portCount": 24,
  "description": "面板描述",
  "width": 482.6,
  "height": 44.45,
  "layoutConfig": {
    "portsPerRow": 12,
    "rowSpacing": 20
  },
  "portDefinitions": [
    {
      "number": "1",
      "label": "GE1",
      "portType": "RJ45",
      "position": { "x": 30, "y": 8 },
      "size": { "width": 14, "height": 12 }
    }
  ]
}

## 面板类型建议

- 普通交换机前面板：`NETWORK`
- 普通服务器后面板：`MIXED`
- 纯电源分配：`POWER`
- 串口控制：`CONSOLE`
- USB 面板：`USB`
- 无法判断时：`OTHER`
