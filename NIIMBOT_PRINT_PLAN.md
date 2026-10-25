# niimbot B3S 标签打印 — Web Bluetooth 集成方案
> rc430 cyberdeck 的 DCAgent frontend 直连 B3S 打 shortid 标签，机房资产盘点闭环。

## 可行性（已验证 2026-09-12 遥控器实测）
- Bromite (Chromium 108, Android 7.1.2) `navigator.bluetooth` **支持 ✓**
- Web Bluetooth 走 Android 封装的 BLE，**绕开原生蓝牙栈冲突**（bleak/bluez 在 termux/proot 连不上的根因）
- 前提：页面 https(或 localhost/file) + 蓝牙开 + 定位权限 + 用户手势触发 requestDevice

## 协议（来自 niimbot-b3s 逆向）
- service `e7810a71-…`, characteristic `bef8d6c9-…`（write + notify）
- 帧: `55 55 | cmd | len | data | xor(cmd,len,data) | AA AA`
- 打印流程: sound(58..) → label type(23) → density(21) → print start(01<copies u16>) → status(a3) → page start(03) → page size(13<rows u16><cols u16><copies u16>) → bitmap rows(85 idx c0 c1 c2 + cols/8 字节, 1=黑 MSB first) / empty rows(84 idx)
- 图像宽 = 标签宽 px（203dpi ≈ 8px/mm, ≤576）

## DCAgent 集成 TODO
- frontend `webbluetooth-niimbot.ts`: requestDevice(optionalServices:[e7810a71]) → getPrimaryService → getCharacteristic(bef8d6c9) → writeValueWithoutResponse(帧序列)
- 复用现有 print_task + shortIdPool: shortid → canvas 渲染标签 → 打包 bitmap 帧 → BLE 发
- UI: 资产/线缆/面板详情页加「打印标签」按钮；扫码入库后可直接打
- 闭环: 扫码枪(遥控器 USB-HID event4)扫资产 → DCAgent 查/入库 → Web Bluetooth 打 shortid 标签贴上

## 参考
- 协议/流程细节: ~/code/niimbot-b3s (README + docs/official_session_hci.txt + niimbot/ble.py)
