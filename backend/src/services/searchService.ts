import dataCenterService from './dataCenterService';
import roomService from './roomService';
import cabinetService from './cabinetService';
import deviceService from './deviceService';
import cableService from './cableService';
import panelService from './panelService';
import portService from './portService';
import globalShortIdService from './globalShortIdService';
import prisma from '../utils/prisma';

export interface SearchResult {
  type: 'DataCenter' | 'Room' | 'Cabinet' | 'Device' | 'Cable' | 'Panel' | 'Port';
  id: string;
  shortId: number;
  name?: string;
  label?: string;
  description?: string;
  metadata?: any;
}

class SearchService {
  /**
   * 全局搜索 - 在所有实体中搜索关键词
   */
  async globalSearch(query: string): Promise<SearchResult[]> {
    const results: SearchResult[] = [];

    try {
      // 搜索数据中心
      const dataCenters = await dataCenterService.searchDataCenters(query);
      results.push(
        ...dataCenters.map((dc) => ({
          type: 'DataCenter' as const,
          id: dc.id,
          shortId: dc.shortId,
          name: dc.name,
          description: dc.location || undefined,
          metadata: { location: dc.location },
        }))
      );

      // 搜索机房
      const rooms = await roomService.searchRooms(query);
      results.push(
        ...rooms.map((room) => ({
          type: 'Room' as const,
          id: room.id,
          shortId: room.shortId,
          name: room.name,
          description: room.floor || undefined,
          metadata: { floor: room.floor, dataCenterId: room.dataCenterId },
        }))
      );

      // 搜索机柜
      const cabinets = await cabinetService.searchCabinets(query);
      results.push(
        ...cabinets.map((cabinet) => ({
          type: 'Cabinet' as const,
          id: cabinet.id,
          shortId: cabinet.shortId,
          name: cabinet.name,
          description: cabinet.position || undefined,
          metadata: {
            position: cabinet.position,
            height: cabinet.height,
            roomId: cabinet.roomId,
          },
        }))
      );

      // 搜索设备
      const devices = await deviceService.searchDevices(query);
      results.push(
        ...devices.map((device) => ({
          type: 'Device' as const,
          id: device.id,
          shortId: device.shortId,
          name: device.name,
          description: `${device.type}${device.model ? ` - ${device.model}` : ''}`,
          metadata: {
            type: device.type,
            model: device.model,
            serialNo: device.serialNo,
            cabinetId: device.cabinetId,
          },
        }))
      );

      // 搜索线缆
      const cables = await cableService.searchCables(query);
      results.push(
        ...cables.map((cable) => ({
          type: 'Cable' as const,
          id: cable.id,
          shortId: cable.shortId,
          label: cable.label || undefined,
          description: `${cable.type}${cable.color ? ` - ${cable.color}` : ''}`,
          metadata: {
            type: cable.type,
            color: cable.color,
            length: cable.length,
            notes: cable.notes,
          },
        }))
      );

      // 搜索面板
      const panels = await panelService.searchPanels(query);
      results.push(
        ...panels.map((panel) => ({
          type: 'Panel' as const,
          id: panel.id,
          shortId: panel.shortId,
          name: panel.name,
          description: panel.type,
          metadata: {
            type: panel.type,
            portCount: panel.portCount,
            deviceId: panel.deviceId,
            cabinetId: (panel as any).device?.cabinetId,
          },
        }))
      );

      // 搜索端口
      const ports = await portService.searchPorts(query);
      results.push(
        ...ports.map((port) => ({
          type: 'Port' as const,
          id: port.id,
          shortId: port.shortId,
          name: port.name,
          description: `${port.type} - ${port.status}`,
          metadata: {
            type: port.type,
            status: port.status,
            position: port.position,
            panelId: port.panelId,
          },
        }))
      );
    } catch (error) {
      console.error('Error in global search:', error);
      throw error;
    }

    return results;
  }

  /**
   * 根据 shortId 查找实体
   * 使用全局分配表快速定位实体类型和ID，然后获取完整数据
   */
  async findByShortId(shortId: number): Promise<SearchResult | null> {
    try {
      // 1. 从全局分配表查找实体类型和ID
      const allocation = await globalShortIdService.getEntityByShortId(shortId);

      if (!allocation) {
        return null;
      }

      const { entityType, entityId } = allocation;

      // 2. 根据实体类型获取完整数据
      switch (entityType) {
        case 'DataCenter': {
          const dataCenter = await prisma.dataCenter.findUnique({
            where: { id: entityId },
          });
          if (!dataCenter) return null;
          return {
            type: 'DataCenter',
            id: dataCenter.id,
            shortId: dataCenter.shortId,
            name: dataCenter.name,
            description: dataCenter.location || undefined,
            metadata: dataCenter,
          };
        }

        case 'Room': {
          const room = await prisma.room.findUnique({
            where: { id: entityId },
          });
          if (!room) return null;
          return {
            type: 'Room',
            id: room.id,
            shortId: room.shortId,
            name: room.name,
            description: room.floor || undefined,
            metadata: room,
          };
        }

        case 'Cabinet': {
          const cabinet = await prisma.cabinet.findUnique({
            where: { id: entityId },
          });
          if (!cabinet) return null;
          return {
            type: 'Cabinet',
            id: cabinet.id,
            shortId: cabinet.shortId,
            name: cabinet.name,
            description: cabinet.position || undefined,
            metadata: cabinet,
          };
        }

        case 'Device': {
          const device = await prisma.device.findUnique({
            where: { id: entityId },
          });
          if (!device) return null;
          return {
            type: 'Device',
            id: device.id,
            shortId: device.shortId,
            name: device.name,
            description: `${device.type}${device.model ? ` - ${device.model}` : ''}`,
            metadata: device,
          };
        }

        case 'Cable': {
          const cable = await prisma.cable.findUnique({
            where: { id: entityId },
          });
          if (!cable) return null;
          return {
            type: 'Cable',
            id: cable.id,
            shortId: cable.shortId,
            label: cable.label || undefined,
            description: `${cable.type}${cable.color ? ` - ${cable.color}` : ''}`,
            metadata: cable,
          };
        }

        case 'Panel': {
          const panel = await prisma.panel.findUnique({
            where: { id: entityId },
          });
          if (!panel) return null;
          return {
            type: 'Panel',
            id: panel.id,
            shortId: panel.shortId,
            name: panel.name,
            description: panel.type,
            metadata: panel,
          };
        }

        case 'Port': {
          const port = await prisma.port.findUnique({
            where: { id: entityId },
          });
          if (!port) return null;
          return {
            type: 'Port',
            id: port.id,
            shortId: port.shortId,
            name: `Port ${port.number}`,
            description: `${port.portType || 'Unknown'} - ${port.status}`,
            metadata: port,
          };
        }

        case 'CableEndpoint': {
          const endpoint = await prisma.cableEndpoint.findUnique({
            where: { id: entityId },
            include: {
              cable: true,
            },
          });
          if (!endpoint) return null;
          return {
            type: 'Cable',
            id: endpoint.cable.id,
            shortId: endpoint.cable.shortId,
            name: `Cable ${endpoint.cable.label || endpoint.cable.type}`,
            description: `Endpoint ${endpoint.endType} - ${endpoint.cable.type}`,
            metadata: {
              ...endpoint.cable,
              endpointId: endpoint.id,
              endpointShortId: endpoint.shortId,
              endType: endpoint.endType,
            },
          };
        }

        default:
          console.warn(`Unknown entity type: ${entityType}`);
          return null;
      }
    } catch (error) {
      console.error('Error finding by shortId:', error);
      throw error;
    }
  }
}

export default new SearchService();
