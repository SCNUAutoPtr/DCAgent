/**
 * 447/445C 网络拓扑导入脚本
 * 将 test-data/447-network-topology.normalized.json 中的数据导入 PostgreSQL + Neo4j
 * 用法：
 *   tsx backend/scripts/import-447-topology.ts            # 默认 dry-run
 *   tsx backend/scripts/import-447-topology.ts --commit   # 实际写库
 *   tsx backend/scripts/import-447-topology.ts --data=/abs/path/to.json --commit
 *
 * 规则：
 *   - 交换机建立 前/后 两块面板，其他设备只建后面板
 *   - 设备级 EID 作为后面板 shortId
 *   - 线缆两端 EID 作为 CableEndpoint shortId
 *   - 未落到端口的插头保持 panelId 有值、portId 为 null
 *   - 源文档里的备注整体落到对应实体的 notes 字段
 */

import fs from 'node:fs';
import path from 'node:path';
import { EntityType, CableType, DeviceType, PanelType, PortStatus, PhysicalStatus, IpStatus } from '@prisma/client';
import prisma from '../src/utils/prisma';
import cableGraphService from '../src/graph/cableGraph';
import { shortIdPoolService } from '../src/services/shortIdPoolService';
import { formatProgressLine } from '../src/utils/cliProgress';

if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'production';
}

interface NormalizedPort {
  key: string;
  number: string;
  label?: string;
  portType?: string;
  notes?: string;
}

interface NormalizedPanel {
  key: string;
  name: string;
  role: 'FRONT' | 'REAR';
  type: PanelType;
  shortId?: number | null;
  notes?: string;
  ports?: NormalizedPort[];
  danglingPlugContainer?: boolean;
}

interface NormalizedIpAssignment {
  address: string;
  cidr: number;
  subnetKey?: string | null;
  portKey?: string | null;
  role?: string;
  servicePort?: number;
}

interface NormalizedDevice {
  key: string;
  name: string;
  type: DeviceType;
  sourceType?: string;
  model?: string;
  cabinetKey?: string | null;
  uPosition?: number | null;
  uHeight?: number | null;
  positionText?: string;
  notes?: string;
  panels: NormalizedPanel[];
  ipAssignments?: NormalizedIpAssignment[];
  logicalInterfaces?: Array<{ name: string; ipAssignments?: NormalizedIpAssignment[] }>;
}

interface NormalizedCabinet {
  key: string;
  name: string;
  shortId?: number | null;
  position?: string;
  height?: number;
  notes?: string;
}

interface NormalizedRoom {
  key: string;
  name: string;
  floor?: string | null;
  shortId?: number | null;
  notes?: string;
  cabinets: NormalizedCabinet[];
}

interface NormalizedLinkEndpoint {
  portKey?: string | null;
  panelKey?: string | null;
  shortId?: number;
}

interface NormalizedLink {
  key: string;
  status: 'RESOLVED' | 'PENDING_PORT_ASSIGNMENT';
  cableType: CableType;
  lengthMeters?: number;
  notes?: string;
  endpointA: NormalizedLinkEndpoint;
  endpointB: NormalizedLinkEndpoint;
}

interface NormalizedSubnet {
  key: string;
  name: string;
  network: string;
  cidr: number;
  gateway?: string | null;
  roomKey?: string | null;
  notes?: string;
}

interface VirtualIpAssignment {
  address: string;
  cidr: number;
  name: string;
  subnetKey: string;
  status?: string;
}

interface NormalizedDataCenter {
  key: string;
  name: string;
  location?: string;
}

interface NormalizedExternalLocation {
  key: string;
  name: string;
  devices: NormalizedDevice[];
}

interface NormalizedDocument {
  source: { path: string; title: string };
  dataCenter: NormalizedDataCenter;
  rooms: NormalizedRoom[];
  externalLocations: NormalizedExternalLocation[];
  devices: NormalizedDevice[];
  subnets: NormalizedSubnet[];
  virtualIpAssignments?: VirtualIpAssignment[];
  links: NormalizedLink[];
  unresolvedLinks: Array<{ key: string; reason: string }>;
}

const args = process.argv.slice(2);
const isCommit = args.includes('--commit');
const dataArg = args.find(a => a.startsWith('--data='));
const DEFAULT_DATA_PATH = path.resolve(__dirname, '../../test-data/447-network-topology.normalized.json');
const dataPath = dataArg ? path.resolve(dataArg.slice('--data='.length)) : DEFAULT_DATA_PATH;

function log(tag: string, msg: string) {
  const prefix = isCommit ? '[COMMIT]' : '[DRY-RUN]';
  if (isCommit && ['room', 'cabinet', 'device', 'panel', 'port', 'ip', 'cable', 'subnet'].includes(tag)) {
    return;
  }
  console.log(`${prefix} ${tag} ${msg}`);
}

function loadDocument(): NormalizedDocument {
  const raw = fs.readFileSync(dataPath, 'utf8');
  return JSON.parse(raw);
}

interface ImportContext {
  portIdByKey: Map<string, string>;
  panelIdByKey: Map<string, string>;
  deviceIdByKey: Map<string, string>;
  cabinetIdByKey: Map<string, string>;
  roomIdByKey: Map<string, string>;
  subnetIdByKey: Map<string, string>;
  panelDeviceKeyByKey: Map<string, string>;
  reservedShortIds: Set<number>;
  nextShortId: number;
  stats: {
    dataCenters: number;
    rooms: number;
    cabinets: number;
    devices: number;
    panels: number;
    ports: number;
    cables: number;
    endpoints: number;
    subnets: number;
    ipAddresses: number;
    notesAttached: number;
  };
}

function createContext(): ImportContext {
  return {
    portIdByKey: new Map(),
    panelIdByKey: new Map(),
    deviceIdByKey: new Map(),
    cabinetIdByKey: new Map(),
    roomIdByKey: new Map(),
    subnetIdByKey: new Map(),
    panelDeviceKeyByKey: new Map(),
    reservedShortIds: new Set(),
    nextShortId: 0,
    stats: {
      dataCenters: 0,
      rooms: 0,
      cabinets: 0,
      devices: 0,
      panels: 0,
      ports: 0,
      cables: 0,
      endpoints: 0,
      subnets: 0,
      ipAddresses: 0,
      notesAttached: 0,
    },
  };
}

function gatherExplicitShortIds(doc: NormalizedDocument): Set<number> {
  const set = new Set<number>();
  for (const room of doc.rooms) {
    if (room.shortId) set.add(room.shortId);
    for (const cabinet of room.cabinets) {
      if (cabinet.shortId) set.add(cabinet.shortId);
    }
  }
  const allDevices: NormalizedDevice[] = [
    ...doc.devices,
    ...doc.externalLocations.flatMap(loc => loc.devices),
  ];
  for (const device of allDevices) {
    for (const panel of device.panels) {
      if (panel.shortId) set.add(panel.shortId);
    }
  }
  for (const link of doc.links) {
    if (link.endpointA.shortId) set.add(link.endpointA.shortId);
    if (link.endpointB.shortId) set.add(link.endpointB.shortId);
  }
  return set;
}

function pickFreshShortId(ctx: ImportContext): number {
  let next = ctx.nextShortId + 1;
  while (ctx.reservedShortIds.has(next)) {
    next += 1;
  }
  ctx.nextShortId = next;
  ctx.reservedShortIds.add(next);
  return next;
}

async function ensureShortId(ctx: ImportContext, entityType: EntityType, desired?: number | null): Promise<number> {
  const finalShortId = desired && desired > 0 ? desired : pickFreshShortId(ctx);
  ctx.reservedShortIds.add(finalShortId);
  if (!isCommit) {
    return finalShortId;
  }
  await shortIdPoolService.allocateShortId(entityType, '', finalShortId);
  return finalShortId;
}

async function bindShortIdEntity(shortId: number, entityType: EntityType, entityId: string) {
  if (!isCommit) return;
  await shortIdPoolService.bindShortIdToEntity(shortId, entityType, entityId);
}

async function initializeShortIdCursor(ctx: ImportContext) {
  const maxPool = await prisma.shortIdPool.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } });
  const [cabinet, room, panel, cableEndpoint] = await Promise.all([
    prisma.cabinet.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
    prisma.room.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
    prisma.panel.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
    prisma.cableEndpoint.findFirst({ orderBy: { shortId: 'desc' }, select: { shortId: true } }),
  ]);

  ctx.nextShortId = Math.max(
    maxPool?.shortId || 0,
    cabinet?.shortId || 0,
    room?.shortId || 0,
    panel?.shortId || 0,
    cableEndpoint?.shortId || 0,
    ...ctx.reservedShortIds,
  );
}

function phase(title: string) {
  console.log(`\n=== ${title} ===`);
}

function progress(phaseName: string, completed: number, total: number, label?: string) {
  console.log(formatProgressLine({ phase: phaseName, completed, total, label, width: 24 }));
}

async function validateNoConflicts(doc: NormalizedDocument): Promise<string[]> {
  const issues: string[] = [];
  const shortIds = gatherExplicitShortIds(doc);
  if (shortIds.size > 0) {
    const conflicts = await prisma.shortIdPool.findMany({
      where: {
        shortId: { in: Array.from(shortIds) },
        status: 'BOUND',
      },
      select: { shortId: true, entityType: true, entityId: true },
    });
    for (const c of conflicts) {
      issues.push(`ShortID ${c.shortId} 已绑定 (${c.entityType} ${c.entityId})`);
    }
  }

  for (const subnet of doc.subnets) {
    const exists = await prisma.ipSubnet.findFirst({
      where: { network: subnet.network, cidr: subnet.cidr },
      select: { id: true },
    });
    if (exists) {
      issues.push(`子网 ${subnet.network}/${subnet.cidr} 已存在`);
    }
  }

  const ipSet = new Set<string>();
  const allDevices = [...doc.devices, ...doc.externalLocations.flatMap(l => l.devices)];
  for (const device of allDevices) {
    for (const ip of device.ipAssignments || []) {
      if (ipSet.has(ip.address)) {
        issues.push(`IP ${ip.address} 在文档内重复`);
      } else {
        ipSet.add(ip.address);
      }
    }
  }
  for (const ip of doc.virtualIpAssignments || []) {
    if (ipSet.has(ip.address)) {
      issues.push(`IP ${ip.address} 在文档内重复`);
    } else {
      ipSet.add(ip.address);
    }
  }
  if (ipSet.size > 0) {
    const existingIps = await prisma.ipAddress.findMany({
      where: { address: { in: Array.from(ipSet) } },
      select: { address: true },
    });
    for (const row of existingIps) {
      issues.push(`IP ${row.address} 已存在于数据库`);
    }
  }

  return issues;
}

async function ensureDataCenter(ctx: ImportContext, dc: NormalizedDataCenter): Promise<string> {
  if (!isCommit) {
    const id = `dryrun:${dc.key}`;
    ctx.stats.dataCenters += 1;
    log('dc', `将创建 ${dc.name}`);
    return id;
  }
  const existing = await prisma.dataCenter.findFirst({ where: { name: dc.name }, select: { id: true } });
  if (existing) {
    log('dc', `复用 ${dc.name}`);
    return existing.id;
  }
  const created = await prisma.dataCenter.create({
    data: { name: dc.name, location: dc.location || null },
  });
  ctx.stats.dataCenters += 1;
  log('dc', `创建 ${dc.name}`);
  return created.id;
}

async function ensureRoom(ctx: ImportContext, room: NormalizedRoom, dataCenterId: string): Promise<string> {
  const shortId = await ensureShortId(ctx, 'ROOM', room.shortId || undefined);
  let id: string;
  if (!isCommit) {
    id = `dryrun:${room.key}`;
    ctx.stats.rooms += 1;
    log('room', `将创建 ${room.name} (shortId ${shortId})`);
  } else {
    const record = await prisma.room.create({
      data: {
        name: room.name,
        floor: room.floor || null,
        notes: room.notes || null,
        shortId,
        dataCenterId,
      },
    });
    id = record.id;
    ctx.stats.rooms += 1;
    if (room.notes) ctx.stats.notesAttached += 1;
    await bindShortIdEntity(shortId, 'ROOM', id);
    log('room', `创建 ${room.name} (shortId ${shortId})`);
  }
  ctx.roomIdByKey.set(room.key, id);
  return id;
}

async function ensureCabinet(ctx: ImportContext, cabinet: NormalizedCabinet, roomId: string): Promise<string> {
  const shortId = await ensureShortId(ctx, 'CABINET', cabinet.shortId || undefined);
  let id: string;
  if (!isCommit) {
    id = `dryrun:${cabinet.key}`;
    ctx.stats.cabinets += 1;
    log('cabinet', `将创建 ${cabinet.name} (shortId ${shortId})`);
  } else {
    const record = await prisma.cabinet.create({
      data: {
        name: cabinet.name,
        position: cabinet.position || null,
        height: cabinet.height ?? 42,
        notes: cabinet.notes || null,
        shortId,
        roomId,
      },
    });
    id = record.id;
    ctx.stats.cabinets += 1;
    if (cabinet.notes) ctx.stats.notesAttached += 1;
    await bindShortIdEntity(shortId, 'CABINET', id);
    log('cabinet', `创建 ${cabinet.name} (shortId ${shortId})`);
  }
  ctx.cabinetIdByKey.set(cabinet.key, id);
  return id;
}

async function ensureDevice(ctx: ImportContext, device: NormalizedDevice, cabinetId: string): Promise<string> {
  const composedNotes = composeDeviceNotes(device);
  let id: string;
  if (!isCommit) {
    id = `dryrun:${device.key}`;
    ctx.stats.devices += 1;
    log('device', `将创建 ${device.name}`);
  } else {
    const record = await prisma.device.create({
      data: {
        name: device.name,
        type: device.type,
        model: device.model || null,
        uPosition: device.uPosition ?? undefined,
        uHeight: device.uHeight ?? undefined,
        notes: composedNotes,
        cabinetId,
      },
    });
    id = record.id;
    ctx.stats.devices += 1;
    if (composedNotes) ctx.stats.notesAttached += 1;
    log('device', `创建 ${device.name}`);
  }
  ctx.deviceIdByKey.set(device.key, id);

  for (const panel of device.panels) {
    await ensurePanel(ctx, panel, id, device.key);
  }
  return id;
}

function composeDeviceNotes(device: NormalizedDevice): string | null {
  const parts: string[] = [];
  if (device.sourceType && device.sourceType !== device.type) {
    parts.push(`原始类型: ${device.sourceType}`);
  }
  if (device.positionText) {
    parts.push(`原始位置: ${device.positionText}`);
  }
  if (device.notes) {
    parts.push(device.notes);
  }
  return parts.length ? parts.join('\n') : null;
}

async function ensurePanel(ctx: ImportContext, panel: NormalizedPanel, deviceId: string, deviceKey: string): Promise<string> {
  const shortId = await ensureShortId(ctx, 'PANEL', panel.shortId ?? undefined);
  let id: string;
  const panelNotes = composePanelNotes(panel);
  if (!isCommit) {
    id = `dryrun:${panel.key}`;
    ctx.stats.panels += 1;
    log('panel', `将创建 ${panel.name} of ${deviceKey} (shortId ${shortId})`);
  } else {
    const record = await prisma.panel.create({
      data: {
        name: panel.name,
        type: panel.type,
        shortId,
        notes: panelNotes,
        deviceId,
      },
    });
    id = record.id;
    ctx.stats.panels += 1;
    if (panelNotes) ctx.stats.notesAttached += 1;
    await bindShortIdEntity(shortId, 'PANEL', id);
    await cableGraphService.syncPanelNode(id, { name: panel.name, type: panel.type, deviceId });
    log('panel', `创建 ${panel.name} of ${deviceKey} (shortId ${shortId})`);
  }
  ctx.panelIdByKey.set(panel.key, id);
  ctx.panelDeviceKeyByKey.set(panel.key, deviceKey);

  for (const port of panel.ports || []) {
    await ensurePort(ctx, port, id, panel.key);
  }
  return id;
}

function composePanelNotes(panel: NormalizedPanel): string | null {
  const parts: string[] = [`角色: ${panel.role}`];
  if (panel.notes) parts.push(panel.notes);
  if (panel.danglingPlugContainer) parts.push('此面板有悬空插头');
  return parts.length ? parts.join('\n') : null;
}

async function ensurePort(ctx: ImportContext, port: NormalizedPort, panelId: string, panelKey: string): Promise<string> {
  let id: string;
  if (!isCommit) {
    id = `dryrun:${port.key}`;
    ctx.stats.ports += 1;
    log('port', `将创建 ${port.number} on ${panelKey}`);
  } else {
    const record = await prisma.port.create({
      data: {
        number: port.number,
        label: port.label || null,
        portType: port.portType || null,
        notes: port.notes || null,
        panelId,
      },
    });
    id = record.id;
    ctx.stats.ports += 1;
    if (port.notes) ctx.stats.notesAttached += 1;
    await cableGraphService.syncPortNode(id, { number: port.number, label: port.label || null, panelId });
    log('port', `创建 ${port.number} on ${panelKey}`);
  }
  ctx.portIdByKey.set(port.key, id);
  return id;
}

async function ensureSubnet(ctx: ImportContext, subnet: NormalizedSubnet): Promise<string> {
  let id: string;
  const roomId = subnet.roomKey ? ctx.roomIdByKey.get(subnet.roomKey) : undefined;
  if (!isCommit) {
    id = `dryrun:${subnet.key}`;
    ctx.stats.subnets += 1;
    log('subnet', `将创建 ${subnet.network}/${subnet.cidr}`);
  } else {
    const record = await prisma.ipSubnet.create({
      data: {
        name: subnet.name,
        network: subnet.network,
        cidr: subnet.cidr,
        gateway: subnet.gateway || null,
        description: subnet.notes || null,
        roomId: roomId || null,
      },
    });
    id = record.id;
    ctx.stats.subnets += 1;
    log('subnet', `创建 ${subnet.network}/${subnet.cidr}`);
  }
  ctx.subnetIdByKey.set(subnet.key, id);
  return id;
}

async function ensureIpAddress(
  ctx: ImportContext,
  ip: NormalizedIpAssignment,
  options: { deviceId?: string; description?: string },
) {
  if (!ip.subnetKey) {
    log('ip', `跳过 ${ip.address}: 无法确定子网`);
    return;
  }
  const subnetId = ctx.subnetIdByKey.get(ip.subnetKey);
  if (!subnetId) {
    log('ip', `跳过 ${ip.address}: 未创建子网 ${ip.subnetKey}`);
    return;
  }
  const portId = ip.portKey ? ctx.portIdByKey.get(ip.portKey) : undefined;
  const description = [ip.role, options.description, ip.servicePort ? `端口 ${ip.servicePort}` : null]
    .filter(Boolean)
    .join(' | ') || null;

  if (!isCommit) {
    ctx.stats.ipAddresses += 1;
    log('ip', `将创建 ${ip.address} (${ip.role || 'assign'})`);
    return;
  }

  await prisma.ipAddress.create({
    data: {
      address: ip.address,
      subnetId,
      status: 'ALLOCATED' as IpStatus,
      deviceId: options.deviceId || null,
      portId: portId || null,
      description,
    },
  });
  ctx.stats.ipAddresses += 1;
  log('ip', `创建 ${ip.address}`);
}

async function createLink(ctx: ImportContext, link: NormalizedLink) {
  const shortIdA = link.endpointA.shortId ? await ensureShortId(ctx, 'CABLE_ENDPOINT', link.endpointA.shortId) : undefined;
  const shortIdB = link.endpointB.shortId ? await ensureShortId(ctx, 'CABLE_ENDPOINT', link.endpointB.shortId) : undefined;
  const portAId = link.endpointA.portKey ? ctx.portIdByKey.get(link.endpointA.portKey) : undefined;
  const portBId = link.endpointB.portKey ? ctx.portIdByKey.get(link.endpointB.portKey) : undefined;
  const panelAId = link.endpointA.panelKey ? ctx.panelIdByKey.get(link.endpointA.panelKey) : undefined;
  const panelBId = link.endpointB.panelKey ? ctx.panelIdByKey.get(link.endpointB.panelKey) : undefined;

  if (!isCommit) {
    ctx.stats.cables += 1;
    ctx.stats.endpoints += 2;
    log('cable', `将创建 ${link.key} (${link.status})`);
    return;
  }

  const inventoryStatus = link.status === 'RESOLVED' && portAId && portBId ? 'IN_USE' : 'INVENTORIED';
  const cable = await prisma.cable.create({
    data: {
      label: link.key,
      type: link.cableType,
      length: link.lengthMeters || null,
      notes: link.notes || null,
      inventoryStatus,
    },
  });
  ctx.stats.cables += 1;

  const endpointA = await prisma.cableEndpoint.create({
    data: {
      cableId: cable.id,
      endType: 'A',
      panelId: portAId ? undefined : panelAId || null,
      portId: portAId || null,
      shortId: shortIdA || null,
    },
  });
  ctx.stats.endpoints += 1;
  if (shortIdA) {
    await bindShortIdEntity(shortIdA, 'CABLE_ENDPOINT', endpointA.id);
  }

  const endpointB = await prisma.cableEndpoint.create({
    data: {
      cableId: cable.id,
      endType: 'B',
      panelId: portBId ? undefined : panelBId || null,
      portId: portBId || null,
      shortId: shortIdB || null,
    },
  });
  ctx.stats.endpoints += 1;
  if (shortIdB) {
    await bindShortIdEntity(shortIdB, 'CABLE_ENDPOINT', endpointB.id);
  }

  if (portAId && portBId) {
    await prisma.port.update({
      where: { id: portAId },
      data: { status: 'OCCUPIED' as PortStatus, physicalStatus: 'CONNECTED' as PhysicalStatus },
    });
    await prisma.port.update({
      where: { id: portBId },
      data: { status: 'OCCUPIED' as PortStatus, physicalStatus: 'CONNECTED' as PhysicalStatus },
    });
    await cableGraphService.createConnection({
      cableId: cable.id,
      portAId,
      portBId,
      cableData: {
        label: cable.label || undefined,
        type: cable.type,
        length: cable.length || undefined,
      },
    });
  }

  log('cable', `创建 ${link.key} (${inventoryStatus})`);
}

async function ensureExternalHostRoom(ctx: ImportContext, loc: NormalizedExternalLocation, dataCenterId: string): Promise<{ roomId: string; cabinetId: string }> {
  const roomKey = `room:${loc.key}`;
  const cabinetKey = `cabinet:${loc.key}`;

  let roomId = ctx.roomIdByKey.get(roomKey);
  if (!roomId) {
    const fakeRoom: NormalizedRoom = {
      key: roomKey,
      name: loc.name,
      floor: null,
      shortId: null,
      notes: `${loc.name} 外部设备承载机房（自动生成）`,
      cabinets: [],
    };
    roomId = await ensureRoom(ctx, fakeRoom, dataCenterId);
  }

  let cabinetId = ctx.cabinetIdByKey.get(cabinetKey);
  if (!cabinetId) {
    const fakeCabinet: NormalizedCabinet = {
      key: cabinetKey,
      name: `${loc.name} 虚拟机柜`,
      shortId: null,
      position: null || undefined,
      height: 42,
      notes: `${loc.name} 外部设备承载机柜（自动生成）`,
    };
    cabinetId = await ensureCabinet(ctx, fakeCabinet, roomId);
  }
  return { roomId, cabinetId };
}

async function main() {
  const doc = loadDocument();
  console.log(`\n加载数据: ${dataPath}`);
  console.log(`模式: ${isCommit ? 'COMMIT' : 'DRY-RUN'}`);

  const issues = await validateNoConflicts(doc);
  if (issues.length) {
    console.log('\n检测到潜在冲突：');
    for (const msg of issues) console.log(`  - ${msg}`);
    if (isCommit) {
      console.log('\n检测到冲突，终止 COMMIT。请先解决后再执行。');
      process.exitCode = 2;
      return;
    }
  }

  const ctx = createContext();
  for (const sid of gatherExplicitShortIds(doc)) ctx.reservedShortIds.add(sid);
  await initializeShortIdCursor(ctx);

  phase('基础结构');
  const dataCenterId = await ensureDataCenter(ctx, doc.dataCenter);

  let roomIndex = 0;
  const totalCabinets = doc.rooms.reduce((sum, room) => sum + room.cabinets.length, 0);
  let cabinetIndex = 0;
  for (const room of doc.rooms) {
    roomIndex += 1;
    progress('机房', roomIndex, doc.rooms.length, room.name);
    const roomId = await ensureRoom(ctx, room, dataCenterId);
    for (const cabinet of room.cabinets) {
      cabinetIndex += 1;
      progress('机柜', cabinetIndex, totalCabinets, cabinet.name);
      await ensureCabinet(ctx, cabinet, roomId);
    }
  }

  phase('子网');
  for (let index = 0; index < doc.subnets.length; index += 1) {
    const subnet = doc.subnets[index];
    progress('子网', index + 1, doc.subnets.length, `${subnet.network}/${subnet.cidr}`);
    await ensureSubnet(ctx, subnet);
  }

  phase('设备 / 面板 / 端口 / IP');
  const allTopDevices = [...doc.devices, ...doc.externalLocations.flatMap(loc => loc.devices)];
  let deviceIndex = 0;
  for (const device of doc.devices) {
    deviceIndex += 1;
    progress('设备', deviceIndex, allTopDevices.length, device.name);
    const cabinetId = device.cabinetKey ? ctx.cabinetIdByKey.get(device.cabinetKey) : undefined;
    if (!cabinetId) {
      log('device', `跳过 ${device.name}: 未找到机柜 ${device.cabinetKey}`);
      continue;
    }
    await ensureDevice(ctx, device, cabinetId);
    for (const ip of device.ipAssignments || []) {
      await ensureIpAddress(ctx, ip, { deviceId: ctx.deviceIdByKey.get(device.key) });
    }
  }

  for (const location of doc.externalLocations) {
    const { cabinetId } = await ensureExternalHostRoom(ctx, location, dataCenterId);
    for (const device of location.devices) {
      deviceIndex += 1;
      progress('设备', deviceIndex, allTopDevices.length, device.name);
      await ensureDevice(ctx, device, cabinetId);
      for (const ip of device.ipAssignments || []) {
        await ensureIpAddress(ctx, ip, { deviceId: ctx.deviceIdByKey.get(device.key) });
      }
      for (const logical of device.logicalInterfaces || []) {
        for (const ip of logical.ipAssignments || []) {
          await ensureIpAddress(ctx, ip, {
            deviceId: ctx.deviceIdByKey.get(device.key),
            description: `逻辑接口 ${logical.name}`,
          });
        }
      }
    }
  }

  phase('虚拟地址');
  for (let index = 0; index < (doc.virtualIpAssignments || []).length; index += 1) {
    const ip = doc.virtualIpAssignments![index];
    progress('虚拟IP', index + 1, doc.virtualIpAssignments!.length, ip.address);
    await ensureIpAddress(ctx, {
      address: ip.address,
      cidr: ip.cidr,
      subnetKey: ip.subnetKey,
      role: ip.status ? `${ip.name} (${ip.status})` : ip.name,
    }, { description: '虚拟地址' });
  }

  phase('线缆 / 插头');
  for (let index = 0; index < doc.links.length; index += 1) {
    const link = doc.links[index];
    progress('线缆', index + 1, doc.links.length, link.key);
    await createLink(ctx, link);
  }

  console.log('\n=== 导入汇总 ===');
  console.log(JSON.stringify(ctx.stats, null, 2));
  if (doc.unresolvedLinks.length) {
    console.log('\n未解决连接:');
    for (const u of doc.unresolvedLinks) console.log(`  - ${u.key}: ${u.reason}`);
  }
  if (!isCommit) {
    console.log('\n当前为 DRY-RUN，未修改数据库。加 --commit 才会写库。');
  }
}

main()
  .catch((err) => {
    console.error('导入失败:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
