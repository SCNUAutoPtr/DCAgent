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
  shortId?: number; // shortId为可选，因为不是所有实体都有shortId
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
      // 搜索数据中心（无shortId）
      const dataCenters = await dataCenterService.searchDataCenters(query);
      results.push(
        ...dataCenters.map((dc) => ({
          type: 'DataCenter' as const,
          id: dc.id,
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

      // 搜索设备（无shortId）
      const devices = await deviceService.searchDevices(query);
      results.push(
        ...devices.map((device) => ({
          type: 'Device' as const,
          id: device.id,
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

      // 搜索线缆（无shortId）
      const cables = await cableService.searchCables(query);
      results.push(
        ...cables.map((cable) => ({
          type: 'Cable' as const,
          id: cable.id,
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
          shortId: panel.shortId ?? undefined,
          name: panel.name,
          description: panel.type,
          metadata: {
            type: panel.type,
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
          name: `Port ${port.number}`,
          description: `${port.portType || 'Unknown'} - ${port.status}`,
          metadata: {
            number: port.number,
            portType: port.portType,
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
   * 支持：Room、Cabinet、Panel、Port（从全局分配表）
   * 以及：CableEndpoint（从ShortIdPool和CableEndpoint表）
   */
  async findByShortId(shortId: number): Promise<SearchResult | null> {
    try {
      // 1. 先从全局分配表查找（Room、Cabinet、Panel、Port）
      const allocation = await globalShortIdService.getEntityByShortId(shortId);

      if (allocation) {
        const { entityType, entityId } = allocation;

        // 2. 根据实体类型获取完整数据
        switch (entityType) {
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

        case 'Panel': {
          const panel = await prisma.panel.findUnique({
            where: { id: entityId },
          });
          if (!panel) return null;
          return {
            type: 'Panel',
            id: panel.id,
            shortId: panel.shortId ?? undefined,
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

        case 'CABLE_ENDPOINT':
        case 'CableEndpoint': {
          const endpoint = await prisma.cableEndpoint.findUnique({
            where: { id: entityId },
            include: {
              cable: {
                include: {
                  endpoints: {
                    include: {
                      port: {
                        include: {
                          panel: {
                            include: {
                              device: {
                                include: {
                                  cabinet: {
                                    include: {
                                      room: {
                                        include: {
                                          dataCenter: true,
                                        },
                                      },
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              port: {
                include: {
                  panel: {
                    include: {
                      device: {
                        include: {
                          cabinet: {
                            include: {
                              room: {
                                include: {
                                  dataCenter: true,
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          });
          if (!endpoint) return null;

          // 获取对端信息
          const otherEndpoints = endpoint.cable.endpoints
            .filter((ep) => ep.id !== endpoint.id)
            .map((ep) => ({
              id: ep.id,
              endType: ep.endType,
              shortId: ep.shortId,
              isConnected: !!ep.portId,
              port: ep.port || null,
              panel: ep.port?.panel || null,
            }));

          return {
            type: 'Cable',
            id: endpoint.cable.id,
            shortId: endpoint.shortId ?? undefined,
            name: `Cable ${endpoint.cable.label || endpoint.cable.type}`,
            description: `Endpoint ${endpoint.endType} - ${endpoint.cable.type}`,
            metadata: {
              ...endpoint.cable,
              endpointId: endpoint.id,
              endpointShortId: endpoint.shortId,
              endType: endpoint.endType,
              isConnected: !!endpoint.portId,
              port: endpoint.port || null,
              panel: endpoint.port?.panel || null,
              otherEndpoints,
            },
          };
        }

        default:
          console.warn(`Unknown entity type: ${entityType}`);
          return null;
        }
      }

      // 3. 如果全局分配表没有，查找线缆端点标签
      const endpoint = await prisma.cableEndpoint.findUnique({
        where: { shortId },
        include: {
          cable: {
            include: {
              endpoints: {
                include: {
                  port: {
                    include: {
                      panel: {
                        include: {
                          device: {
                            include: {
                              cabinet: {
                                include: {
                                  room: {
                                    include: {
                                      dataCenter: true,
                                    },
                                  },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          port: {
            include: {
              panel: {
                include: {
                  device: {
                    include: {
                      cabinet: {
                        include: {
                          room: {
                            include: {
                              dataCenter: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (endpoint && endpoint.shortId !== null) {
        // 获取对端信息
        const otherEndpoints = endpoint.cable.endpoints
          .filter((ep) => ep.id !== endpoint.id)
          .map((ep) => ({
            id: ep.id,
            endType: ep.endType,
            shortId: ep.shortId,
            isConnected: !!ep.portId,
            port: ep.port || null,
            panel: ep.port?.panel || null,
          }));

        return {
          type: 'Cable',
          id: endpoint.cable.id,
          shortId: endpoint.shortId,
          name: `Cable ${endpoint.cable.label || endpoint.cable.type}`,
          description: `Endpoint ${endpoint.endType} - ${endpoint.cable.type}`,
          metadata: {
            ...endpoint.cable,
            endpointId: endpoint.id,
            endpointShortId: endpoint.shortId,
            endType: endpoint.endType,
            isConnected: !!endpoint.portId,
            port: endpoint.port || null,
            panel: endpoint.port?.panel || null,
            otherEndpoints,
          },
        };
      }

      // 4. 都没找到，返回 null
      return null;
    } catch (error) {
      console.error('Error finding by shortId:', error);
      throw error;
    }
  }
}

export default new SearchService();
