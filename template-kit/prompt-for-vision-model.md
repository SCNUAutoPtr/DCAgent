请根据设备前/后面板图片，输出一个可导入机房资产系统的面板模板 JSON。

## 输出要求

1. 只输出一个面板，尺寸单位用 mm，坐标原点在面板左上角
2. 依次输出：面板整体描述、端口表、最终 JSON
3. 最终 JSON 的外层固定为 `{"format":"dcagent.panel-template","version":1,"templates":[...]}`，`templates` 里只放这一个面板
4. 面板必须包含：`name` `type` `face` `deviceModel` `widthMm` `heightMm` `description` `ports`
5. 每个端口必须包含：`number` `sortIndex` `portType` `ifName` `xMm` `yMm` `wMm` `hMm` `rotation`
6. 图片里的 USB、VGA、Console、BMC、电源口也要单独列出
7. `portType` 只能从以下枚举中选最接近的，确实没有对应的用 `OTHER`（例如 VGA）：
   `RJ45` `SFP` `SFP_PLUS` `SFP28` `QSFP` `QSFP28` `QSFP_DD` `CONSOLE` `USB` `POWER` `OTHER`
8. `type` 只能取：`NETWORK` `POWER` `CONSOLE` `USB` `OTHER`
9. `face` 只能取：`FRONT` `REAR`
10. 不要输出多余分析，只输出要求内容

## 端口表格式

| number | portType | ifName | xMm | yMm | wMm | hMm |
|--------|----------|--------|-----|-----|-----|-----|
| ge1 | RJ45 | GigabitEthernet0/0/1 | 30 | 8 | 14 | 12 |
| ge2 | RJ45 | GigabitEthernet0/0/2 | 48 | 8 | 14 | 12 |

## JSON 格式

{
  "format": "dcagent.panel-template",
  "version": 1,
  "templates": [
    {
      "name": "厂商 型号 前面板",
      "type": "NETWORK",
      "face": "FRONT",
      "deviceModel": { "vendor": "厂商", "name": "型号", "deviceType": "SWITCH", "uHeight": 1 },
      "widthMm": 482.6,
      "heightMm": 44.45,
      "description": "面板描述",
      "ports": [
        {
          "number": "ge1",
          "sortIndex": 1,
          "portType": "RJ45",
          "ifName": "GigabitEthernet0/0/1",
          "xMm": 30,
          "yMm": 8,
          "wMm": 14,
          "hMm": 12,
          "rotation": 0
        }
      ]
    }
  ]
}

`deviceModel.deviceType` 只能取：`SERVER` `SWITCH` `ROUTER` `FIREWALL` `STORAGE` `PDU` `OTHER`。不知道型号时 `deviceModel` 写 `null`。

## 面板类型建议

- 交换机、服务器网口面板：`NETWORK`
- 服务器后面板（网口、电源、USB 混合）：`OTHER`
- 纯电源分配：`POWER`
- 串口控制：`CONSOLE`
- USB 面板：`USB`
- 无法判断时：`OTHER`
