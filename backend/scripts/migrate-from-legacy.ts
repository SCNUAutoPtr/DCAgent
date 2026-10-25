/**
 * Migrates the restored legacy database (dcagent_legacy, read-only source) into the new schema.
 *
 *   npm run migrate:legacy -- --target=test            dry run against dcagent_test (rolled back)
 *   npm run migrate:legacy -- --target=test --apply
 *   npm run migrate:legacy -- --target=prod --apply    real database (.env)
 *   ... --target=prod --apply --overwrite-live         also when the real database changed since the last migration
 *
 * Repeatable: every run truncates the business tables of the target and rebuilds them from legacy
 * inside ONE transaction. On --target=prod --apply the target must be empty or still hold exactly
 * what the last committed prod migration wrote (same digest); anything entered since then would be
 * wiped, so the run refuses unless --overwrite-live is given. Ids of legacy rows are kept; ids and timestamps of rows created by the
 * migration are deterministic, so two runs produce identical tables (see report.digest).
 * Reconciliation runs inside the transaction after all deferred constraints were checked; any red
 * item rolls everything back and the process exits non-zero.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';
import { assertNotLegacy, dbName, withDb } from './lib/assertDb';
import { compareNeo4jExport, parseNeo4jExport } from './lib/neo4jExport';
import { normalizeIfName, sysnameKey, trailingNumber } from '../src/contracts/ifName';
import { formatShortId } from '../src/contracts/labels';
import { isOnline } from '../src/contracts/workstations';
import { CABLE_MEDIA, PANEL_TYPES, PORT_TYPES } from '../src/contracts/enums';
import type { CableMedium, LabelKind, PanelType, PortType } from '../src/contracts/enums';

// ---------------------------------------------------------------------------
// configuration
// ---------------------------------------------------------------------------

const ROOT = path.resolve(__dirname, '..');
const MIGRATION_AT = new Date('2026-10-25T00:00:00.000Z');
const NEW_LABEL_NOTE = '迁移补号 20261025';
const NEW_LABEL_BATCH = 'migration_20261025';
/** Explicit sysname overrides: device name -> sysname. */
const SYSNAME_OVERRIDES: Record<string, string> = { 'F13 核心交换机': '445C-F13' };
const SYSNAME_RE = /^(\S+-U\d+|\d+stack)\s/;
/** Legacy Device.model values that are not models: the device gets no DeviceModel, the text moves into its notes. */
const PLACEHOLDER_MODELS = new Set(['未确认', '待确认', '未知', '台式机', '-', '?']);
const LEGACY_MODEL_NOTE = '迁移前型号字段：';
/**
 * Model heights from the vendor spec, for models where no legacy device of that model had a height.
 * Lenovo ThinkSystem SR650 is a 2U server.
 */
const KNOWN_MODEL_HEIGHTS: Record<string, number> = { SR650: 2 };
/** Read-only Neo4j export taken before the refactor; only used as evidence, never migrated. */
const NEO4J_BACKUP = path.resolve(__dirname, '..', '..', 'db-backups', 'neo4j-before-night-modernize-20261025-0057.cypher');

type Json = Record<string, unknown>;
type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function args() {
  const a = process.argv.slice(2);
  const target = a.find((x) => x.startsWith('--target='))?.split('=')[1];
  if (target !== 'test' && target !== 'prod') throw new Error('usage: migrate-from-legacy --target=test|prod [--apply] [--overwrite-live]');
  return { target, apply: a.includes('--apply'), overwriteLive: a.includes('--overwrite-live') } as const;
}

/** Deterministic uuid (md5 based) for rows the migration creates. */
function uuidFrom(key: string): string {
  const h = createHash('md5').update(`dcagent-migration:${key}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const md5 = (v: unknown) => createHash('md5').update(JSON.stringify(v)).digest('hex');

class Abort extends Error {}
class Rollback extends Error {}
class LiveDataChanged extends Error {}

function check(cond: unknown, message: string, details?: unknown): asserts cond {
  if (!cond) throw new Abort(`${message}${details === undefined ? '' : `: ${JSON.stringify(details).slice(0, 2000)}`}`);
}

const byId = <T extends Row>(rows: T[]) => new Map(rows.map((r) => [r.id as string, r]));
const sortBy = <T>(rows: T[], key: (r: T) => string) => [...rows].sort((a, b) => key(a).localeCompare(key(b)));
const asObj = (v: unknown): Json | null => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null);
const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ---------------------------------------------------------------------------
// legacy read (raw SQL only, the old schema has no Prisma types)
// ---------------------------------------------------------------------------

const LEGACY_TABLES = [
  'DataCenter', 'Room', 'Cabinet', 'Device', 'Panel', 'Port', 'Cable', 'CableEndpoint', 'ShortIdPool', 'CableShortIdPool',
  'PrintTask', 'OpticalModule', 'ModuleMovement', 'PanelTemplate', 'IpSubnet', 'IpAddress', 'Workstation', 'PortObservation',
] as const;
type LegacyTable = (typeof LEGACY_TABLES)[number];
type Legacy = Record<LegacyTable, Row[]>;

async function readLegacy(db: PrismaClient): Promise<Legacy> {
  const out = {} as Legacy;
  for (const t of LEGACY_TABLES) {
    out[t] = await db.$queryRawUnsafe<Row[]>(`SELECT * FROM "${t}" ORDER BY "id"`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// transformation (pure)
// ---------------------------------------------------------------------------

const KIND_OF: Record<string, LabelKind> = { ROOM: 'ROOM', CABINET: 'CABINET', PANEL: 'PANEL', CABLE_ENDPOINT: 'CABLE_ENDPOINT' };
const FK_OF: Record<LabelKind, 'roomId' | 'cabinetId' | 'panelId' | 'cableEndpointId'> = {
  ROOM: 'roomId',
  CABINET: 'cabinetId',
  PANEL: 'panelId',
  CABLE_ENDPOINT: 'cableEndpointId',
};

/** Legacy model string -> catalog model name, or null when it is empty or a placeholder. */
function modelNameOf(raw: unknown): string | null {
  const m = typeof raw === 'string' ? raw.trim() : '';
  return m && !PLACEHOLDER_MODELS.has(m) ? m : null;
}

/** Notes of a migrated device: legacy notes plus the placeholder model text, so nothing typed in is lost. */
function deviceNotesOf(notes: string | null, rawModel: unknown): string | null {
  const m = typeof rawModel === 'string' ? rawModel.trim() : '';
  if (!m || modelNameOf(m)) return notes;
  return [notes, `${LEGACY_MODEL_NOTE}${m}`].filter(Boolean).join('\n');
}

/** Inverse of deviceNotesOf, for reconciliation: [legacy notes, placeholder model text]. */
function splitDeviceNotes(notes: string | null): [string | null, string | null] {
  if (!notes) return [null, null];
  const lines = notes.split('\n');
  const last = lines[lines.length - 1];
  if (!last.startsWith(LEGACY_MODEL_NOTE)) return [notes, null];
  const rest = lines.slice(0, -1).join('\n');
  return [rest || null, last.slice(LEGACY_MODEL_NOTE.length)];
}

function sysnameOf(name: string): string | null {
  if (SYSNAME_OVERRIDES[name]) return SYSNAME_OVERRIDES[name];
  const m = SYSNAME_RE.exec(name);
  return m ? m[1] : null;
}

function portTypeOf(raw: unknown): PortType | null {
  if (typeof raw !== 'string') return null;
  const s = raw.trim().toUpperCase().replace(/\+/g, '_PLUS').replace(/[-\s]/g, '_');
  return (PORT_TYPES as readonly string[]).includes(s) ? (s as PortType) : null;
}

function ifNameOf(number: string, device: { sysname: string | null; type: string }): string | null {
  if (!device.sysname || device.type !== 'SWITCH' || /stack/i.test(device.sysname)) return null;
  let m = /^ge(\d+)$/i.exec(number);
  if (m) return `GigabitEthernet0/0/${Number(m[1])}`;
  m = /^xge(\d+)$/i.exec(number);
  if (m) return `XGigabitEthernet0/0/${Number(m[1])}`;
  return null;
}

function dnsList(v: unknown): string[] {
  let x: unknown = v;
  for (let i = 0; i < 3 && typeof x === 'string'; i++) {
    try {
      x = JSON.parse(x);
    } catch {
      return (x as string).split(/[,\s]+/).filter(Boolean);
    }
  }
  return Array.isArray(x) ? x.map(String) : [];
}

const net24 = (ip: string) => `${ip.split('.').slice(0, 3).join('.')}.0/24`;

function ipInNet(ip: string, cidr: string): boolean {
  const toInt = (s: string) => s.split('.').reduce((a, b) => ((a << 8) | Number(b)) >>> 0, 0);
  const [net, len] = cidr.split('/');
  const mask = Number(len) === 0 ? 0 : (0xffffffff << (32 - Number(len))) >>> 0;
  return ((toInt(ip) & mask) >>> 0) === ((toInt(net) & mask) >>> 0);
}

interface Plan {
  dataCenters: Row[];
  rooms: Row[];
  cabinets: Row[];
  deviceModels: Row[];
  devices: Row[];
  panels: Row[];
  ports: Row[];
  cables: Row[];
  endpoints: Row[];
  labels: Row[];
  newLabels: { shortId: number; kind: LabelKind; id: string; path: string }[];
  subnets: Row[];
  newSubnets: Row[];
  ipAddresses: Row[];
  workstationIps: Row[];
  workstations: Row[];
  observations: Row[];
  unmatched: Row[];
  notes: Json;
}

function transform(L: Legacy): Plan {
  // ---- preflight ----
  for (const t of ['CableShortIdPool', 'PrintTask', 'OpticalModule', 'ModuleMovement', 'PanelTemplate'] as const) {
    check(L[t].length === 0, `${t} must be empty before migration (found ${L[t].length})`);
  }
  const roomById = byId(L.Room);
  const cabinetById = byId(L.Cabinet);
  const deviceById = byId(L.Device);
  const panelById = byId(L.Panel);
  const portById = byId(L.Port);
  const cableById = byId(L.Cable);

  // shortIds on entity tables must equal the BOUND pool records, one to one
  const entityShortIds = [
    ...L.Room.filter((r) => r.shortId !== null).map((r) => `ROOM:${r.id}:${r.shortId}`),
    ...L.Cabinet.filter((r) => r.shortId !== null).map((r) => `CABINET:${r.id}:${r.shortId}`),
    ...L.Panel.filter((r) => r.shortId !== null).map((r) => `PANEL:${r.id}:${r.shortId}`),
    ...L.CableEndpoint.filter((r) => r.shortId !== null).map((r) => `CABLE_ENDPOINT:${r.id}:${r.shortId}`),
  ].sort();
  const bound = L.ShortIdPool.filter((p) => p.status === 'BOUND');
  const poolShortIds = bound.map((p) => `${p.entityType}:${p.entityId}:${p.shortId}`).sort();
  check(
    JSON.stringify(entityShortIds) === JSON.stringify(poolShortIds),
    'entity shortIds and BOUND pool records differ',
    { onlyEntity: entityShortIds.filter((x) => !poolShortIds.includes(x)), onlyPool: poolShortIds.filter((x) => !entityShortIds.includes(x)) },
  );
  for (const p of bound) check(KIND_OF[p.entityType], 'unsupported bound entity type', p);

  const wsNames = new Set<string>();
  for (const w of L.Workstation) {
    const k = `${w.roomId}:${w.name}`;
    check(!wsNames.has(k), 'duplicate workstation name in a room', k);
    wsNames.add(k);
  }

  // ---- hierarchy ----
  const ts = (r: Row) => ({ createdAt: r.createdAt, updatedAt: r.updatedAt ?? r.createdAt });
  const dataCenters = L.DataCenter.map((d) => ({ id: d.id, name: d.name, location: d.location, ...ts(d) }));
  const rooms = L.Room.map((r) => ({
    id: r.id, name: r.name, floor: r.floor, notes: r.notes, dataCenterId: r.dataCenterId,
    widthM: r.floorPlanWidth, depthM: r.floorPlanHeight, ...ts(r),
  }));
  const cabinets = L.Cabinet.map((c) => {
    const pos = asObj(c.floorPlanPosition);
    const size = asObj(c.floorPlanSize);
    return {
      id: c.id, name: c.name, positionCode: c.position, heightU: c.height, notes: c.notes, roomId: c.roomId,
      fpX: num(pos?.x), fpY: num(pos?.y), fpW: num(size?.width), fpD: num(size?.depth), fpRotation: 0, ...ts(c),
    };
  });

  // ---- device models + devices ----
  // catalog = distinct real model strings; height = the most common known height of its devices, else the vendor spec, else unknown
  const modelRows = new Map<string, Row[]>();
  for (const d of sortBy(L.Device, (d) => `${new Date(d.createdAt).toISOString()}|${d.id}`)) {
    const m = modelNameOf(d.model);
    if (m) modelRows.set(m, [...(modelRows.get(m) ?? []), d]);
  }
  const modelHeightConflicts: Record<string, number[]> = {};
  const deviceModels = [...modelRows.entries()].map(([name, rows]) => {
    const heights = rows.map((d) => d.uHeight).filter((h): h is number => typeof h === 'number');
    const freq = new Map<number, number>();
    for (const h of heights) freq.set(h, (freq.get(h) ?? 0) + 1);
    const distinct = [...freq.keys()];
    if (distinct.length > 1) modelHeightConflicts[name] = distinct.sort((a, b) => a - b);
    const common = [...freq.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
    return {
      id: uuidFrom(`DeviceModel:${name}`), vendor: '', name, deviceType: rows[0].type, uHeight: common ?? KNOWN_MODEL_HEIGHTS[name] ?? null,
      depthMm: null, notes: null, createdAt: MIGRATION_AT, updatedAt: MIGRATION_AT,
    };
  });
  const modelId = new Map(deviceModels.map((m) => [m.name, m.id]));
  const devices = L.Device.map((d) => {
    const m = modelNameOf(d.model);
    return {
      id: d.id, name: d.name, type: d.type, deviceModelId: m ? modelId.get(m)! : null,
      serialNo: d.serialNo, sysname: sysnameOf(d.name), cabinetId: d.cabinetId, roomId: null,
      // unknown stays unknown: no default height is invented
      uPosition: d.uPosition, uHeight: d.uHeight, notes: deviceNotesOf(d.notes, d.model), ...ts(d),
    };
  });
  const newDeviceById = byId(devices);

  // ---- panels + ports ----
  const panels = L.Panel.map((p) => {
    check((PANEL_TYPES as readonly string[]).includes(p.type), 'unknown panel type', p.type);
    check(!p.templateId && p.position === null && p.size === null && !p.image && !p.svgPath && !p.backgroundColor, 'panel has layout/visual data that would be dropped', p.id);
    return {
      id: p.id, name: p.name, type: p.type as PanelType, face: String(p.name).includes('后') ? 'REAR' : 'FRONT', notes: p.notes,
      deviceId: p.deviceId, templateId: null, templateRevision: null, widthMm: null, heightMm: null, ...ts(p),
    };
  });
  const portsByPanel = new Map<string, Row[]>();
  for (const p of sortBy(L.Port, (p) => `${new Date(p.createdAt).toISOString()}|${p.id}`)) {
    if (!portsByPanel.has(p.panelId)) portsByPanel.set(p.panelId, []);
    portsByPanel.get(p.panelId)!.push(p);
  }
  const ports: Row[] = [];
  const ifNameReport: Record<string, number> = {};
  for (const [panelId, rows] of portsByPanel) {
    const maxNumeric = Math.max(0, ...rows.map((r) => trailingNumber(r.number) ?? 0));
    let extra = 0;
    const device = newDeviceById.get(panelById.get(panelId)!.deviceId)!;
    for (const p of rows) {
      const portType = portTypeOf(p.portType);
      check(portType, 'unknown port type', { id: p.id, portType: p.portType });
      check(p.position === null && p.size === null, 'port has layout data that would be dropped', p.id);
      const rotation = Number(p.rotation ?? 0);
      check([0, 90, 180, 270].includes(rotation), 'port rotation is not a quarter turn', p.id);
      const ifName = ifNameOf(p.number, device);
      if (ifName) ifNameReport[device.sysname!] = (ifNameReport[device.sysname!] ?? 0) + 1;
      ports.push({
        id: p.id, panelId, number: p.number, sortIndex: trailingNumber(p.number) ?? maxNumeric + ++extra, ifName, portType,
        label: p.label, adminState: p.status === 'RESERVED' || p.status === 'FAULTY' ? p.status : 'NORMAL', notes: p.notes,
        xMm: null, yMm: null, wMm: null, hMm: null, rotation, ...ts(p),
      });
    }
  }

  // ---- cables + ends ----
  const cables = L.Cable.map((c) => {
    check((CABLE_MEDIA as readonly string[]).includes(c.type), 'cable type has no medium', { id: c.id, type: c.type });
    return { id: c.id, medium: c.type as CableMedium, label: c.label, lengthM: c.length, color: c.color, notes: c.notes, ...ts(c) };
  });
  const endpoints = L.CableEndpoint.map((e) => {
    check(e.endType === 'A' || e.endType === 'B', 'cable end is neither A nor B', e);
    if (e.portId && e.panelId) check(portById.get(e.portId)?.panelId === e.panelId, 'endpoint panelId differs from its port panel', e.id);
    const medium = cableById.get(e.cableId)!.type as string;
    return {
      id: e.id, cableId: e.cableId, end: e.endType, connector: medium.startsWith('CAT') ? 'RJ45' : null,
      portId: e.portId, parkedPanelId: e.portId ? null : e.panelId, notes: e.notes,
      createdAt: e.createdAt, updatedAt: e.createdAt,
    };
  });

  // ---- labels ----
  const labels = L.ShortIdPool.map((p) => {
    check(['GENERATED', 'PRINTED', 'BOUND', 'CANCELLED'].includes(p.status), 'unknown pool status', p);
    const isBound = p.status === 'BOUND';
    const printed = !!(p.printedAt || p.printTaskId) || p.status === 'PRINTED';
    const fk = isBound ? { [FK_OF[KIND_OF[p.entityType]]]: p.entityId } : {};
    return {
      shortId: p.shortId,
      state: p.status === 'CANCELLED' ? 'VOID' : printed ? 'PRINTED' : 'GENERATED',
      printTaskId: p.printTaskId, printedAt: p.printedAt, batchNo: p.batchNo, notes: p.notes,
      // a label that was ever stuck on something keeps that fact, so autoAllocate skips it
      firstBoundAt: isBound ? (p.boundAt ?? p.updatedAt) : p.boundAt,
      boundAt: p.boundAt ?? (isBound ? p.updatedAt : null),
      roomId: null, cabinetId: null, panelId: null, cableEndpointId: null, ...fk,
      createdAt: p.createdAt, updatedAt: p.updatedAt,
    };
  });
  const labelled = new Set(bound.map((p) => p.entityId as string));
  let next = Math.max(0, ...L.ShortIdPool.map((p) => p.shortId as number)) + 1;
  const newLabels: Plan['newLabels'] = [];
  const pathOfDevice = (id: string) => {
    const d = deviceById.get(id)!;
    const c = cabinetById.get(d.cabinetId)!;
    return `${roomById.get(c.roomId)!.name} / ${c.name} / ${d.name}`;
  };
  for (const c of sortBy(L.Cabinet.filter((c) => !labelled.has(c.id)), (c) => c.id)) {
    newLabels.push({ shortId: next++, kind: 'CABINET', id: c.id, path: `${roomById.get(c.roomId)!.name} / ${c.name}` });
  }
  for (const p of sortBy(L.Panel.filter((p) => !labelled.has(p.id)), (p) => p.id)) {
    newLabels.push({ shortId: next++, kind: 'PANEL', id: p.id, path: `${pathOfDevice(p.deviceId)} / ${p.name}` });
  }
  for (const e of sortBy(L.CableEndpoint.filter((e) => !labelled.has(e.id)), (e) => e.id)) {
    const port = e.portId ? portById.get(e.portId) : null;
    const panel = panelById.get(port?.panelId ?? e.panelId);
    const where = panel ? `${pathOfDevice(panel.deviceId)} / ${panel.name}${port ? ` / ${port.number}` : ''}` : '';
    newLabels.push({ shortId: next++, kind: 'CABLE_ENDPOINT', id: e.id, path: `${where} [${cableById.get(e.cableId)!.label ?? 'cable'} ${e.endType}]` });
  }
  for (const n of newLabels) {
    labels.push({
      shortId: n.shortId, state: 'GENERATED', printTaskId: null, printedAt: null, batchNo: NEW_LABEL_BATCH, notes: NEW_LABEL_NOTE,
      firstBoundAt: MIGRATION_AT, boundAt: MIGRATION_AT, roomId: null, cabinetId: null, panelId: null, cableEndpointId: null,
      [FK_OF[n.kind]]: n.id, createdAt: MIGRATION_AT, updatedAt: MIGRATION_AT,
    });
  }

  // ---- IP ----
  const subnets = L.IpSubnet.map((s) => {
    const vlan = s.vlan === null || s.vlan === '' ? null : Number(s.vlan);
    check(vlan === null || (Number.isInteger(vlan) && vlan >= 1 && vlan <= 4094), 'vlan is not 1..4094', s);
    return {
      id: s.id, name: s.name, network: s.network, prefixLen: Number(s.cidr), gateway: s.gateway, vlan, dnsServers: dnsList(s.dnsServers),
      description: s.description, roomId: s.roomId, ...ts(s),
    };
  });
  const cidrOf = (s: Row) => `${s.network}/${s.prefixLen}`;
  const allNets = [...subnets.map(cidrOf)];
  const wsWithIp = L.Workstation.filter((w) => w.ipAddress);
  const newSubnets: Row[] = [];
  for (const net of [...new Set(wsWithIp.map((w) => net24(w.ipAddress)))].sort()) {
    if (allNets.some((n) => wsWithIp.filter((w) => net24(w.ipAddress) === net).every((w) => ipInNet(w.ipAddress, n)))) continue;
    const roomIds = [...new Set(wsWithIp.filter((w) => net24(w.ipAddress) === net).map((w) => w.roomId))];
    newSubnets.push({
      id: uuidFrom(`IpSubnet:${net}`), name: `教室终端 ${net}（迁移自动建）`, network: net.split('/')[0], prefixLen: 24, gateway: null, vlan: null, dnsServers: [],
      description: 'created by migrate-from-legacy for workstation addresses', roomId: roomIds.length === 1 ? roomIds[0] : null,
      createdAt: MIGRATION_AT, updatedAt: MIGRATION_AT,
    });
    allNets.push(net);
  }
  const subnetOf = (ip: string) => {
    const all = [...subnets, ...newSubnets].filter((s) => ipInNet(ip, cidrOf(s)));
    return all.sort((a, b) => b.prefixLen - a.prefixLen)[0];
  };

  const ipAddresses = L.IpAddress.map((a) => {
    check(a.status !== 'FREE', 'legacy FREE address rows would disappear', a);
    if (a.portId && a.deviceId) {
      const panel = panelById.get(portById.get(a.portId)!.panelId)!;
      check(panel.deviceId === a.deviceId, 'ip bound to a port of another device', a);
    }
    return {
      id: a.id, subnetId: a.subnetId, address: a.address, status: a.status, portId: a.portId,
      deviceId: a.portId ? null : a.deviceId, workstationId: null, hostname: a.hostname, macAddress: a.macAddress,
      description: a.description, ...ts(a),
    };
  });
  const taken = new Set(ipAddresses.map((a) => `${a.subnetId}:${a.address}`));
  const workstationIps = wsWithIp.map((w) => {
    const s = subnetOf(w.ipAddress);
    check(s, 'no subnet for workstation address', w.ipAddress);
    check(!taken.has(`${s.id}:${w.ipAddress}`), 'workstation address already allocated', w.ipAddress);
    taken.add(`${s.id}:${w.ipAddress}`);
    return {
      id: uuidFrom(`IpAddress:workstation:${w.id}`), subnetId: s.id, address: w.ipAddress, status: 'ALLOCATED', portId: null,
      deviceId: null, workstationId: w.id, hostname: null, macAddress: w.macAddress, description: null,
      createdAt: w.createdAt, updatedAt: w.updatedAt,
    };
  });
  const orphanMac = L.Workstation.filter((w) => !w.ipAddress && w.macAddress);
  check(orphanMac.length === 0, 'workstation has a MAC but no IP; nowhere to keep it', orphanMac.map((w) => w.id));

  // ---- sysname resolution ----
  const sysDevices = devices.filter((d) => d.sysname);
  const deviceBySys = (raw: string | null) => {
    if (!raw) return null;
    return sysDevices.find((d) => d.sysname === raw) ?? sysDevices.find((d) => sysnameKey(d.sysname!) === sysnameKey(raw)) ?? null;
  };
  const portByDevIf = new Map<string, string>();
  for (const p of ports) if (p.ifName) portByDevIf.set(`${panelById.get(p.panelId)!.deviceId}|${p.ifName}`, p.id);

  // ---- workstations ----
  const unmatched: Row[] = [];
  let attachResolved = 0;
  const workstations = L.Workstation.map((w) => {
    check(['ONLINE', 'OFFLINE', 'IN_USE', 'IDLE', 'MAINTENANCE', 'FAULTY'].includes(w.status), 'unknown workstation status', w);
    const pos = asObj(w.floorPlanPosition);
    const size = asObj(w.floorPlanSize);
    let attachedPortId: string | null = null;
    if (w.switchName || w.switchPort) {
      const dev = deviceBySys(w.switchName);
      const portId = dev && w.switchPort ? portByDevIf.get(`${dev.id}|${normalizeIfName(w.switchPort)}`) ?? null : null;
      if (portId) {
        attachedPortId = portId;
        attachResolved++;
      } else {
        unmatched.push({
          id: uuidFrom(`ObservationUnmatched:workstation:${w.id}`), source: 'WORKSTATION_ATTACH', sysname: w.switchName ?? '',
          ifName: w.switchPort, workstationId: w.id,
          payload: { switchName: w.switchName, switchPort: w.switchPort, reason: dev ? 'PORT_NOT_FOUND' : 'DEVICE_NOT_FOUND', legacyWorkstationId: w.id },
          createdAt: w.updatedAt,
        });
      }
    }
    const online = w.status === 'ONLINE';
    return {
      id: w.id, name: w.name, code: w.code, roomId: w.roomId, cpu: w.cpu, memory: w.memory, storage: w.storage, gpu: w.gpu, os: w.os,
      adminState: w.status === 'MAINTENANCE' || w.status === 'FAULTY' ? w.status : 'ACTIVE', assignedTo: w.assignedTo,
      fpX: num(pos?.x), fpY: num(pos?.y), fpW: num(size?.width), fpD: num(size?.depth), notes: w.notes, attachedPortId,
      lastSeenAt: w.lastSeenAt,
      // online rows were checked when last seen; offline rows that were ever seen were checked when the row was last written;
      // rows never seen have no probe on record
      lastCheckedAt: online ? w.lastSeenAt : w.lastSeenAt ? w.updatedAt : null,
      ...ts(w),
    };
  });

  // ---- observations ----
  const observations: Row[] = [];
  for (const o of L.PortObservation) {
    const dev = o.deviceId ? newDeviceById.get(o.deviceId) ?? null : deviceBySys(o.switchName);
    const base = {
      phy: o.phy, inUtilPercent: o.inUtilPercent, outUtilPercent: o.outUtilPercent, inErrors: o.inErrors, outErrors: o.outErrors,
      rxPowerDbm: o.rxPowerDbm, txPowerDbm: o.txPowerDbm, rxLowAlarmDbm: o.rxLowAlarmDbm, rxLowWarnDbm: o.rxLowWarnDbm,
    };
    if (dev) {
      observations.push({
        id: o.id, deviceId: dev.id, portId: portByDevIf.get(`${dev.id}|${normalizeIfName(o.interface)}`) ?? null,
        ifName: o.interface, ...base, collectedAt: o.collectedAt,
      });
    } else {
      unmatched.push({
        id: uuidFrom(`ObservationUnmatched:observation:${o.id}`), source: 'PORT_OBSERVATION', sysname: o.switchName, ifName: o.interface,
        workstationId: null, payload: { id: o.id, ifName: o.interface, ...base, collectedAt: new Date(o.collectedAt).toISOString() },
        createdAt: o.collectedAt,
      });
    }
  }

  return {
    dataCenters, rooms, cabinets, deviceModels, devices, panels, ports, cables, endpoints, labels, newLabels, subnets, newSubnets,
    ipAddresses, workstationIps, workstations, observations, unmatched,
    notes: {
      sysnames: Object.fromEntries(devices.filter((d) => d.sysname).map((d) => [d.name, d.sysname])),
      sysnameOverrides: SYSNAME_OVERRIDES,
      ifNamesGeneratedPerSwitch: ifNameReport,
      workstationsAttached: attachResolved,
      workstationAttachUnmatched: unmatched.filter((u) => u.source === 'WORKSTATION_ATTACH').length,
      observationsWithPort: observations.filter((o) => o.portId).length,
      deviceModels: deviceModels.map((m) => `${m.name} (${m.deviceType}, ${m.uHeight === null ? 'height unknown' : `${m.uHeight}U`})`),
      deviceModelHeightsFromSpec: deviceModels.filter((m) => !modelRows.get(m.name)!.some((d) => d.uHeight !== null) && m.uHeight !== null).map((m) => `${m.name}: ${m.uHeight}U`),
      deviceModelHeightConflicts: modelHeightConflicts,
      placeholderModels: L.Device.filter((d) => typeof d.model === 'string' && d.model.trim() && !modelNameOf(d.model)).map((d) => `${d.name}: ${d.model.trim()} -> no model, kept in notes`),
      unknownHeightDevices: L.Device.filter((d) => d.uHeight === null).map((d) => `${d.name}${d.uPosition === null ? '' : ` (U${d.uPosition})`}`).sort(),
      previouslyBoundGeneratedLabels: labels.filter((l) => l.state === 'GENERATED' && l.firstBoundAt && !l.roomId && !l.cabinetId && !l.panelId && !l.cableEndpointId).length,
    },
  };
}

// ---------------------------------------------------------------------------
// write
// ---------------------------------------------------------------------------

const NEW_TABLES = [
  'ObservationUnmatched', 'PortObservation', 'ModuleMovement', 'OpticalModule', 'IpAddress', 'IpSubnet', 'Label', 'PrintTask',
  'CableEndpoint', 'Cable', 'Workstation', 'PanelTemplatePort', 'Port', 'Panel', 'PanelTemplate', 'Device', 'DeviceModel', 'Cabinet', 'Room', 'DataCenter',
] as const;

async function write(tx: Prisma.TransactionClient, p: Plan) {
  await tx.$executeRawUnsafe(`TRUNCATE ${NEW_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
  /* eslint-disable @typescript-eslint/no-explicit-any */
  await tx.dataCenter.createMany({ data: p.dataCenters as any });
  await tx.room.createMany({ data: p.rooms as any });
  await tx.cabinet.createMany({ data: p.cabinets as any });
  await tx.deviceModel.createMany({ data: p.deviceModels as any });
  await tx.device.createMany({ data: p.devices as any });
  await tx.panel.createMany({ data: p.panels as any });
  await tx.port.createMany({ data: p.ports as any });
  await tx.cable.createMany({ data: p.cables as any });
  await tx.cableEndpoint.createMany({ data: p.endpoints as any });
  await tx.label.createMany({ data: p.labels as any });
  await tx.ipSubnet.createMany({ data: [...p.subnets, ...p.newSubnets] as any });
  await tx.workstation.createMany({ data: p.workstations as any });
  await tx.ipAddress.createMany({ data: [...p.ipAddresses, ...p.workstationIps] as any });
  await tx.portObservation.createMany({ data: p.observations as any });
  await tx.observationUnmatched.createMany({ data: p.unmatched as any });
  /* eslint-enable @typescript-eslint/no-explicit-any */
  // run the deferred LABEL_REQUIRED triggers now so reconciliation sees a committed-equivalent state
  await tx.$executeRawUnsafe('SET CONSTRAINTS ALL IMMEDIATE');
}

// ---------------------------------------------------------------------------
// reconciliation
// ---------------------------------------------------------------------------

interface Item {
  name: string;
  ok: boolean;
  details?: unknown;
}

const setDiff = (a: string[], b: string[]) => {
  const sb = new Set(b);
  const sa = new Set(a);
  return { missing: a.filter((x) => !sb.has(x)), extra: b.filter((x) => !sa.has(x)) };
};
const sameSet = (name: string, legacy: string[], next: string[]): Item => {
  const d = setDiff(legacy, next);
  return { name, ok: d.missing.length === 0 && d.extra.length === 0 && legacy.length === next.length, details: { legacy: legacy.length, new: next.length, ...d } };
};

const q = <T = Row>(db: Prisma.TransactionClient | PrismaClient, sql: string) => db.$queryRawUnsafe<T[]>(sql);
const iso = (d: unknown) => (d ? new Date(d as string).toISOString() : null);

async function reconcile(tx: Prisma.TransactionClient, L: Legacy, p: Plan) {
  const items: Item[] = [];
  const count = async (t: string) => Number((await q<{ n: bigint }>(tx, `SELECT count(*) AS n FROM "${t}"`))[0].n);

  // (a) row counts
  const expected: [string, string, number, number, string][] = [
    ['DataCenter', 'DataCenter', L.DataCenter.length, L.DataCenter.length, '1:1'],
    ['Room', 'Room', L.Room.length, L.Room.length, '1:1'],
    ['Cabinet', 'Cabinet', L.Cabinet.length, L.Cabinet.length, '1:1 (virtual cabinet kept)'],
    ['(Device.model)', 'DeviceModel', 0, p.deviceModels.length, 'distinct real Device.model strings (placeholders go to notes)'],
    ['Device', 'Device', L.Device.length, L.Device.length, '1:1'],
    ['Panel', 'Panel', L.Panel.length, L.Panel.length, '1:1'],
    ['Port', 'Port', L.Port.length, L.Port.length, '1:1'],
    ['Cable', 'Cable', L.Cable.length, L.Cable.length, '1:1'],
    ['CableEndpoint', 'CableEndpoint', L.CableEndpoint.length, L.CableEndpoint.length, '1:1'],
    ['ShortIdPool', 'Label', L.ShortIdPool.length, L.ShortIdPool.length + p.newLabels.length, `+${p.newLabels.length} new labels for unlabelled cabinets/panels/ends`],
    ['CableShortIdPool', '(dropped)', L.CableShortIdPool.length, 0, 'table removed, was empty'],
    ['IpSubnet', 'IpSubnet', L.IpSubnet.length, L.IpSubnet.length + p.newSubnets.length, `+${p.newSubnets.length} /24 for workstation addresses`],
    ['IpAddress', 'IpAddress', L.IpAddress.length, L.IpAddress.length + p.workstationIps.length, `+${p.workstationIps.length} workstation addresses (from Workstation.ipAddress/macAddress)`],
    ['Workstation', 'Workstation', L.Workstation.length, L.Workstation.length, '1:1'],
    ['PortObservation', 'PortObservation', L.PortObservation.length, p.observations.length, `${L.PortObservation.length - p.observations.length} moved to ObservationUnmatched`],
    ['(switchName/unresolved)', 'ObservationUnmatched', 0, p.unmatched.length, 'unresolved workstation attachments and observations'],
    ['PrintTask', 'PrintTask', L.PrintTask.length, L.PrintTask.length, '1:1'],
    ['OpticalModule', 'OpticalModule', L.OpticalModule.length, L.OpticalModule.length, '1:1'],
    ['ModuleMovement', 'ModuleMovement', L.ModuleMovement.length, L.ModuleMovement.length, '1:1'],
    ['PanelTemplate', 'PanelTemplate', L.PanelTemplate.length, L.PanelTemplate.length, '1:1'],
  ];
  const counts: Json[] = [];
  let countsOk = true;
  for (const [legacyName, newName, legacyN, expectedN, reason] of expected) {
    const actual = newName.startsWith('(') ? 0 : await count(newName);
    const ok = actual === expectedN;
    countsOk &&= ok;
    counts.push({ legacy: legacyName, new: newName, legacyCount: legacyN, newCount: actual, expected: expectedN, delta: actual - legacyN, reason, ok });
  }
  items.push({ name: 'a. row counts', ok: countsOk, details: counts });

  // (b) primary keys
  const ids = async (t: string, where = '') => (await q<{ id: string }>(tx, `SELECT id FROM "${t}" ${where}`)).map((r) => r.id);
  for (const t of ['DataCenter', 'Room', 'Cabinet', 'Device', 'Panel', 'Port', 'Cable', 'CableEndpoint', 'Workstation'] as const) {
    items.push(sameSet(`b. ids ${t}`, L[t].map((r) => r.id), await ids(t)));
  }
  items.push(sameSet('b. ids IpSubnet (legacy rows)', L.IpSubnet.map((r) => r.id), (await ids('IpSubnet')).filter((x) => !p.newSubnets.some((s) => s.id === x))));
  items.push(sameSet('b. ids IpAddress (legacy rows)', L.IpAddress.map((r) => r.id), await ids('IpAddress', 'WHERE "workstationId" IS NULL')));
  const unmatchedObsIds = (await q<{ id: string }>(tx, `SELECT payload->>'id' AS id FROM "ObservationUnmatched" WHERE source = 'PORT_OBSERVATION'`)).map((r) => r.id);
  items.push(sameSet('b. ids PortObservation (+ unmatched payload.id)', L.PortObservation.map((r) => r.id), [...(await ids('PortObservation')), ...unmatchedObsIds]));

  // (c) relation tuples
  const tuples = async (sql: string) => (await q<{ t: string }>(tx, sql)).map((r) => r.t);
  items.push(sameSet(
    'c. (cableId,end,portId)',
    L.CableEndpoint.map((e) => `${e.cableId}|${e.endType}|${e.portId ?? ''}`),
    await tuples(`SELECT concat_ws('|', "cableId", "end"::text, coalesce("portId", '')) AS t FROM "CableEndpoint"`),
  ));
  items.push(sameSet(
    'c. parked (cableId,end,parkedPanelId)',
    L.CableEndpoint.filter((e) => !e.portId).map((e) => `${e.cableId}|${e.endType}|${e.panelId ?? ''}`),
    await tuples(`SELECT concat_ws('|', "cableId", "end"::text, coalesce("parkedPanelId", '')) AS t FROM "CableEndpoint" WHERE "portId" IS NULL`),
  ));
  for (const [t, fk] of [['Port', 'panelId'], ['Panel', 'deviceId'], ['Device', 'cabinetId'], ['Cabinet', 'roomId'], ['Workstation', 'roomId'], ['Room', 'dataCenterId'], ['Cable', 'id']] as const) {
    items.push(sameSet(`c. ${t}.${fk}`, (L[t] as Row[]).map((r) => `${r.id}|${r[fk]}`), await tuples(`SELECT concat_ws('|', id, "${fk}") AS t FROM "${t}"`)));
  }

  // (d) labels
  const oldBindings = L.ShortIdPool.filter((x) => x.status === 'BOUND').map((x) => `${x.shortId}|${x.entityType}|${x.entityId}`);
  const newBindings = await tuples(`
    SELECT concat_ws('|', "shortId", CASE WHEN "roomId" IS NOT NULL THEN 'ROOM' WHEN "cabinetId" IS NOT NULL THEN 'CABINET'
      WHEN "panelId" IS NOT NULL THEN 'PANEL' ELSE 'CABLE_ENDPOINT' END, coalesce("roomId","cabinetId","panelId","cableEndpointId")) AS t
    FROM "Label" WHERE num_nonnulls("roomId","cabinetId","panelId","cableEndpointId") = 1`);
  const lost = setDiff(oldBindings, newBindings).missing;
  items.push({ name: 'd. legacy bindings kept', ok: lost.length === 0, details: { legacy: oldBindings.length, lost } });
  const missing = await q<{ kind: string; n: bigint }>(tx, `
    SELECT 'CABINET' AS kind, count(*) AS n FROM "Cabinet" c WHERE NOT EXISTS (SELECT 1 FROM "Label" l WHERE l."cabinetId" = c.id)
    UNION ALL SELECT 'PANEL', count(*) FROM "Panel" p WHERE NOT EXISTS (SELECT 1 FROM "Label" l WHERE l."panelId" = p.id)
    UNION ALL SELECT 'CABLE_ENDPOINT', count(*) FROM "CableEndpoint" e WHERE NOT EXISTS (SELECT 1 FROM "Label" l WHERE l."cableEndpointId" = e.id)`);
  items.push({ name: 'd. no cabinet/panel/end without label', ok: missing.every((m) => Number(m.n) === 0), details: missing.map((m) => ({ kind: m.kind, n: Number(m.n) })) });
  const labelTotal = await count('Label');
  items.push({ name: 'd. label total = legacy + new', ok: labelTotal === L.ShortIdPool.length + p.newLabels.length, details: { labelTotal, legacy: L.ShortIdPool.length, new: p.newLabels.length } });

  // (e) derived state equals the old cached state
  items.push(sameSet(
    'e. connected ports = legacy OCCUPIED',
    L.Port.filter((x) => x.status === 'OCCUPIED').map((x) => x.id),
    await tuples(`SELECT "portId" AS t FROM "CableEndpoint" WHERE "portId" IS NOT NULL`),
  ));
  const inUse = await tuples(`SELECT c.id AS t FROM "Cable" c WHERE EXISTS (SELECT 1 FROM "CableEndpoint" e WHERE e."cableId" = c.id AND e."portId" IS NOT NULL)`);
  const allCables = await ids('Cable');
  items.push(sameSet('e. IN_USE cables = legacy IN_USE', L.Cable.filter((c) => c.inventoryStatus === 'IN_USE').map((c) => c.id), inUse));
  items.push(sameSet('e. STOCK cables = legacy INVENTORIED/NOT_INVENTORIED', L.Cable.filter((c) => c.inventoryStatus !== 'IN_USE').map((c) => c.id), allCables.filter((x) => !inUse.includes(x))));
  const ws = await q<{ id: string; lastSeenAt: Date | null; lastCheckedAt: Date | null }>(tx, `SELECT id, "lastSeenAt", "lastCheckedAt" FROM "Workstation"`);
  items.push(sameSet('e. online workstations = legacy ONLINE', L.Workstation.filter((w) => w.status === 'ONLINE').map((w) => w.id), ws.filter((w) => isOnline(w.lastSeenAt, w.lastCheckedAt)).map((w) => w.id)));
  items.push(sameSet(
    'e. ip -> device = legacy deviceId',
    L.IpAddress.filter((a) => a.deviceId).map((a) => `${a.id}|${a.deviceId}`),
    await tuples(`SELECT concat_ws('|', a.id, coalesce(a."deviceId", pa."deviceId")) AS t FROM "IpAddress" a
      LEFT JOIN "Port" po ON po.id = a."portId" LEFT JOIN "Panel" pa ON pa.id = po."panelId"
      WHERE a."workstationId" IS NULL AND coalesce(a."deviceId", pa."deviceId") IS NOT NULL`),
  ));
  items.push(sameSet(
    'e. workstation ip/mac moved to IpAddress',
    L.Workstation.filter((w) => w.ipAddress).map((w) => `${w.id}|${w.ipAddress}|${w.macAddress ?? ''}`),
    await tuples(`SELECT concat_ws('|', "workstationId", host("address"), coalesce("macAddress", '')) AS t FROM "IpAddress" WHERE "workstationId" IS NOT NULL`),
  ));

  // (f) business fields per row, md5 of legacy (mapped) vs new
  const modelName = new Map(p.deviceModels.map((m) => [m.id, m.name]));
  const newRows = async (t: string) => byId(await q(tx, `SELECT * FROM "${t}"`));
  const fp = (pos: unknown, size: unknown) => {
    const a = asObj(pos);
    const b = asObj(size);
    return [num(a?.x), num(a?.y), num(b?.width), num(b?.depth)];
  };
  const hashCheck = async (t: string, legacyRows: Row[], fromLegacy: (r: Row) => unknown, fromNew: (r: Row) => unknown) => {
    const n = await newRows(t);
    const bad = legacyRows.filter((r) => !n.has(r.id) || md5(fromLegacy(r)) !== md5(fromNew(n.get(r.id)!))).map((r) => r.id);
    items.push({ name: `f. md5 ${t}`, ok: bad.length === 0, details: { rows: legacyRows.length, mismatched: bad } });
  };
  await hashCheck('DataCenter', L.DataCenter, (r) => [r.name, r.location], (r) => [r.name, r.location]);
  await hashCheck('Room', L.Room, (r) => [r.name, r.floor, r.notes, r.floorPlanWidth, r.floorPlanHeight], (r) => [r.name, r.floor, r.notes, r.widthM, r.depthM]);
  await hashCheck(
    'Cabinet', L.Cabinet,
    (r) => [r.name, r.position, r.height, r.notes, ...fp(r.floorPlanPosition, r.floorPlanSize)],
    (r) => [r.name, r.positionCode, r.heightU, r.notes, r.fpX, r.fpY, r.fpW, r.fpD],
  );
  await hashCheck(
    'Device', L.Device,
    // legacy values as they are (no defaults): the model text is either the catalog model or the note line
    (r) => [r.name, r.type, r.model?.trim() || null, r.serialNo, r.uPosition, r.uHeight, r.notes],
    (r) => {
      const [notes, placeholder] = splitDeviceNotes(r.notes);
      return [r.name, r.type, r.deviceModelId ? modelName.get(r.deviceModelId) : placeholder, r.serialNo, r.uPosition, r.uHeight, notes];
    },
  );
  await hashCheck('Panel', L.Panel, (r) => [r.name, r.type, r.notes], (r) => [r.name, r.type, r.notes]);
  await hashCheck(
    'Port', L.Port,
    (r) => [r.number, r.label, portTypeOf(r.portType), r.notes, Number(r.rotation ?? 0), r.status === 'RESERVED' || r.status === 'FAULTY' ? r.status : 'NORMAL'],
    (r) => [r.number, r.label, r.portType, r.notes, r.rotation, r.adminState],
  );
  await hashCheck('Cable', L.Cable, (r) => [r.label, r.type, r.length, r.color, r.notes], (r) => [r.label, r.medium, r.lengthM, r.color, r.notes]);
  await hashCheck('CableEndpoint', L.CableEndpoint, (r) => [r.notes, iso(r.createdAt)], (r) => [r.notes, iso(r.createdAt)]);
  await hashCheck(
    'Workstation', L.Workstation,
    (r) => [r.name, r.code, r.cpu, r.memory, r.storage, r.gpu, r.os, r.assignedTo, r.notes, iso(r.lastSeenAt), ...fp(r.floorPlanPosition, r.floorPlanSize)],
    (r) => [r.name, r.code, r.cpu, r.memory, r.storage, r.gpu, r.os, r.assignedTo, r.notes, iso(r.lastSeenAt), r.fpX, r.fpY, r.fpW, r.fpD],
  );
  const newIps = byId(await q(tx, `SELECT id, host("address") AS address, status::text, hostname, "macAddress", description FROM "IpAddress"`));
  const badIp = L.IpAddress.filter((a) => {
    const n = newIps.get(a.id);
    return !n || md5([a.address, a.status, a.hostname, a.macAddress, a.description]) !== md5([n.address, n.status, n.hostname, n.macAddress, n.description]);
  }).map((a) => a.id);
  items.push({ name: 'f. md5 IpAddress', ok: badIp.length === 0, details: { rows: L.IpAddress.length, mismatched: badIp } });
  const newSubnetRows = byId(await q(tx, `SELECT id, name, host(network) || '/' || "prefixLen" AS network, host(gateway) AS gateway, description, "roomId" FROM "IpSubnet"`));
  const badSubnet = L.IpSubnet.filter((s) => {
    const n = newSubnetRows.get(s.id);
    return !n || md5([s.name, `${s.network}/${s.cidr}`, s.gateway, s.description, s.roomId]) !== md5([n.name, n.network, n.gateway, n.description, n.roomId]);
  }).map((s) => s.id);
  items.push({ name: 'f. md5 IpSubnet', ok: badSubnet.length === 0, details: { rows: L.IpSubnet.length, mismatched: badSubnet } });
  const obs = byId(await q(tx, `SELECT * FROM "PortObservation"`));
  const badObs = L.PortObservation.filter((o) => obs.has(o.id)).filter((o) => {
    const n = obs.get(o.id)!;
    const f = (r: Row, ifn: string) => [ifn, r.phy, r.inUtilPercent, r.outUtilPercent, r.inErrors, r.outErrors, r.rxPowerDbm, r.txPowerDbm, r.rxLowAlarmDbm, r.rxLowWarnDbm, iso(r.collectedAt)];
    return md5(f(o, o.interface)) !== md5(f(n, n.ifName));
  }).map((o) => o.id);
  items.push({ name: 'f. md5 PortObservation', ok: badObs.length === 0, details: { rows: obs.size, mismatched: badObs } });
  const labelRows = new Map((await q(tx, `SELECT * FROM "Label"`)).map((r) => [r.shortId as number, r]));
  const badLabel = L.ShortIdPool.filter((x) => {
    const n = labelRows.get(x.shortId);
    return !n || md5([x.batchNo, x.notes, iso(x.printedAt), x.printTaskId, iso(x.createdAt)]) !== md5([n.batchNo, n.notes, iso(n.printedAt), n.printTaskId, iso(n.createdAt)]);
  }).map((x) => x.shortId);
  items.push({ name: 'f. md5 Label (from ShortIdPool)', ok: badLabel.length === 0, details: { rows: L.ShortIdPool.length, mismatched: badLabel } });

  items.push(neo4jEvidence(L));

  return items;
}

/**
 * (g) The read-only Neo4j backup against legacy Postgres: every node and connection is in PG, or an
 * orphan whose parent is gone there. Unexplained rows are red. A missing backup file is reported, not red.
 */
function neo4jEvidence(L: Legacy): Item {
  const name = 'g. neo4j backup: every node/connection in legacy PG or an orphan';
  if (!existsSync(NEO4J_BACKUP)) return { name, ok: true, details: { checked: false, reason: `${path.relative(ROOT, NEO4J_BACKUP)} not found` } };
  const triples = new Set<string>();
  for (const c of L.Cable) {
    const ports = L.CableEndpoint.filter((e) => e.cableId === c.id && e.portId).map((e) => e.portId as string);
    if (ports.length === 2) triples.add(`${c.id}|${ports.sort().join('|')}`);
  }
  const ids = (rows: Row[]) => new Set(rows.map((r) => r.id as string));
  const r = compareNeo4jExport(parseNeo4jExport(readFileSync(NEO4J_BACKUP, 'utf8')), {
    devices: ids(L.Device), panels: ids(L.Panel), ports: ids(L.Port), cables: ids(L.Cable), triples,
  });
  return { name, ok: r.ok, details: { checked: true, file: path.relative(ROOT, NEO4J_BACKUP), ...r } };
}

/** Business tables of the target that differ from `expected`; empty when they all match. */
function digestDiff(expected: Record<string, string>, actual: Record<string, string>): string[] {
  return NEW_TABLES.filter((t) => expected[t] !== actual[t]);
}

/** Digest written by the latest committed prod migration, or null when there was none. */
function lastProdDigest(reportDir: string): { file: string; digest: Record<string, string> } | null {
  if (!existsSync(reportDir)) return null;
  const files = readdirSync(reportDir).filter((f) => /-prod\.json$/.test(f)).sort().reverse();
  for (const f of files) {
    const r = JSON.parse(readFileSync(path.join(reportDir, f), 'utf8')) as { committed?: boolean; digest?: Record<string, string> };
    if (r.committed && r.digest) return { file: f, digest: r.digest };
  }
  return null;
}

async function digest(db: Prisma.TransactionClient | PrismaClient): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const t of NEW_TABLES) {
    const r = await q<{ h: string | null }>(db, `SELECT md5(coalesce(string_agg(x::text, '|' ORDER BY x::text), '')) AS h FROM "${t}" x`);
    out[t] = r[0].h ?? '';
  }
  return out;
}

/**
 * The real database is only rebuilt when it is empty or still exactly what the last committed prod
 * migration left there. Otherwise rows entered after the cutover would be truncated.
 */
async function guardLive(tx: Prisma.TransactionClient, reportDir: string, overwriteLive: boolean) {
  const rows = Number((await q<{ n: bigint }>(tx, `SELECT ${NEW_TABLES.map((t) => `(SELECT count(*) FROM "${t}")`).join(' + ')} AS n`))[0].n);
  if (rows === 0) return;
  const last = lastProdDigest(reportDir);
  const changed = last ? digestDiff(last.digest, await digest(tx)) : [...NEW_TABLES];
  if (!changed.length) return;
  const why = last ? `tables changed since ${last.file}: ${changed.join(', ')}` : 'no committed prod report to compare with';
  if (overwriteLive) {
    console.warn(`[warn] --overwrite-live: wiping live data (${why})`);
    return;
  }
  throw new LiveDataChanged(`target ${rows} rows are not what the last migration wrote (${why}). Back it up and pass --overwrite-live to wipe it.`);
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------

async function main() {
  const { target, apply, overwriteLive } = args();
  dotenv.config({ path: path.join(ROOT, target === 'test' ? '.env.test' : '.env'), override: true });
  const targetUrl = process.env.DATABASE_URL!;
  const legacyUrl = process.env.LEGACY_DATABASE_URL ?? withDb(targetUrl, 'dcagent_legacy');
  assertNotLegacy(targetUrl);
  if (target === 'test' && !dbName(targetUrl).endsWith('_test')) throw new Error('--target=test must point at a *_test database');
  if (target === 'prod' && dbName(targetUrl).endsWith('_test')) throw new Error('--target=prod points at a test database');
  if (targetUrl === legacyUrl || dbName(targetUrl) === dbName(legacyUrl)) throw new Error('target and legacy are the same database');
  if (dbName(legacyUrl) !== 'dcagent_legacy') throw new Error(`legacy database must be dcagent_legacy, got ${dbName(legacyUrl)}`);

  const legacy = new PrismaClient({ datasourceUrl: legacyUrl });
  const db = new PrismaClient({ datasourceUrl: targetUrl });
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '');
  const reportDir = path.join(ROOT, 'migration-reports');
  mkdirSync(reportDir, { recursive: true });

  console.log(`[info] legacy=${dbName(legacyUrl)} target=${dbName(targetUrl)} mode=${apply ? 'APPLY' : 'DRY-RUN'}`);
  try {
    const L = await readLegacy(legacy);
    const plan = transform(L);
    let items: Item[] = [];
    let txDigest: Record<string, string> = {};
    try {
      await db.$transaction(
        async (tx) => {
          if (target === 'prod' && apply) await guardLive(tx, reportDir, overwriteLive);
          await write(tx, plan);
          items = await reconcile(tx, L, plan);
          txDigest = await digest(tx);
          if (!apply || items.some((i) => !i.ok)) throw new Rollback();
        },
        { maxWait: 20_000, timeout: 120_000 },
      );
    } catch (e) {
      if (!(e instanceof Rollback)) throw e;
    }

    const allOk = items.every((i) => i.ok);
    const report = {
      at: new Date().toISOString(),
      mode: apply ? 'apply' : 'dry-run',
      committed: apply && allOk,
      legacy: dbName(legacyUrl),
      target: dbName(targetUrl),
      ok: allOk,
      items,
      notes: plan.notes,
      newLabels: plan.newLabels,
      digest: txDigest,
      digestAll: md5(txDigest),
    };
    const file = path.join(reportDir, `${stamp}-${target}${apply ? '' : '-dryrun'}.json`);
    writeFileSync(file, JSON.stringify(report, null, 2));
    const csv = ['shortId,display,kind,path', ...plan.newLabels.map((n) => `${n.shortId},${formatShortId(n.shortId)},${n.kind},"${n.path.replace(/"/g, '""')}"`)].join('\n') + '\n';
    const csvFile = path.join(reportDir, `labels-to-print-${stamp}-${target}.csv`);
    writeFileSync(csvFile, '﻿' + csv);

    const countItem = items.find((i) => i.name === 'a. row counts');
    if (countItem) {
      console.log('\nrow counts (legacy -> new):');
      for (const c of countItem.details as Json[]) {
        console.log(`  ${c.ok ? '[ok]  ' : '[FAIL]'} ${String(c.legacy).padEnd(24)} ${String(c.legacyCount).padStart(4)} -> ${String(c.new).padEnd(21)} ${String(c.newCount).padStart(4)}  ${c.reason}`);
      }
    }
    console.log('\nreconciliation:');
    for (const i of items.filter((x) => x.name !== 'a. row counts')) console.log(`  ${i.ok ? '[ok]  ' : '[FAIL]'} ${i.name}`);
    console.log(`[info] digest ${report.digestAll}`);
    console.log(`[info] report ${path.relative(ROOT, file)}`);
    console.log(`[info] labels to print (${plan.newLabels.length}) ${path.relative(ROOT, csvFile)}`);
    if (!allOk) {
      console.error('[error] reconciliation failed, transaction rolled back');
      process.exitCode = 1;
    } else {
      console.log(apply ? '[ok] committed' : '[ok] dry run green, rolled back');
    }
  } catch (e) {
    console.error(`[error] ${e instanceof Abort ? 'preflight: ' : e instanceof LiveDataChanged ? 'refused: ' : ''}${(e as Error).message}`);
    process.exitCode = 1;
  } finally {
    await legacy.$disconnect();
    await db.$disconnect();
  }
}

if (require.main === module) void main();

export { transform, uuidFrom, sysnameOf, ifNameOf, portTypeOf, modelNameOf, deviceNotesOf, splitDeviceNotes, digestDiff };
