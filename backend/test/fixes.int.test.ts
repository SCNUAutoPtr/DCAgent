// Regression tests for the 2026-10-25 night review: delete paths keep history, template apply keeps
// hand-typed port data, unknown device heights stay unknown, names sort naturally.
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { errCode, fixture, inTx, prisma, rpc, startServer, stopServer, truncateAll } from './helpers';
import { deviceService } from '../src/services/deviceService';
import { ipAddressService, subnetService } from '../src/services/ipService';
import { observabilityService } from '../src/services/observabilityService';
import { opticalModuleService } from '../src/services/opticalModuleService';
import { panelService } from '../src/services/panelService';
import { panelTemplateService as tpl } from '../src/services/panelTemplateService';
import { workstationService } from '../src/services/workstationService';
import { moduleCreateSchema } from '../src/contracts/opticalModules';
import type { PanelGenerator } from '../src/contracts/panelTemplates';

before(startServer);
after(async () => {
  await stopServer();
  await prisma.$disconnect();
});
beforeEach(truncateAll);

const observe = (deviceId: string, ifName: string, portId: string | null = null) =>
  prisma.portObservation.create({ data: { deviceId, portId, ifName, phy: 'up' } });

test('deleting a device with observation history or a management IP needs force; force removes history and unbinds the IP', async () => {
  const f = await fixture({ ports: 0 });
  await inTx((tx) => panelService.delete(tx, f.panel.id, true));
  await observe(f.device.id, 'Vlanif1');
  const s = await inTx((tx) => subnetService.create(tx, { name: 'mgmt', network: '10.9.0.0/24', gateway: null, dnsServers: [], description: null }));
  const ip = await inTx((tx) => ipAddressService.allocate(tx, { subnetId: s.id, address: '10.9.0.5', status: 'ALLOCATED', hostname: 'sw', description: null, deviceId: f.device.id }));

  const res = await rpc<{ code: string; details: { observations: number; ipAddresses: { name: string }[] } }>('devices/delete', { id: f.device.id });
  assert.equal(res.status, 409);
  assert.equal(res.json.code, 'NOT_EMPTY');
  assert.equal(res.json.details.observations, 1);
  assert.deepEqual(res.json.details.ipAddresses.map((a) => a.name), ['10.9.0.5']);
  assert.equal(await prisma.portObservation.count(), 1);

  const forced = await rpc('devices/delete', { id: f.device.id, force: true });
  assert.equal(forced.status, 200);
  assert.equal(await prisma.portObservation.count(), 0);
  const row = await prisma.ipAddress.findUniqueOrThrow({ where: { id: ip.id } });
  assert.equal(row.deviceId, null, 'the address record stays, unbound');
  assert.equal(row.hostname, 'sw');
});

test('the database refuses to cascade observation history when a device row is deleted directly', async () => {
  const f = await fixture({ ports: 0 });
  await observe(f.device.id, 'Vlanif1');
  assert.equal(await errCode(inTx((tx) => tx.device.delete({ where: { id: f.device.id } }))), 'NOT_EMPTY');
  assert.equal(await prisma.portObservation.count(), 1);
});

test('template apply keeps ports that are reserved, labelled or annotated instead of deleting them', async () => {
  const f = await fixture({ ports: 6 });
  const [, , p3, p4, p5, p6] = f.ports;
  await prisma.port.update({ where: { id: p3.id }, data: { adminState: 'RESERVED' } });
  await prisma.port.update({ where: { id: p4.id }, data: { label: 'uplink' } });
  await prisma.port.update({ where: { id: p5.id }, data: { notes: 'broken latch' } });
  const generator: PanelGenerator = { version: 1, groups: [{ portType: 'RJ45', count: 2, numberPrefix: 'ge', rows: 1, order: 'ROW_MAJOR', xMm: 20 }] };
  const t = await inTx((tx) => tpl.create(tx, { name: 'two', type: 'NETWORK', face: 'FRONT', widthMm: 482.6, heightMm: 44.45, description: null, deviceModelId: null, generator }));
  const diff = await tpl.applyPreview(prisma, t.id, f.panel.id);
  assert.deepEqual(diff.delete.map((d) => d.portId), [p6.id]);
  assert.deepEqual(
    diff.kept.map((k) => [k.portId, k.reasons]),
    [[p3.id, ['ADMIN_STATE']], [p4.id, ['LABEL']], [p5.id, ['NOTES']]],
  );
  await inTx((tx) => tpl.apply(tx, { templateId: t.id, panelId: f.panel.id, expectedRevision: t.revision }));
  const left = await prisma.port.findMany({ where: { panelId: f.panel.id } });
  assert.equal(left.length, 5);
  assert.equal(left.find((p) => p.id === p4.id)?.label, 'uplink');
});

test('module history keeps where the module was after the port is deleted', async () => {
  const f = await fixture({ ports: 2 });
  await prisma.port.update({ where: { id: f.ports[0].id }, data: { portType: 'SFP_PLUS' } });
  const mod = await inTx((tx) => opticalModuleService.create(tx, moduleCreateSchema.parse({ serialNo: 'SN-H', model: 'm', vendor: 'v', moduleType: 'SFP_PLUS' })));
  await inTx((tx) => opticalModuleService.install(tx, { id: mod.id, portId: f.ports[0].id }));
  await inTx((tx) => opticalModuleService.uninstall(tx, { id: mod.id }));
  await inTx((tx) => panelService.delete(tx, f.panel.id, true));
  const history = await opticalModuleService.history(prisma, mod.id);
  const install = history.find((h) => h.movementType === 'INSTALL')!;
  assert.equal(install.toPortId, null);
  assert.equal(install.toPort, `${f.device.name} front ${f.ports[0].number}`);
});

test('resolving an observation refuses a port of another device', async () => {
  const a = await fixture({ ports: 1 });
  const b = await fixture({ ports: 1 });
  const row = await prisma.observationUnmatched.create({ data: { source: 'PORT_OBSERVATION', sysname: 'x', ifName: 'GE0/0/1', payload: {} } });
  const res = await rpc<{ code: string }>('observability/unmatched/resolve', { id: row.id, deviceId: a.device.id, portId: b.ports[0].id });
  assert.equal(res.status, 400);
  assert.equal(res.json.code, 'VALIDATION_ERROR');
  assert.equal(await prisma.portObservation.count(), 0);
  const ok = await rpc('observability/unmatched/resolve', { id: row.id, deviceId: a.device.id, portId: a.ports[0].id });
  assert.equal(ok.status, 200);
});

test('a device without a known height stays unknown and occupies its own U in the cabinet', async () => {
  const f = await fixture({ heightU: 10 });
  const base = { type: 'SERVER' as const, cabinetId: f.cabinet.id, serialNo: null, sysname: null, notes: null };
  const d = await inTx((tx) => deviceService.create(tx, { ...base, name: 'unknown-height', uPosition: 5 }));
  assert.equal(d.uHeight, null);
  assert.equal(await errCode(inTx((tx) => deviceService.create(tx, { ...base, name: 'clash', uPosition: 4, uHeight: 2 }))), 'U_SPACE_CONFLICT');
  const ok = await inTx((tx) => deviceService.create(tx, { ...base, name: 'above', uPosition: 6, uHeight: 1 }));
  assert.equal(ok.uPosition, 6);
  const set = await inTx((tx) => deviceService.update(tx, { id: d.id, uHeight: null }));
  assert.equal(set.uHeight, null);
});

test('names with numbers sort naturally, also in paginated lists', async () => {
  const f = await fixture({ ports: 0 });
  for (const name of ['S110-100', 'S110-10', 'S110-9', 'S110-11']) {
    await inTx((tx) => workstationService.create(tx, { roomId: f.room.id, name, code: null, adminState: 'ACTIVE', assignedTo: null, notes: null, cpu: null, memory: null, storage: null, gpu: null, os: null }));
  }
  const page = await workstationService.list(prisma, { roomId: f.room.id, take: 3, skip: 0 });
  assert.deepEqual(page.items.map((w) => w.name), ['S110-9', 'S110-10', 'S110-11']);
  const seats = await observabilityService.seatMap(prisma, { roomId: f.room.id, windowSeconds: 60 });
  assert.deepEqual(seats.map((s) => s.name), ['S110-9', 'S110-10', 'S110-11', 'S110-100']);
});
