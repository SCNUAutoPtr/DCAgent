# 3D 机房

按机房平面图的坐标，用 three.js 把机柜、机柜里的设备、机房里的线缆和工作站座位画成可以旋转缩放的 3D 场景。入口：侧栏 基础设施 / 3D 机房，或仪表板上的"3D 机房"卡片。

## 使用

- 地址：`/datacenter-3d/<机房 id>`，选中机柜时是 `/datacenter-3d/<机房 id>/<机柜 id>`，可以直接收藏或分享。不带机房时打开第一个机房。
- 鼠标：左键拖动旋转，右键拖动平移，滚轮缩放。点机柜，镜头飞到机柜正面，右侧抽屉列出柜内设备；点设备高亮它并高亮相关线缆。"重置视角"回到全景（选中机柜时先取消选中）。
- 着色：按设备类型；或按端口占用率（设备颜色是已连端口/总端口，机柜框是 U 位占用率）。
- 线缆开关：只画两端都插在本机房设备端口上的线，按介质着色，弧线越长拱得越高。连到其他机房的线只计数，显示在左上角统计里。
- 抽屉里每台设备显示 U 位范围和型号；没有 U 位的设备列为"未设置 U 位"；高度未知的设备显示"高度未知"，画成 1U。抽屉里可以跳到机柜视图、打开面板。
- 浏览器不支持 WebGL 时显示提示，并给出打开机房平面图的按钮。

## 数据来源

一次请求 `rooms/scene`（body `{ "roomId": "..." }`），返回 `RoomScene`（`backend/src/contracts/scene.ts`）：

- `room`：宽、深（米）。没填或放不下所有机柜时，按内容再加一圈边距扩大。
- `cabinets`：平面图坐标 `fpX/fpY`（左上角，米）、尺寸 `fpW/fpD`、朝向 `fpRotation`（0 表示正面朝 -y），高度 U 数，以及柜内设备（U 位、高度、型号深度、各面板端口数和已连数）。
- `devices`：不在机柜里、直接放在机房里的设备（只计数）。
- `workstations`：座位坐标和在线状态（在线 = 最近一次探测时看到过，见 `contracts/workstations.ts` 的 `isOnline`）。
- `links`：两端都在本机房的线缆；`externalLinkCount`：一端在本机房、另一端在别处的线缆数。

没有平面图坐标的机柜会被自动排成网格，统计里会提示"N 个机柜没有平面图坐标"；在机房页面的平面图编辑器里摆好后就按实际位置画。

## 坐标

机房坐标（米）：原点在机房左上角，x 向右，y 向里。3D 世界里机房 x 对应世界 x，机房 y 对应世界 z，向上是世界 y。U 高 44.45mm，机柜底座 0.06m。设备的深度取型号的 `depthMm`，没有时取机柜深度的 70%。纯计算都在 `frontend/src/pages/datacenter3d/layout.ts`（不依赖 three.js），由 `frontend/scripts/datacenter3d-layout.test.mts` 覆盖。

## 代码

| 文件 | 作用 |
|---|---|
| `frontend/src/pages/datacenter3d/Datacenter3DPage.tsx` | 页面：工具栏、统计、图例、机柜抽屉、WebGL 检测与降级 |
| `frontend/src/pages/datacenter3d/RoomScene3D.tsx` | three.js 场景（懒加载）：地面网格、机柜、设备、线缆、工作站、相机 |
| `frontend/src/pages/datacenter3d/layout.ts` | 布局和颜色计算 |
| `frontend/src/pages/datacenter3d/useUText.ts` | U 位文案（含高度未知） |
| `frontend/src/api/hooks/rooms.ts` | react-query：`useRoomList`、`useRoomScene` |
| `backend/src/services/hierarchyService.ts` | `roomScene`：一次查询拼出整个场景 |

依赖：`three`、`@react-three/fiber`、`@react-three/drei`，场景组件按需加载，不影响其他页面的首屏。

## 实现上的约定

- 手工创建的几何体（单位立方体、刻度线）在组件卸载时 `dispose`。
- 悬停设备时把鼠标指针改成手形；这个状态放在 effect 里并在清理函数中复原，设备在悬停中被卸载（切换机房、抽屉跳转、场景刷新）时指针也会恢复。
- 场景只读，不在 3D 里修改数据；编辑去机柜视图、面板编辑器或平面图编辑器。

## 已知限制

- 不在机柜里的设备不画，只计数。
- 只画单跳连接（两端都在本机房）；跨机房的线只计数。
- 机柜正面朝向只支持 0/90/180/270 度。
