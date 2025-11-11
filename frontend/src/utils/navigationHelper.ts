import { NavigateFunction } from 'react-router-dom';
import { SearchResult } from '../services/searchService';

/**
 * 根据搜索结果类型和数据智能跳转到对应页面
 */
export function navigateToEntity(
  result: SearchResult,
  navigate: NavigateFunction,
  options?: {
    openInNewTab?: boolean;
  }
) {
  const { type, id, metadata } = result;
  let path = '/';
  let state: any = {};

  switch (type) {
    case 'DataCenter':
      path = '/datacenters';
      state = { selectedId: id };
      break;

    case 'Room':
      path = '/rooms';
      state = { selectedId: id };
      break;

    case 'Cabinet':
      // 跳转到机柜列表页的可视化tab
      path = '/cabinets';
      state = {
        selectedId: id,
        activeTab: 'visual', // 直接跳转到可视化tab
      };
      break;

    case 'Device':
      // 跳转到设备所在机柜的可视化视图，并定位到该设备的U位
      if (metadata?.cabinetId) {
        path = '/cabinets';
        state = {
          activeTab: 'visual',
          selectedCabinetId: metadata.cabinetId,
          selectedDeviceId: id,
          showDevicePanels: true, // 显示设备的面板视图
        };
      } else {
        // 如果没有机柜信息，降级到设备列表页（仅用于直接访问URL）
        path = '/devices';
        state = { selectedId: id };
      }
      break;

    case 'Panel':
      // 跳转到拓扑图页面，使用 URL 参数加载该面板的网络拓扑
      // 优先使用 shortId（如果有），否则使用 panelId
      if (metadata?.shortId) {
        path = `/cable-topology?shortId=${metadata.shortId}`;
      } else {
        path = `/cable-topology?panelId=${id}`;
      }
      // 使用 URL 参数不需要 state
      state = {};
      break;

    case 'Port':
      // 端口搜索：跳转到端口详情页，显示双面板视图（本端和对端）
      path = '/port-detail';
      state = {
        portId: id,
        panelId: metadata?.panelId,
      };
      break;

    case 'Cable':
      // 线缆搜索：跳转到端口详情页，显示两端连接
      path = '/port-detail';
      state = {
        cableId: id,
      };
      break;

    default:
      console.warn('Unknown entity type:', type);
      return null;
  }

  if (options?.openInNewTab) {
    window.open(`${window.location.origin}${path}`, '_blank');
  } else {
    navigate(path, { state });
  }

  return path;
}

/**
 * 处理线缆扫码跳转
 * 扫描线缆插头后，跳转到拓扑图并高亮显示该线缆
 * @param endpoints 线缆端点信息（包含 portA 和 portB）
 * @param navigate 导航函数
 * @param preferredEnd 扫描的端点类型（'A' 或 'B'），如果提供则聚焦到对应端点
 */
export function navigateToCableEndpoint(
  endpoints: any,
  navigate: NavigateFunction,
  preferredEnd?: 'A' | 'B'
) {
  if (!endpoints) {
    return null;
  }

  // 根据 preferredEnd 参数选择聚焦的端点
  // 如果扫描的是端点A，就聚焦到端点A连接的面板
  // 如果扫描的是端点B，就聚焦到端点B连接的面板
  const targetPort = preferredEnd === 'B'
    ? endpoints.portB || endpoints.portA
    : preferredEnd === 'A'
      ? endpoints.portA || endpoints.portB
      : endpoints.portA || endpoints.portB; // 默认优先A端

  if (!targetPort) {
    console.warn('No valid port endpoint found for cable');
    return null;
  }

  const panelId = targetPort.panel?.id;
  if (!panelId) {
    console.warn('No panel information found for port');
    return null;
  }

  // 使用 URL 参数跳转到线缆拓扑图页面
  // 优先使用 shortId 参数（更简洁且支持自动识别）
  const endpointA = endpoints.endpointA;
  const endpointB = endpoints.endpointB;

  // 根据 preferredEnd 选择要传递的 shortId
  let shortId: number | null = null;
  if (preferredEnd === 'A' && endpointA?.shortId) {
    shortId = endpointA.shortId;
  } else if (preferredEnd === 'B' && endpointB?.shortId) {
    shortId = endpointB.shortId;
  } else if (endpointA?.shortId) {
    // 默认使用 A 端
    shortId = endpointA.shortId;
  } else if (endpointB?.shortId) {
    // A 端没有则使用 B 端
    shortId = endpointB.shortId;
  }

  // 构建 URL 参数
  const searchParams = new URLSearchParams();

  if (shortId !== null) {
    // 优先使用 shortId 参数（自动查询和定位）
    searchParams.set('shortId', shortId.toString());
  } else {
    // 降级到 panelId + cableId 参数
    searchParams.set('panelId', panelId);
    if (endpoints.cable?.id) {
      searchParams.set('cableId', endpoints.cable.id);
    }
  }

  // 使用 URL 参数跳转
  navigate(`/cable-topology?${searchParams.toString()}`);

  return targetPort;
}

/**
 * 格式化搜索结果显示文本
 */
export function formatSearchResultLabel(result: SearchResult): string {
  const { type, name, label, description, shortId } = result;

  const displayName = name || label || `${type} #${shortId}`;
  const typeLabel = getEntityTypeLabel(type);

  if (description) {
    return `[${typeLabel}] ${displayName} - ${description}`;
  }

  return `[${typeLabel}] ${displayName}`;
}

/**
 * 获取实体类型的中文标签
 */
export function getEntityTypeLabel(type: SearchResult['type']): string {
  const labels: Record<SearchResult['type'], string> = {
    DataCenter: '数据中心',
    Room: '机房',
    Cabinet: '机柜',
    Device: '设备',
    Panel: '面板',
    Port: '端口',
    Cable: '线缆',
  };

  return labels[type] || type;
}

/**
 * 构建搜索结果的唯一key
 */
export function getSearchResultKey(result: SearchResult): string {
  return `${result.type}-${result.id}`;
}
