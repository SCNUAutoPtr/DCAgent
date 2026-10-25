import { lazy, type ReactNode } from 'react';
import {
  ApartmentOutlined,
  CodeSandboxOutlined,
  CloudUploadOutlined,
  DashboardOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  FileTextOutlined,
  GlobalOutlined,
  HomeOutlined,
  InboxOutlined,
  RadarChartOutlined,
  ScanOutlined,
  TagsOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import type { PathNode } from '@contracts/common';
import type { PathKind } from '@contracts/enums';
import type { SearchKind } from '@contracts/search';
import type menu from './locales/zh-CN/menu.json';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DataCenterList = lazy(() => import('./pages/DataCenterList'));
const RoomList = lazy(() => import('./pages/RoomList'));
const CabinetList = lazy(() => import('./pages/CabinetList'));
const DeviceList = lazy(() => import('./pages/DeviceList'));
const PanelList = lazy(() => import('./pages/PanelList'));
const CableTopology = lazy(() => import('./pages/CableTopology'));
const CableManualInventory = lazy(() => import('./pages/CableManualInventory'));
const CableScrap = lazy(() => import('./pages/CableScrap'));
const LabelManagement = lazy(() => import('./pages/LabelManagement'));
const PortDetailView = lazy(() => import('./pages/PortDetailView'));
const BulkDeploymentPage = lazy(() => import('./pages/BulkDeploymentPage'));
const PanelTemplateManagementPage = lazy(() => import('./pages/PanelTemplateManagementPage'));
const OpticalModuleList = lazy(() => import('./pages/OpticalModuleList'));
const OpticalModuleDetail = lazy(() => import('./pages/OpticalModuleDetail'));
const IpManagement = lazy(() => import('./pages/IpManagement'));
const SubnetDetail = lazy(() => import('./pages/SubnetDetail'));
const ObservabilityPage = lazy(() => import('./pages/ObservabilityPage'));
const Datacenter3DPage = lazy(() => import('./pages/datacenter3d/Datacenter3DPage'));

/** Path builders: shareable locations live in path segments only (no query strings, no location.state). */
export const paths = {
  dashboard: () => '/',
  dataCenters: () => '/datacenters',
  rooms: () => '/rooms',
  room: (id: string) => `/rooms/${id}`,
  cabinets: () => '/cabinets',
  cabinet: (id: string) => `/cabinets/${id}`,
  devices: () => '/devices',
  panels: () => '/panels',
  port: (id: string) => `/ports/${id}`,
  cable: (id: string) => `/cables/${id}`,
  topology: () => '/topology',
  topologyPanel: (id: string) => `/topology/panel/${id}`,
  cableInventory: () => '/cable-manual-inventory',
  cableScrap: () => '/cable-scrap',
  labels: () => '/labels',
  bulkDeployment: () => '/bulk-deployment',
  panelTemplates: () => '/panel-templates',
  opticalModules: () => '/optical-modules',
  opticalModule: (id: string) => `/optical-modules/${id}`,
  ipManagement: () => '/ip-management',
  subnet: (id: string) => `/ip-management/subnet/${id}`,
  observability: () => '/observability',
  datacenter3d: (roomId?: string, cabinetId?: string) =>
    roomId ? `/datacenter-3d/${roomId}${cabinetId ? `/${cabinetId}` : ''}` : '/datacenter-3d',
};

export type MenuGroup = 'infrastructure' | 'connectivity' | 'labels' | 'network' | 'tools';
type MenuKey = keyof typeof menu;

export interface AppRoute {
  path: string;
  element: ReactNode;
  /** routes with a labelKey appear in the menu; labelKey is a key of the menu namespace */
  labelKey?: MenuKey;
  menuGroup?: MenuGroup;
  icon?: ReactNode;
}

export const MENU_GROUPS: { key: MenuGroup; labelKey: MenuKey; icon: ReactNode }[] = [
  { key: 'infrastructure', labelKey: 'infrastructure', icon: <DatabaseOutlined /> },
  { key: 'connectivity', labelKey: 'connectionManagement', icon: <ApartmentOutlined /> },
  { key: 'labels', labelKey: 'labelGroup', icon: <TagsOutlined /> },
  { key: 'network', labelKey: 'network', icon: <GlobalOutlined /> },
  { key: 'tools', labelKey: 'tools', icon: <ToolOutlined /> },
];

export const ROUTES: AppRoute[] = [
  { path: '/', element: <Dashboard />, labelKey: 'dashboard', icon: <DashboardOutlined /> },
  { path: '/datacenters', element: <DataCenterList />, labelKey: 'dataCenter', menuGroup: 'infrastructure', icon: <DatabaseOutlined /> },
  { path: '/rooms', element: <RoomList />, labelKey: 'room', menuGroup: 'infrastructure', icon: <HomeOutlined /> },
  { path: '/rooms/:id', element: <RoomList /> },
  { path: '/cabinets', element: <CabinetList />, labelKey: 'cabinet', menuGroup: 'infrastructure', icon: <InboxOutlined /> },
  { path: '/cabinets/:id', element: <CabinetList /> },
  { path: '/datacenter-3d', element: <Datacenter3DPage />, labelKey: 'datacenter3d', menuGroup: 'infrastructure', icon: <CodeSandboxOutlined /> },
  { path: '/datacenter-3d/:roomId', element: <Datacenter3DPage /> },
  { path: '/datacenter-3d/:roomId/:cabinetId', element: <Datacenter3DPage /> },
  // devices and panels are managed from the cabinet view; their pages stay reachable but are not in the menu
  { path: '/devices', element: <DeviceList /> },
  { path: '/panels', element: <PanelList /> },
  { path: '/topology', element: <CableTopology />, labelKey: 'cableTopology', menuGroup: 'connectivity', icon: <ApartmentOutlined /> },
  { path: '/topology/panel/:id', element: <CableTopology /> },
  { path: '/ports/:id', element: <PortDetailView /> },
  { path: '/cables/:id', element: <PortDetailView /> },
  { path: '/cable-manual-inventory', element: <CableManualInventory />, labelKey: 'cableManualInventory', menuGroup: 'connectivity', icon: <ScanOutlined /> },
  { path: '/cable-scrap', element: <CableScrap />, labelKey: 'cableScrap', menuGroup: 'connectivity', icon: <DeleteOutlined /> },
  { path: '/optical-modules', element: <OpticalModuleList />, labelKey: 'opticalModule', menuGroup: 'connectivity', icon: <ToolOutlined /> },
  { path: '/optical-modules/:id', element: <OpticalModuleDetail /> },
  { path: '/labels', element: <LabelManagement />, labelKey: 'labels', menuGroup: 'labels', icon: <TagsOutlined /> },
  { path: '/ip-management', element: <IpManagement />, labelKey: 'ipManagement', menuGroup: 'network', icon: <GlobalOutlined /> },
  { path: '/ip-management/subnet/:id', element: <SubnetDetail /> },
  { path: '/observability', element: <ObservabilityPage />, labelKey: 'observability', menuGroup: 'network', icon: <RadarChartOutlined /> },
  { path: '/bulk-deployment', element: <BulkDeploymentPage />, labelKey: 'bulkDeployment', menuGroup: 'tools', icon: <CloudUploadOutlined /> },
  { path: '/panel-templates', element: <PanelTemplateManagementPage />, labelKey: 'panelTemplate', menuGroup: 'tools', icon: <FileTextOutlined /> },
];

const MENU_PATHS = ROUTES.filter((r) => r.labelKey).map((r) => r.path);

/** Menu entry for a location: the longest menu path that prefixes it ('/' only matches itself). */
export function activeMenuPath(pathname: string): string | null {
  let best: string | null = null;
  for (const p of MENU_PATHS) {
    const hit = p === '/' ? pathname === '/' : pathname === p || pathname.startsWith(`${p}/`);
    if (hit && (!best || p.length > best.length)) best = p;
  }
  return best;
}

export function menuGroupOf(path: string | null): MenuGroup | null {
  return ROUTES.find((r) => r.path === path)?.menuGroup ?? null;
}

const nodeOf = (path: PathNode[], kind: PathKind) => path.find((n) => n.kind === kind) ?? null;

/** Where to go for an entity found by search or label scan. */
export function pathForEntity(kind: SearchKind | PathKind, id: string, path: PathNode[]): string {
  switch (kind) {
    case 'DATACENTER':
      return paths.dataCenters();
    case 'ROOM':
      return paths.room(id);
    case 'CABINET':
      return paths.cabinet(id);
    case 'DEVICE': {
      const cab = nodeOf(path, 'CABINET');
      return cab ? paths.cabinet(cab.id) : paths.devices();
    }
    case 'PANEL':
      return paths.topologyPanel(id);
    case 'PORT':
      return paths.port(id);
    case 'CABLE':
      return paths.cable(id);
    case 'CABLE_ENDPOINT': {
      const cable = nodeOf(path, 'CABLE');
      return cable ? paths.cable(cable.id) : paths.topology();
    }
    case 'WORKSTATION': {
      const room = nodeOf(path, 'ROOM');
      return room ? paths.room(room.id) : paths.rooms();
    }
    case 'IP_ADDRESS':
      return paths.ipManagement();
    default:
      return paths.dashboard();
  }
}
