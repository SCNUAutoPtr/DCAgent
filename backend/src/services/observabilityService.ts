import type { z } from 'zod';
import type { Db } from '../utils/prisma';
import { AppError, invalid, must } from '../http/errors';
import { env } from '../config/env';
import { normalizeIfName, shortIfName, sysnameKey } from '../contracts/ifName';
import type {
  FlowIngestResult,
  FlowStatus,
  PortObservationDto,
  SeatDto,
  SwitchSnapshotResult,
  SyncPortsResult,
  SyncPowerResult,
  TopFlowRow,
  SwitchSummary,
  UnmatchedDto,
  flowsTopSchema,
  seatMapSchema,
  switchHistorySchema,
  switchSnapshotSchema,
  syncPowerSchema,
  unmatchedListSchema,
  unmatchedResolveSchema,
} from '../contracts/observability';
import type { Paged } from '../contracts/common';
import { FlowWindow, parseFlowLine } from './observability/flows';
import { assessPortHealth, parseInterfaceBrief, parseTransceiverDiagnosis } from './observability/huaweiParser';
import { buildEndpointIndex, errorGrowthFindings, mergeObservations, planPortSync, planPowerSync, type WorkstationRef } from './observability/plan';
import { iso } from './shared';
import { workstationDto, workstationInclude } from './workstationService';

/** "192.0.2.12=1024,192.0.2.13=512": NetStream v9 records carry no sampling rate. */
export function parseDefaultRates(text: string | undefined): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const part of (text ?? '').split(',')) {
    const [ip, rate] = part.split('=').map((s) => s.trim());
    if (ip && Number(rate) > 0) rates[ip] = Number(rate);
  }
  return rates;
}

const flows = new FlowWindow();
const defaultRates = parseDefaultRates(env.OBS_DEFAULT_SAMPLING_RATES);

/** Device by sysname: exact first, then loosely ("445AU6" finds "445A-U6"). */
export async function findDeviceBySysname(db: Db, sysname: string) {
  const exact = await db.device.findUnique({ where: { sysname }, select: { id: true, name: true, sysname: true } });
  if (exact) return exact;
  const key = sysnameKey(sysname);
  const all = await db.device.findMany({ where: { sysname: { not: null } }, select: { id: true, name: true, sysname: true } });
  return all.find((d) => sysnameKey(d.sysname!) === key) ?? null;
}

async function findPort(db: Db, deviceId: string, ifName: string) {
  return db.port.findFirst({ where: { ifName: normalizeIfName(ifName), panel: { deviceId } }, select: { id: true } });
}

async function workstationRefs(db: Db): Promise<WorkstationRef[]> {
  const rows = await db.workstation.findMany({ select: { id: true, name: true, code: true, ipAddress: { select: { address: true, macAddress: true } } } });
  return rows.map((w) => ({ id: w.id, name: w.name, code: w.code, ip: w.ipAddress?.address ?? null, mac: w.ipAddress?.macAddress ?? null }));
}

function trafficByIp(now: number, windowSeconds: number) {
  const traffic = new Map<string, { inBps: number; outBps: number }>();
  for (const f of flows.top({ now, windowMs: windowSeconds * 1000, limit: Number.MAX_SAFE_INTEGER })) {
    const out = traffic.get(f.src) ?? { inBps: 0, outBps: 0 };
    out.outBps += f.bitsPerSecond;
    traffic.set(f.src, out);
    const inn = traffic.get(f.dst) ?? { inBps: 0, outBps: 0 };
    inn.inBps += f.bitsPerSecond;
    traffic.set(f.dst, inn);
  }
  return traffic;
}

export const observabilityService = {
  // ---------- flows (in memory) ----------
  ingestFlows(lines: string[], rates: Record<string, number> = {}): FlowIngestResult {
    const merged = { ...defaultRates, ...rates };
    const parsed = lines.map((l) => parseFlowLine(l, merged)).filter((f) => f !== null);
    flows.add(parsed);
    return { accepted: parsed.length, skipped: lines.length - parsed.length, buffered: flows.size() };
  },
  flowStatus(): FlowStatus {
    return { buffered: flows.size(), samplers: flows.samplers(), defaultRates };
  },
  async topFlows(db: Db, opts: z.infer<typeof flowsTopSchema>): Promise<TopFlowRow[]> {
    const rows = flows.top({ now: opts.now ?? Date.now(), windowMs: opts.windowSeconds * 1000, limit: opts.limit, sampler: opts.sampler });
    const [ws, ips] = await Promise.all([
      db.workstation.findMany({ include: workstationInclude }),
      db.ipAddress.findMany({ where: { workstationId: null }, select: { address: true, hostname: true, device: { select: { name: true } }, port: { select: { panel: { select: { device: { select: { name: true } } } } } } } }),
    ]);
    const index = buildEndpointIndex(
      ws.map((w) => ({
        name: w.name,
        ip: w.ipAddress?.address ?? null,
        location: w.attachedPort ? `${w.attachedPort.panel.device.sysname ?? w.attachedPort.panel.device.name} ${shortIfName(w.attachedPort.ifName ?? w.attachedPort.number)}` : null,
      })),
      ips.map((i) => ({ address: i.address, hostname: i.hostname, device: i.device ?? i.port?.panel.device ?? null })),
    );
    return rows.map((r) => ({ ...r, srcEndpoint: index.get(r.src) ?? null, dstEndpoint: index.get(r.dst) ?? null }));
  },

  // ---------- switch ports ----------
  /** Parse display output, assess health, store per device. Unknown sysname: rows go to ObservationUnmatched. */
  async recordSwitchSnapshot(db: Db, input: z.infer<typeof switchSnapshotSchema>): Promise<SwitchSnapshotResult> {
    const interfaces = parseInterfaceBrief(input.interfaceBrief ?? '');
    const transceivers = parseTransceiverDiagnosis(input.transceiver ?? '');
    const observations = mergeObservations(interfaces, transceivers);
    const device = await findDeviceBySysname(db, input.sysname);

    const previous = new Map<string, { inErrors: number | null; outErrors: number | null; collectedAt: Date }>();
    if (device) {
      const prev = await db.portObservation.findMany({
        where: { deviceId: device.id, ifName: { in: observations.map((o) => o.ifName) } },
        orderBy: { collectedAt: 'desc' },
        distinct: ['ifName'],
        select: { ifName: true, inErrors: true, outErrors: true, collectedAt: true },
      });
      for (const p of prev) previous.set(p.ifName, p);
    }
    const findings = [
      ...errorGrowthFindings(observations, previous).map((f) => ({ ...f, shortName: shortIfName(f.interface) })),
      ...assessPortHealth({ interfaces, transceivers }),
    ];

    let saved = 0;
    let unmatched = 0;
    if (input.save && observations.length) {
      const collectedAt = new Date();
      if (device) {
        const ports = await db.port.findMany({ where: { panel: { deviceId: device.id }, ifName: { not: null } }, select: { id: true, ifName: true } });
        const portBy = new Map(ports.map((p) => [p.ifName!, p.id]));
        const res = await db.portObservation.createMany({
          data: observations.map((o) => ({ ...o, deviceId: device.id, portId: portBy.get(normalizeIfName(o.ifName)) ?? null, collectedAt })),
        });
        saved = res.count;
      } else {
        const res = await db.observationUnmatched.createMany({
          data: observations.map((o) => ({
            source: 'PORT_OBSERVATION' as const,
            sysname: input.sysname,
            ifName: o.ifName,
            payload: { ...o, collectedAt: collectedAt.toISOString() },
          })),
        });
        unmatched = res.count;
      }
    }
    return { sysname: input.sysname, deviceId: device?.id ?? null, interfaces, transceivers, findings, saved, unmatched };
  },

  async listSwitches(db: Db): Promise<SwitchSummary[]> {
    const groups = await db.portObservation.groupBy({ by: ['deviceId'], _max: { collectedAt: true }, _count: { _all: true } });
    const devices = await db.device.findMany({ where: { id: { in: groups.map((g) => g.deviceId) } }, select: { id: true, name: true, sysname: true } });
    const by = new Map(devices.map((d) => [d.id, d]));
    return groups
      .map((g) => ({
        deviceId: g.deviceId,
        deviceName: by.get(g.deviceId)?.name ?? '',
        sysname: by.get(g.deviceId)?.sysname ?? null,
        lastCollectedAt: g._max.collectedAt ? iso(g._max.collectedAt) : null,
        observations: g._count._all,
      }))
      .sort((a, b) => (a.sysname ?? a.deviceName).localeCompare(b.sysname ?? b.deviceName));
  },

  async portHistory(db: Db, opts: z.infer<typeof switchHistorySchema>): Promise<PortObservationDto[]> {
    return db.portObservation.findMany({
      where: { deviceId: opts.deviceId, ifName: normalizeIfName(opts.ifName) },
      orderBy: { collectedAt: 'desc' },
      take: opts.limit,
    });
  },

  // ---------- workstations ----------
  /** Writes lastCheckedAt for every matched seat and lastSeenAt for the online ones; adminState is never touched. */
  async syncPower(db: Db, input: z.infer<typeof syncPowerSchema>): Promise<SyncPowerResult> {
    const plan = planPowerSync(input.rows, await workstationRefs(db));
    if (!input.dryRun) {
      const now = new Date();
      const on = plan.updates.filter((u) => u.online).map((u) => u.id);
      const off = plan.updates.filter((u) => !u.online).map((u) => u.id);
      if (on.length) await db.workstation.updateMany({ where: { id: { in: on } }, data: { lastCheckedAt: now, lastSeenAt: now } });
      if (off.length) await db.workstation.updateMany({ where: { id: { in: off } }, data: { lastCheckedAt: now } });
    }
    return {
      dryRun: input.dryRun,
      updated: plan.updates.length,
      online: plan.updates.filter((u) => u.online).length,
      unmatched: plan.unmatched,
    };
  },

  /** Resolves [sysname, interface] to a Port; anything unresolved is kept in ObservationUnmatched. */
  async syncPorts(db: Db, ports: Record<string, string[]>, dryRun: boolean): Promise<SyncPortsResult> {
    const plan = planPortSync(ports, await workstationRefs(db));
    let attached = 0;
    let unresolved = 0;
    const deviceCache = new Map<string, Awaited<ReturnType<typeof findDeviceBySysname>>>();
    for (const m of plan.matches) {
      if (!deviceCache.has(m.sysname)) deviceCache.set(m.sysname, await findDeviceBySysname(db, m.sysname));
      const device = deviceCache.get(m.sysname)!;
      const port = device ? await findPort(db, device.id, m.ifName) : null;
      if (dryRun) {
        if (port) attached++;
        else unresolved++;
        continue;
      }
      await db.observationUnmatched.deleteMany({ where: { workstationId: m.id, source: 'WORKSTATION_ATTACH' } });
      if (port) {
        await db.workstation.update({ where: { id: m.id }, data: { attachedPortId: port.id } });
        attached++;
      } else {
        await db.observationUnmatched.create({
          data: {
            source: 'WORKSTATION_ATTACH',
            sysname: m.sysname,
            ifName: m.ifName,
            workstationId: m.id,
            payload: { seat: m.seat, switchName: m.sysname, switchPort: m.ifName, source: m.source, reason: device ? 'PORT_NOT_FOUND' : 'DEVICE_NOT_FOUND' },
          },
        });
        unresolved++;
      }
    }
    return { dryRun, attached, unresolved, unmatchedSeats: plan.unmatched };
  },

  async seatMap(db: Db, opts: z.infer<typeof seatMapSchema>): Promise<SeatDto[]> {
    must(await db.room.findUnique({ where: { id: opts.roomId }, select: { id: true } }), 'room', { id: opts.roomId });
    const rows = await db.workstation.findMany({ where: { roomId: opts.roomId }, include: workstationInclude, orderBy: { name: 'asc' } });
    const traffic = trafficByIp(opts.now ?? Date.now(), opts.windowSeconds);
    return rows.map((w) => ({
      ...workstationDto(w),
      traffic: (w.ipAddress && traffic.get(w.ipAddress.address)) || { inBps: 0, outBps: 0 },
    }));
  },

  // ---------- unmatched ----------
  async listUnmatched(db: Db, input: z.infer<typeof unmatchedListSchema>): Promise<Paged<UnmatchedDto>> {
    const where = input.source ? { source: input.source } : {};
    const [rows, total] = await Promise.all([
      db.observationUnmatched.findMany({
        where,
        include: { workstation: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: input.take,
        skip: input.skip,
      }),
      db.observationUnmatched.count({ where }),
    ]);
    return {
      items: rows.map((r) => ({
        id: r.id,
        source: r.source,
        sysname: r.sysname,
        ifName: r.ifName,
        workstationId: r.workstationId,
        workstationName: r.workstation?.name ?? null,
        payload: r.payload,
        createdAt: iso(r.createdAt),
      })),
      total,
    };
  },

  /** WORKSTATION_ATTACH needs portId; PORT_OBSERVATION needs deviceId (portId optional). The row is consumed. */
  async resolveUnmatched(db: Db, input: z.infer<typeof unmatchedResolveSchema>) {
    const row = must(await db.observationUnmatched.findUnique({ where: { id: input.id } }), 'unmatched observation', { id: input.id });
    if (row.source === 'WORKSTATION_ATTACH') {
      if (!input.portId) throw invalid('portId is required for WORKSTATION_ATTACH');
      if (!row.workstationId) throw new AppError('INVALID_STATE', 'row has no workstation');
      must(await db.port.findUnique({ where: { id: input.portId }, select: { id: true } }), 'port', { id: input.portId });
      await db.workstation.update({ where: { id: row.workstationId }, data: { attachedPortId: input.portId } });
    } else {
      if (!input.deviceId) throw invalid('deviceId is required for PORT_OBSERVATION');
      must(await db.device.findUnique({ where: { id: input.deviceId }, select: { id: true } }), 'device', { id: input.deviceId });
      if (input.portId) {
        // an observation of one switch must not point at a port of another device
        const port = must(await db.port.findUnique({ where: { id: input.portId }, select: { panel: { select: { deviceId: true } } } }), 'port', { id: input.portId });
        if (port.panel.deviceId !== input.deviceId) throw invalid('port does not belong to the device', { portId: input.portId, deviceId: input.deviceId });
      }
      const p = row.payload as Record<string, unknown>;
      const num = (k: string) => (typeof p[k] === 'number' ? (p[k] as number) : null);
      const portId = input.portId ?? (await findPort(db, input.deviceId, row.ifName ?? ''))?.id ?? null;
      await db.portObservation.create({
        data: {
          ...(typeof p.id === 'string' ? { id: p.id } : {}),
          deviceId: input.deviceId,
          portId,
          ifName: row.ifName ?? String(p.ifName ?? ''),
          phy: typeof p.phy === 'string' ? p.phy : null,
          inUtilPercent: num('inUtilPercent'),
          outUtilPercent: num('outUtilPercent'),
          inErrors: num('inErrors'),
          outErrors: num('outErrors'),
          rxPowerDbm: num('rxPowerDbm'),
          txPowerDbm: num('txPowerDbm'),
          rxLowAlarmDbm: num('rxLowAlarmDbm'),
          rxLowWarnDbm: num('rxLowWarnDbm'),
          collectedAt: typeof p.collectedAt === 'string' ? new Date(p.collectedAt) : row.createdAt,
        },
      });
    }
    await db.observationUnmatched.delete({ where: { id: row.id } });
    return { ok: true as const };
  },
};

