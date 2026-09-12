import prisma from '../utils/prisma';
import { CableInventoryStatus, PortStatus } from '@prisma/client';

// 仪表板"最近添加的设备"列多少条
const RECENT_DEVICE_LIMIT = 5;

class DashboardService {
  /**
   * 仪表板总览：各层级数量、端口占用、线缆入库状态、最近上架的设备
   */
  async getOverview() {
    const [
      dataCenters,
      rooms,
      cabinets,
      devices,
      panels,
      portGroups,
      cableGroups,
      recentDeviceRows,
    ] = await Promise.all([
      prisma.dataCenter.count(),
      prisma.room.count(),
      prisma.cabinet.count(),
      prisma.device.count(),
      prisma.panel.count(),
      prisma.port.groupBy({ by: ['status'], _count: true }),
      prisma.cable.groupBy({ by: ['inventoryStatus'], _count: true }),
      prisma.device.findMany({
        take: RECENT_DEVICE_LIMIT,
        orderBy: { createdAt: 'desc' },
        include: {
          cabinet: {
            include: { room: true },
          },
        },
      }),
    ]);

    const portCount = (status: PortStatus) =>
      portGroups.find((group) => group.status === status)?._count ?? 0;

    const occupied = portCount(PortStatus.OCCUPIED);
    const available = portCount(PortStatus.AVAILABLE);
    const reserved = portCount(PortStatus.RESERVED);
    const faulty = portCount(PortStatus.FAULTY);
    const totalPorts = occupied + available + reserved + faulty;

    const cableCount = (status: CableInventoryStatus) =>
      cableGroups.find((group) => group.inventoryStatus === status)?._count ?? 0;

    const notInventoried = cableCount(CableInventoryStatus.NOT_INVENTORIED);
    const inventoried = cableCount(CableInventoryStatus.INVENTORIED);
    const inUse = cableCount(CableInventoryStatus.IN_USE);
    const totalCables = notInventoried + inventoried + inUse;

    return {
      counts: {
        dataCenters,
        rooms,
        cabinets,
        devices,
        panels,
        ports: totalPorts,
        cables: totalCables,
      },
      ports: {
        total: totalPorts,
        occupied,
        available,
        reserved,
        faulty,
        // 占用率保留一位小数，没有端口时给 0 而不是 NaN
        occupancyRate: totalPorts > 0 ? Number(((occupied / totalPorts) * 100).toFixed(1)) : 0,
      },
      cables: {
        total: totalCables,
        notInventoried,
        inventoried,
        inUse,
      },
      recentDevices: recentDeviceRows.map((device) => ({
        id: device.id,
        name: device.name,
        type: device.type,
        model: device.model,
        uPosition: device.uPosition,
        cabinetId: device.cabinetId,
        cabinetName: device.cabinet?.name ?? null,
        roomName: device.cabinet?.room?.name ?? null,
        createdAt: device.createdAt,
      })),
    };
  }
}

export default new DashboardService();
