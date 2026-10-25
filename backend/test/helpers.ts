// Integration test helpers. Only ever runs against a *_test database (checked before anything is touched).
process.env.NODE_ENV = 'test';

import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { assertTestDb } from '../scripts/lib/assertDb';
import { env } from '../src/config/env';
import { createApp } from '../src/app';
import { inTx } from '../src/http/rpc';
import { prisma, type Db } from '../src/utils/prisma';
import { cabinetService, dataCenterService, roomService } from '../src/services/hierarchyService';
import { deviceService } from '../src/services/deviceService';
import { panelService } from '../src/services/panelService';
import { portService } from '../src/services/portService';

assertTestDb(env.DATABASE_URL);

const TABLES = [
  'ObservationUnmatched', 'PortObservation', 'ModuleMovement', 'OpticalModule', 'IpAddress', 'IpSubnet', 'Label', 'PrintTask',
  'CableEndpoint', 'Cable', 'Workstation', 'PanelTemplatePort', 'Port', 'Panel', 'PanelTemplate', 'Device', 'DeviceModel', 'Cabinet', 'Room', 'DataCenter',
];

export async function truncateAll() {
  assertTestDb(env.DATABASE_URL);
  await prisma.$executeRawUnsafe(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);
}

export { prisma, inTx };
export type { Db };

let seq = 0;
const uniq = (p: string) => `${p}-${process.pid}-${++seq}`;

/** Minimal hierarchy built through the services: DC > room > cabinet > switch with one panel of `ports` RJ45 ports. */
export async function fixture(opts: { ports?: number; heightU?: number } = {}) {
  return inTx(async (tx) => {
    const dc = await dataCenterService.create(tx, { name: uniq('dc'), location: null });
    const room = await roomService.create(tx, { dataCenterId: dc.id, name: uniq('room'), floor: null, notes: null });
    const cabinet = await cabinetService.create(tx, {
      roomId: room.id, name: uniq('cab'), positionCode: null, heightU: opts.heightU ?? 42, notes: null, fpRotation: 0,
    });
    const device = await deviceService.create(tx, {
      name: uniq('sw'), type: 'SWITCH', cabinetId: cabinet.id, uPosition: 1, uHeight: 1, serialNo: null, sysname: null, notes: null,
    });
    const panel = await panelService.create(tx, { deviceId: device.id, name: 'front', type: 'NETWORK', face: 'FRONT', notes: null });
    if (opts.ports ?? 4) await portService.createBulk(tx, { panelId: panel.id, count: opts.ports ?? 4, prefix: 'ge', startNumber: 1, portType: 'RJ45' });
    const ports = await tx.port.findMany({ where: { panelId: panel.id }, orderBy: { sortIndex: 'asc' } });
    return { dc, room, cabinet, device, panel, ports };
  });
}

let server: Server | null = null;
let base = '';

export async function startServer() {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server!.once('listening', resolve);
    server!.once('error', reject);
  });
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

export async function stopServer() {
  await new Promise<void>((resolve) => (server ? server.close(() => resolve()) : resolve()));
  server = null;
}

export async function rpc<T = unknown>(path: string, body: unknown): Promise<{ status: number; json: T }> {
  const res = await fetch(`${base}/api/v1/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: (await res.json()) as T };
}

export async function errCode(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const { toAppError } = await import('../src/http/errors');
    return toAppError(e).code;
  }
  return 'NO_ERROR';
}
