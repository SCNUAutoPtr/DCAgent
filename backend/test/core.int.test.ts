import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { errCode, fixture, inTx, prisma, rpc, startServer, stopServer, truncateAll } from './helpers';
import { cableService } from '../src/services/cableService';
import { labelService } from '../src/services/labelService';
import { portService } from '../src/services/portService';
import { panelService } from '../src/services/panelService';
import { deviceService } from '../src/services/deviceService';
import { roomService } from '../src/services/hierarchyService';
import { ipAddressService, subnetService } from '../src/services/ipService';
import { observabilityService } from '../src/services/observabilityService';
import { workstationService } from '../src/services/workstationService';
import { panelTemplateService } from '../src/services/panelTemplateService';
import { opticalModuleService } from '../src/services/opticalModuleService';
import { moduleCreateSchema } from '../src/contracts/opticalModules';

before(startServer);
after(async () => {
  await stopServer();
  await prisma.$disconnect();
});
beforeEach(truncateAll);

const cable = (portA?: string, portB?: string, labels: { a?: number; b?: number } = {}) =>
  inTx((tx) =>
    cableService.create(tx, {
      medium: 'CAT6', label: null, color: null, notes: null,
      ends: { A: { portId: portA, labelShortId: labels.a, notes: null }, B: { portId: portB, labelShortId: labels.b, notes: null } },
    }),
  );

test('1. a label bound to a cabinet cannot be used for a cable end (LABEL_NOT_AVAILABLE)', async () => {
  const f = await fixture();
  const cabLabel = (await prisma.label.findFirst({ where: { cabinetId: f.cabinet.id } }))!.shortId;
  assert.equal(await errCode(cable(f.ports[0].id, f.ports[1].id, { a: cabLabel })), 'LABEL_NOT_AVAILABLE');
  const res = await rpc<{ code: string }>('cables/create', {
    medium: 'CAT6', ends: { A: { portId: f.ports[0].id, labelShortId: cabLabel }, B: { portId: f.ports[1].id } },
  });
  assert.equal(res.status, 409);
  assert.equal(res.json.code, 'LABEL_NOT_AVAILABLE');
  assert.equal(await prisma.cable.count(), 0);
});

test('2. a cabinet inserted without a label fails at commit (LABEL_REQUIRED)', async () => {
  const f = await fixture();
  const code = await errCode(
    inTx(async (tx) => {
      await tx.$executeRaw`INSERT INTO "Cabinet"(id, name, "roomId", "updatedAt") VALUES (gen_random_uuid(), 'naked', ${f.room.id}, now())`;
    }),
  );
  assert.equal(code, 'LABEL_REQUIRED');
  assert.equal(await prisma.cabinet.count(), 1);
});

test('3. deleting a connected port: 409 without force; with force both ends stay, peer stays connected, labels stay bound', async () => {
  const f = await fixture();
  const c = await cable(f.ports[0].id, f.ports[1].id);
  const res = await rpc<{ code: string }>('ports/delete', { id: f.ports[0].id });
  assert.equal(res.status, 409);
  assert.equal(res.json.code, 'PORT_HAS_DEPENDENTS');
  await inTx((tx) => portService.delete(tx, f.ports[0].id, true));
  const ends = await prisma.cableEndpoint.findMany({ where: { cableId: c.id }, include: { label: true }, orderBy: { end: 'asc' } });
  assert.equal(ends.length, 2);
  assert.equal(ends[0].portId, null);
  assert.equal(ends[1].portId, f.ports[1].id);
  assert.ok(ends.every((e) => e.label));
});

test('4. deleting a panel releases its label, keeps firstBoundAt, and autoAllocate never hands it out', async () => {
  const f = await fixture({ ports: 0 });
  const shortId = (await prisma.label.findFirst({ where: { panelId: f.panel.id } }))!.shortId;
  await inTx((tx) => panelService.delete(tx, f.panel.id, false));
  const l = (await prisma.label.findUnique({ where: { shortId } }))!;
  assert.equal(l.panelId, null);
  assert.ok(l.firstBoundAt);
  const next = await inTx((tx) => labelService.autoAllocate(tx, 3));
  assert.ok(!next.includes(shortId));
});

test('5. one port, two concurrent connect-end calls: exactly one wins', async () => {
  const f = await fixture();
  const c1 = await cable(undefined, undefined);
  const c2 = await cable(undefined, undefined);
  const [r1, r2] = await Promise.allSettled([
    inTx((tx) => cableService.connectEnd(tx, { endpointId: c1.endpoints[0].id, portId: f.ports[2].id })),
    inTx((tx) => cableService.connectEnd(tx, { endpointId: c2.endpoints[0].id, portId: f.ports[2].id })),
  ]);
  const ok = [r1, r2].filter((r) => r.status === 'fulfilled').length;
  assert.equal(ok, 1);
  const failed = [r1, r2].find((r) => r.status === 'rejected') as PromiseRejectedResult;
  assert.equal(await errCode(Promise.reject(failed.reason)), 'PORT_OCCUPIED');
  assert.equal(await prisma.cableEndpoint.count({ where: { portId: f.ports[2].id } }), 1);
});

test('6. cable create rolls back completely when the second label is unavailable', async () => {
  const f = await fixture();
  const taken = (await prisma.label.findFirst({ where: { panelId: f.panel.id } }))!.shortId;
  const labelsBefore = await prisma.label.count();
  assert.equal(await errCode(cable(f.ports[0].id, f.ports[1].id, { a: 990001, b: taken })), 'LABEL_NOT_AVAILABLE');
  assert.equal(await prisma.cable.count(), 0);
  assert.equal(await prisma.cableEndpoint.count(), 0);
  assert.equal(await prisma.label.count(), labelsBefore);
});

test('7. overlapping U positions are rejected by the exclusion, out-of-cabinet U by the service', async () => {
  const f = await fixture({ heightU: 10 });
  const base = { type: 'SERVER' as const, cabinetId: f.cabinet.id, serialNo: null, sysname: null, notes: null };
  assert.equal(await errCode(inTx((tx) => deviceService.create(tx, { ...base, name: 'overlap', uPosition: 1, uHeight: 2 }))), 'U_SPACE_CONFLICT');
  assert.equal(await errCode(inTx((tx) => deviceService.create(tx, { ...base, name: 'too-high', uPosition: 9, uHeight: 3 }))), 'U_OUT_OF_RANGE');
  const ok = await inTx((tx) => deviceService.create(tx, { ...base, name: 'fits', uPosition: 2, uHeight: 2 }));
  assert.equal(ok.uPosition, 2);
});

test('8. a /16 subnet writes one row; next-available is the first host after the gateway, sorted numerically', async () => {
  const s = await inTx((tx) => subnetService.create(tx, { name: 'big', network: '10.20.0.0/16', gateway: '10.20.0.1', dnsServers: [], description: null }));
  assert.equal(await prisma.ipSubnet.count(), 1);
  assert.equal(await prisma.ipAddress.count(), 0);
  assert.equal(s.usage.capacity, 65534);
  const next = await inTx((tx) => ipAddressService.nextAvailable(tx, s.id, 1));
  assert.deepEqual(next, ['10.20.0.2']);
  for (const a of ['10.20.0.10', '10.20.0.2', '10.20.1.1']) {
    await inTx((tx) => ipAddressService.allocate(tx, { subnetId: s.id, address: a, status: 'ALLOCATED', hostname: null, description: null }));
  }
  const list = await ipAddressService.list(prisma, { subnetId: s.id, take: 10, skip: 0 });
  assert.deepEqual(list.items.map((i) => i.address), ['10.20.0.2', '10.20.0.10', '10.20.1.1']);
  assert.deepEqual(await inTx((tx) => ipAddressService.nextAvailable(tx, s.id, 2)), ['10.20.0.3', '10.20.0.4']);
});

test('9. an address outside the subnet is refused by the trigger; port and device together by the CHECK', async () => {
  const f = await fixture();
  const s = await inTx((tx) => subnetService.create(tx, { name: 'n', network: '192.168.50.0/24', gateway: null, dnsServers: [], description: null }));
  assert.equal(
    await errCode(inTx((tx) => ipAddressService.allocate(tx, { subnetId: s.id, address: '192.168.51.5', status: 'ALLOCATED', hostname: null, description: null }))),
    'IP_OUT_OF_SUBNET',
  );
  const code = await errCode(
    prisma.ipAddress.create({ data: { subnetId: s.id, address: '192.168.50.9', portId: f.ports[0].id, deviceId: f.device.id } }),
  );
  assert.equal(code, 'VALIDATION_ERROR');
});

test('10. power sync never overrides MAINTENANCE and online is derived from the timestamps', async () => {
  const f = await fixture({ ports: 0 });
  const w = await inTx((tx) =>
    workstationService.create(tx, { roomId: f.room.id, name: 'seat-1', code: null, adminState: 'MAINTENANCE', assignedTo: null, notes: null, cpu: null, memory: null, storage: null, gpu: null, os: null }),
  );
  await inTx((tx) => observabilityService.syncPower(tx, { rows: [{ name: 'seat-1', ip: '', mac: '', online: true }], dryRun: false }));
  let got = await workstationService.get(prisma, w.id);
  assert.equal(got.adminState, 'MAINTENANCE');
  assert.equal(got.online, true);
  await inTx((tx) => observabilityService.syncPower(tx, { rows: [{ name: 'seat-1', ip: '', mac: '', online: false }], dryRun: false }));
  got = await workstationService.get(prisma, w.id);
  assert.equal(got.online, false);
  assert.equal(got.adminState, 'MAINTENANCE');
});

test('11. deleting a non-empty room returns 409 NOT_EMPTY', async () => {
  const f = await fixture({ ports: 0 });
  const res = await rpc<{ code: string; details: { cabinets: unknown[] } }>('rooms/delete', { id: f.room.id });
  assert.equal(res.status, 409);
  assert.equal(res.json.code, 'NOT_EMPTY');
  assert.equal(res.json.details.cabinets.length, 1);
  assert.equal(await errCode(inTx((tx) => roomService.delete(tx, f.room.id))), 'NOT_EMPTY');
});

test('12. template apply keeps ports with a cable, module or IP and updates geometry in place', async () => {
  const f = await fixture({ ports: 4 });
  const [p1, p2, p3, p4] = f.ports;
  await inTx((tx) => tx.port.update({ where: { id: p3.id }, data: { portType: 'SFP_PLUS', number: 'x3' } }));
  await cable(p1.id, undefined);
  const mod = await inTx((tx) => opticalModuleService.create(tx, moduleCreateSchema.parse({ serialNo: 'SN1', model: 'm', vendor: 'v', moduleType: 'SFP_PLUS' })));
  await inTx((tx) => opticalModuleService.install(tx, { id: mod.id, portId: p3.id }));
  const s = await inTx((tx) => subnetService.create(tx, { name: 'n', network: '10.1.1.0/24', gateway: null, dnsServers: [], description: null }));
  await inTx((tx) => ipAddressService.allocate(tx, { subnetId: s.id, address: '10.1.1.5', status: 'ALLOCATED', portId: p4.id, hostname: null, description: null }));
  const t = await inTx((tx) =>
    panelTemplateService.create(tx, {
      name: 'only-ge2', type: 'NETWORK', face: 'FRONT', widthMm: 482.6, heightMm: 44.45, description: null,
      generator: { version: 1, groups: [{ portType: 'RJ45', count: 1, numberPrefix: 'ge', startIndex: 2, rows: 1, order: 'ROW_MAJOR', xMm: 10, yMm: 5, pitchXMm: 20, pitchYMm: 0, rotation: 0, ifNamePattern: 'GigabitEthernet0/0/{n}' }] },
    }),
  );
  const preview = await panelTemplateService.applyPreview(prisma, t.id, f.panel.id);
  assert.deepEqual(preview.kept.map((k) => k.number).sort(), ['ge1', 'ge4', 'x3']);
  assert.equal(preview.delete.length, 0);
  assert.equal(await errCode(inTx((tx) => panelTemplateService.apply(tx, { templateId: t.id, panelId: f.panel.id, expectedRevision: 99 }))), 'TEMPLATE_REVISION_MISMATCH');
  await inTx((tx) => panelTemplateService.apply(tx, { templateId: t.id, panelId: f.panel.id, expectedRevision: t.revision }));
  const ports = await prisma.port.findMany({ where: { panelId: f.panel.id } });
  assert.equal(ports.length, 4);
  const ge2 = ports.find((p) => p.id === p2.id)!;
  assert.equal(ge2.ifName, 'GigabitEthernet0/0/2');
  assert.equal(ge2.xMm, 10);
  assert.equal((await prisma.panel.findUnique({ where: { id: f.panel.id } }))!.templateRevision, t.revision);
});

test('error body is always {code,message,details}; unknown routes and bad bodies included', async () => {
  const a = await rpc<Record<string, unknown>>('nope/list', {});
  assert.equal(a.status, 404);
  assert.deepEqual(Object.keys(a.json).sort(), ['code', 'details', 'message']);
  const b = await rpc<Record<string, unknown>>('devices/get', { id: 'not-a-uuid' });
  assert.equal(b.status, 400);
  assert.equal(b.json.code, 'VALIDATION_ERROR');
  const c = await rpc<Record<string, unknown>>('devices/get', { id: '00000000-0000-4000-8000-000000000000' });
  assert.equal(c.status, 404);
  assert.equal(c.json.code, 'NOT_FOUND');
});

test('labels/resolve walks the path; rebind with VOID retires the old label in the same transaction', async () => {
  const f = await fixture({ ports: 0 });
  const old = (await prisma.label.findFirst({ where: { cabinetId: f.cabinet.id } }))!.shortId;
  const r = await rpc<{ bound: { kind: string; path: { kind: string }[] } }>('labels/resolve', { shortId: old });
  assert.equal(r.json.bound.kind, 'CABINET');
  assert.deepEqual(r.json.bound.path.map((n) => n.kind), ['DATACENTER', 'ROOM', 'CABINET']);
  await inTx((tx) => labelService.rebind(tx, { shortId: 770001, target: { kind: 'CABINET', id: f.cabinet.id }, oldPolicy: 'VOID' }));
  assert.equal((await prisma.label.findUnique({ where: { shortId: old } }))!.state, 'VOID');
  assert.equal((await prisma.label.findUnique({ where: { shortId: 770001 } }))!.cabinetId, f.cabinet.id);
  // taking the label away without a replacement fails at commit
  assert.equal(await errCode(inTx((tx) => tx.label.update({ where: { shortId: 770001 }, data: { cabinetId: null } }))), 'LABEL_REQUIRED');
});

test('disconnect-end parks the plug on the panel it leaves; cable state is derived', async () => {
  const f = await fixture();
  const c = await cable(f.ports[0].id, f.ports[1].id);
  assert.equal(c.state, 'IN_USE');
  const shortId = c.endpoints[0].label!.shortId;
  let after = await inTx((tx) => cableService.disconnectEnd(tx, { labelShortId: shortId }));
  assert.equal(after.endpoints[0].parkedPanelId, f.panel.id);
  after = await inTx((tx) => cableService.disconnectEnd(tx, { endpointId: c.endpoints[1].id }));
  assert.equal(after.state, 'STOCK');
  const del = await inTx((tx) => cableService.delete(tx, c.id, true));
  assert.equal(del.voidedLabels.length, 2);
  assert.equal(await prisma.label.count({ where: { state: 'VOID' } }), 2);
});
