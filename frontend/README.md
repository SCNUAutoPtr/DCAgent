# DCAgent Frontend

数据中心线缆管理系统 - 前端应用

## 技术栈

- React 18
- TypeScript
- Vite
- Ant Design
- React Router
- React Flow (拓扑图可视化)
- Axios
- i18next (国际化：中/英/日)

## 项目结构

```
frontend/
├── src/
│   ├── components/      # React 组件库
│   │   ├── Layout/          # 布局组件（Header、Sidebar）
│   │   ├── PanelVisualizer.tsx          # 面板可视化编辑器
│   │   ├── CabinetVisualizer.tsx        # 机柜可视化展示
│   │   ├── PanelCanvasEditor.tsx        # 面板画布编辑器
│   │   ├── DevicePanelEditor.tsx        # 设备面板编辑
│   │   ├── CreateCableModal.tsx         # 线缆创建对话框
│   │   ├── ConnectSingleCableModal.tsx  # 单端连接对话框
│   │   ├── AddDeviceModal.tsx           # 设备创建对话框
│   │   ├── BulkImportModal.tsx          # 批量导入对话框
│   │   ├── SimplifiedTopology.tsx       # 简化拓扑图
│   │   ├── PortIcon.tsx                 # 端口图标组件
│   │   └── CabinetThumbnail.tsx         # 机柜缩略图
│   ├── pages/           # 页面路由（15个）
│   │   ├── Dashboard.tsx                  # 仪表板
│   │   ├── DataCenterList.tsx             # 数据中心列表
│   │   ├── RoomList.tsx                   # 机房列表
│   │   ├── CabinetList.tsx                # 机柜列表
│   │   ├── DeviceList.tsx                 # 设备列表
│   │   ├── PanelList.tsx                  # 面板列表
│   │   ├── PortDetailView.tsx             # 端口详情
│   │   ├── CableTopology.tsx              # 线缆拓扑图
│   │   ├── CableManualInventory.tsx       # 手动入库线缆
│   │   ├── ShortIdPoolManagement.tsx      # ShortID 管理
│   │   ├── BulkDeploymentPage.tsx         # 批量部署
│   │   ├── PanelTemplateManagementPage.tsx # 面板模板管理
│   │   ├── OpticalModuleList.tsx          # 光模块列表
│   │   └── OpticalModuleDetail.tsx        # 光模块详情
│   ├── services/        # API 服务封装
│   │   ├── api.ts
│   │   ├── dataCenterService.ts
│   │   ├── roomService.ts
│   │   ├── cabinetService.ts
│   │   ├── deviceService.ts
│   │   ├── panelService.ts
│   │   ├── portService.ts
│   │   ├── cableService.ts
│   │   ├── opticalModuleService.ts
│   │   ├── shortIdService.ts
│   │   └── ...
│   ├── types/           # TypeScript 类型定义
│   ├── utils/           # 工具函数
│   │   └── shortIdFormatter.ts  # ShortID 格式化工具
│   ├── locales/         # 国际化资源（中/英/日）
│   ├── App.tsx          # 主应用组件
│   ├── main.tsx         # 入口文件
│   └── index.css        # 全局样式
├── public/              # 静态资源
└── index.html           # HTML 模板
```

## 功能特性

### 已完成
- 仪表板概览（数据统计）
- 数据中心、机房、机柜、设备、面板管理
- 线缆拓扑图可视化（ReactFlow）
- 端口、线缆 CRUD 操作
- 面板可视化编辑和布局
- ShortID 管理和显示（E-00001 格式）
- 光模块库存和安装跟踪
- 面板模板快速创建
- 批量导入设备和面板
- 全局搜索（关键词、ShortID）
- 国际化支持（中文/English/日本語）

### 开发中/隐藏
- SNMP 监控页面（已隐藏）

## 安装

```bash
# 安装依赖
npm install

# 复制环境变量配置
cp .env.example .env
```

## 开发

```bash
# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产构建
npm run preview

# 代码检查
npm run lint
```

开发服务器将运行在 http://localhost:5173

## 环境变量

```env
VITE_API_BASE_URL=http://localhost:3000
```

本地开发、Docker 暴露到宿主机的前端，以及 E2E 浏览器环境都使用同一个变量名 `VITE_API_BASE_URL`。
`src/services/api.ts` 会在这个基址后追加 `/api/v1`，所以这里不要再写 `/api`。

## 页面路由（15个）

| 路由 | 页面 | 说明 |
|------|------|------|
| `/` | Dashboard | 仪表板 |
| `/datacenters` | DataCenterList | 数据中心列表 |
| `/rooms` | RoomList | 机房列表 |
| `/cabinets` | CabinetList | 机柜列表 |
| `/devices` | DeviceList | 设备列表 |
| `/panels` | PanelList | 面板列表和编辑 |
| `/port-detail` | PortDetailView | 端口详情和连接 |
| `/topology` | CableTopology | 线缆网络拓扑 |
| `/cable-manual-inventory` | CableManualInventory | 手动入库线缆 |
| `/shortid-pool` | ShortIdPoolManagement | ShortID 生成和管理 |
| `/bulk-deployment` | BulkDeploymentPage | 批量部署设备和面板 |
| `/panel-templates` | PanelTemplateManagementPage | 面板模板管理 |
| `/optical-modules` | OpticalModuleList | 光模块库存 |
| `/optical-modules/:id` | OpticalModuleDetail | 光模块详情 |

## 国际化支持

项目支持三种语言，通过 i18next 管理：

- 中文 (zh-CN)
- English (en-US)
- 日本語 (ja-JP)

在 `src/locales/` 目录中配置翻译资源

## ShortID 格式化

提供便捷的 ShortID 格式转换工具，格式为 `E-XXXXX`：

```typescript
import { formatShortId, parseShortId } from '@/utils/shortIdFormatter';

// 数字 -> 显示格式
const display = formatShortId(1);      // "E-00001"
const display2 = formatShortId(123456); // "E-123456"

// 显示格式 -> 数字
const numeric = parseShortId('E-00001');  // 1
const numeric2 = parseShortId('00001');   // 1（自动移除前缀）
```

## API 集成

所有 API 调用通过 `services/` 目录中的服务模块进行，统一调用后端 `/api/v1` 接口：

```typescript
import { deviceService } from '@/services/deviceService';

// 获取所有设备
const devices = await deviceService.getAll();

// 创建设备
const device = await deviceService.create(data);

// 按 ShortID 查询
const cabinet = await cabinetService.getByShortId(100);
```

## 组件开发

使用 Ant Design 组件库构建 UI，支持响应式布局：

```tsx
import { Button, Table, Card } from 'antd';
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t } = useTranslation();

  return (
    <Card title={t('common.title')}>
      <Table dataSource={data} columns={columns} />
    </Card>
  );
}
```

## 类型安全

项目使用 TypeScript 确保类型安全，所有数据模型定义在 `src/types/index.ts`：

```typescript
import { Device, Cable, Panel, Port } from '@/types';
```

## 详细文档

更多详细信息请参考 `docs/` 目录中的文档：
- [API.md](../docs/API.md) - API 完整文档
- [SHORTID.md](../docs/SHORTID.md) - ShortID 系统详解
- [CABLE_MANAGEMENT.md](../docs/CABLE_MANAGEMENT.md) - 线缆管理
- [OPTICAL_MODULE.md](../docs/OPTICAL_MODULE.md) - 光模块系统

## License

MIT
