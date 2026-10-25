import type { Db } from '../utils/prisma';
import type { DashboardOverview } from '../contracts/dashboard';
import { deviceLocInclude, devicePath, iso, locationText } from './shared';
import { usageOf } from './ipService';
import { DEVICE_TYPES, MODULE_STATUSES, type IpStatus } from '../contracts/enums';

const RECENT_DEVICES = 5;

export const dashboardService = {
  async overview(db: Db): Promise<DashboardOverview> {
    const [
      dataCenters,
      rooms,
      cabinets,
      devices,
      panels,
      ports,
      connected,
      reserved,
      faulty,
      cables,
      cablesInUse,
      cabinetsNoLabel,
      panelsNoLabel,
      endpointsNoLabel,
      labelsToPrint,
      onlineRows,
      workstations,
      unmatched,
      subnets,
      ipCounts,
      recent,
      deviceTypes,
      moduleStatuses,
    ] = await Promise.all([
      db.dataCenter.count(),
      db.room.count(),
      db.cabinet.count(),
      db.device.count(),
      db.panel.count(),
      db.port.count(),
      db.port.count({ where: { cableEndpoint: { isNot: null } } }),
      db.port.count({ where: { adminState: 'RESERVED' } }),
      db.port.count({ where: { adminState: 'FAULTY' } }),
      db.cable.count(),
      db.cable.count({ where: { endpoints: { some: { portId: { not: null } } } } }),
      db.cabinet.count({ where: { label: null } }),
      db.panel.count({ where: { label: null } }),
      db.cableEndpoint.count({ where: { label: null } }),
      db.label.count({
        where: { state: 'GENERATED', OR: [{ cabinetId: { not: null } }, { panelId: { not: null } }, { cableEndpointId: { not: null } }, { roomId: { not: null } }] },
      }),
      db.$queryRaw<{ n: bigint }[]>`SELECT count(*) AS n FROM "Workstation" WHERE "lastSeenAt" IS NOT NULL AND ("lastCheckedAt" IS NULL OR "lastSeenAt" >= "lastCheckedAt")`,
      db.workstation.count(),
      db.observationUnmatched.count(),
      db.ipSubnet.findMany({ select: { id: true, name: true, network: true, prefixLen: true }, orderBy: [{ network: 'asc' }, { prefixLen: 'asc' }] }),
      db.ipAddress.groupBy({ by: ['subnetId', 'status'], _count: { _all: true } }),
      db.device.findMany({ take: RECENT_DEVICES, orderBy: { createdAt: 'desc' }, include: deviceLocInclude }),
      db.device.groupBy({ by: ['type'], _count: { _all: true } }),
      db.opticalModule.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const devicesByType = Object.fromEntries(DEVICE_TYPES.map((k) => [k, deviceTypes.find((r) => r.type === k)?._count._all ?? 0])) as DashboardOverview['devicesByType'];
    const opticalModules = Object.fromEntries(MODULE_STATUSES.map((k) => [k, moduleStatuses.find((r) => r.status === k)?._count._all ?? 0])) as DashboardOverview['opticalModules'];
    const counts = new Map<string, Partial<Record<IpStatus, number>>>();
    for (const r of ipCounts) {
      const m = counts.get(r.subnetId) ?? {};
      m[r.status] = r._count._all;
      counts.set(r.subnetId, m);
    }
    return {
      counts: {
        dataCenters, rooms, cabinets, devices, panels, ports, cables, workstations,
        opticalModules: Object.values(opticalModules).reduce((a, b) => a + b, 0),
      },
      devicesByType,
      opticalModules,
      ports: {
        total: ports,
        connected,
        free: ports - connected,
        reserved,
        faulty,
        usageRate: ports > 0 ? Math.round((connected / ports) * 1000) / 10 : 0,
      },
      cables: { STOCK: cables - cablesInUse, IN_USE: cablesInUse },
      labelsMissing: cabinetsNoLabel + panelsNoLabel + endpointsNoLabel,
      labelsToPrint,
      workstations: { total: workstations, online: Number(onlineRows[0]?.n ?? 0) },
      observationUnmatched: unmatched,
      subnets: subnets.map((s) => ({ id: s.id, name: s.name, network: `${s.network}/${s.prefixLen}`, usage: usageOf(s.prefixLen, counts.get(s.id) ?? {}) })),
      recentDevices: recent.map((d) => ({ id: d.id, name: d.name, type: d.type, location: locationText(devicePath(d).slice(0, -1)), createdAt: iso(d.createdAt) })),
    };
  },
};
