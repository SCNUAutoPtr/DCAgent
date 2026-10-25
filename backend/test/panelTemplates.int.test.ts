import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { errCode, fixture, inTx, prisma, rpc, startServer, stopServer, truncateAll } from './helpers';
import { cableService } from '../src/services/cableService';
import { deviceService } from '../src/services/deviceService';
import { ipAddressService, subnetService } from '../src/services/ipService';
import { opticalModuleService } from '../src/services/opticalModuleService';
import { panelService } from '../src/services/panelService';
import { panelTemplateService as tpl } from '../src/services/panelTemplateService';
import { moduleCreateSchema } from '../src/contracts/opticalModules';
import { GENERATOR_PRESETS, type ApplyDiff, type BatchPreview, type PanelGenerator, type TemplateDoc } from '../src/contracts/panelTemplates';

before(startServer);
after(async () => {
  await stopServer();
  await prisma.$disconnect();
});
beforeEach(truncateAll);

const gen = (count: number, extra: Partial<PanelGenerator['groups'][number]> = {}): PanelGenerator => ({
  version: 1,
  groups: [{ portType: 'RJ45', count, numberPrefix: 'ge', ifNamePattern: 'GigabitEthernet0/0/{n}', rows: 2, order: 'COLUMN_MAJOR', xMm: 20, ...extra }],
});

const createTemplate = (name: string, generator: PanelGenerator, deviceModelId: string | null = null) =>
  inTx((tx) => tpl.create(tx, { name, type: 'NETWORK', face: 'FRONT', widthMm: 482.6, heightMm: 44.45, description: null, deviceModelId, generator }));

const cable = (portA: string) =>
  inTx((tx) =>
    cableService.create(tx, {
      medium: 'CAT6', label: null, color: null, notes: null,
      ends: { A: { portId: portA, notes: null }, B: { notes: null } },
    }),
  );

const doc = (generator: PanelGenerator, description = 'd'): TemplateDoc => ({
  format: 'dcagent.panel-template',
  version: 1,
  templates: [
    { name: 'NIGHT-SMOKE-doc', type: 'NETWORK', face: 'FRONT', deviceModel: { vendor: 'Huawei', name: 'NS-1', deviceType: 'SWITCH' }, widthMm: 482.6, heightMm: 44.45, description, generator },
  ],
});

test('generate-preview runs the shared generator and reports issues as VALIDATION_ERROR', async () => {
  const ok = await rpc<unknown[]>('panel-templates/generate-preview', { generator: GENERATOR_PRESETS.switch48ge4xge.generator });
  assert.equal(ok.status, 200);
  assert.equal(ok.json.length, 52);
  const bad = await rpc<{ code: string; details: { issues: { kind: string }[] } }>('panel-templates/generate-preview', {
    generator: { version: 1, groups: [{ portType: 'RJ45', count: 2, names: ['a', 'a'] }] },
  });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.code, 'VALIDATION_ERROR');
  assert.equal(bad.json.details.issues[0].kind, 'DUPLICATE_NUMBER');
});

test('template ports come from the generator; explicit ports drop it; revision moves only on real changes', async () => {
  const t = await createTemplate('NIGHT-SMOKE-a', gen(4));
  assert.equal(t.portCount, 4);
  assert.equal(t.revision, 1);
  const same = await inTx((tx) => tpl.update(tx, { id: t.id, generator: gen(4), description: 'x' }));
  assert.equal(same.revision, 1, 'same ports, same revision');
  const more = await inTx((tx) => tpl.update(tx, { id: t.id, generator: gen(6) }));
  assert.equal(more.revision, 2);
  const manual = await inTx((tx) => tpl.update(tx, { id: t.id, ports: more.ports!.slice(0, 2).map(({ id: _id, ...p }) => ({ ...p, rotation: 0 as const })) }));
  assert.equal(manual.generator, null);
  assert.equal(manual.portCount, 2);
  assert.equal(manual.revision, 3);
});

test('import is idempotent: same doc twice inserts once, upserts the device model once', async () => {
  const first = await inTx((tx) => tpl.import(tx, doc(gen(4)), 'upsert'));
  assert.equal(first.created.length, 1);
  const again = await inTx((tx) => tpl.import(tx, doc(gen(4)), 'upsert'));
  assert.deepEqual([again.created.length, again.updated.length, again.unchanged.length], [0, 0, 1]);
  assert.equal(await prisma.panelTemplate.count(), 1);
  assert.equal(await prisma.deviceModel.count({ where: { name: 'NS-1' } }), 1);
  const row = await prisma.panelTemplate.findFirstOrThrow({ include: { ports: true } });
  assert.equal(row.revision, 1);
  assert.equal(row.ports.length, 4);
  assert.equal(await errCode(inTx((tx) => tpl.import(tx, doc(gen(4)), 'create'))), 'UNIQUE_VIOLATION');
  const changed = await inTx((tx) => tpl.import(tx, doc(gen(6)), 'upsert'));
  assert.equal(changed.updated.length, 1);
  assert.equal((await prisma.panelTemplate.findFirstOrThrow()).revision, 2);
  // export -> import round trip is a no-op
  const exported = await tpl.export(prisma);
  const round = await inTx((tx) => tpl.import(tx, exported, 'upsert'));
  assert.deepEqual(round.unchanged, [row.id]);
});

test('template-kit presets import twice without duplicates', async () => {
  const a = await rpc<{ created: string[]; unchanged: string[] }>('panel-templates/import-presets', {});
  assert.equal(a.status, 200);
  assert.ok(a.json.created.length >= 6);
  const n = await prisma.panelTemplate.count();
  const b = await rpc<{ created: string[]; updated: string[]; unchanged: string[] }>('panel-templates/import-presets', {});
  assert.equal(b.json.created.length + b.json.updated.length, 0);
  assert.equal(b.json.unchanged.length, n);
  assert.equal(await prisma.panelTemplate.count(), n);
});

test('apply-preview classifies ports; apply never deletes ports in use and leaves their state alone', async () => {
  const f = await fixture({ ports: 6 }); // ge1..ge6
  const [p1, p2, , , p5, p6] = f.ports;
  await inTx((tx) => tx.port.update({ where: { id: p2.id }, data: { adminState: 'RESERVED', label: 'uplink', notes: 'keep me' } }));
  await cable(p5.id);
  const mod = await inTx((tx) => opticalModuleService.create(tx, moduleCreateSchema.parse({ serialNo: 'NS-SN1', model: 'm', vendor: 'v', moduleType: 'SFP' })));
  await inTx((tx) => tx.port.update({ where: { id: p6.id }, data: { portType: 'SFP' } }));
  await inTx((tx) => opticalModuleService.install(tx, { id: mod.id, portId: p6.id }));
  const s = await inTx((tx) => subnetService.create(tx, { name: 'NIGHT-SMOKE-n', network: '10.9.9.0/24', gateway: null, dnsServers: [], description: null }));
  await inTx((tx) => ipAddressService.allocate(tx, { subnetId: s.id, address: '10.9.9.5', status: 'ALLOCATED', portId: p1.id, hostname: null, description: null }));

  // template: ge2, ge3 and a new ge7. ge4 is free (deleted); ge1 (IP), ge5 (cable), ge6 (module) are kept.
  const t = await createTemplate('NIGHT-SMOKE-b', { version: 1, groups: [{ portType: 'RJ45', count: 2, numberPrefix: 'ge', startIndex: 2, ifNamePattern: 'GigabitEthernet0/0/{n}', xMm: 30, yMm: 5 }, { portType: 'RJ45', count: 1, names: ['ge7'], xMm: 100, yMm: 5 }] });
  const d = await rpc<ApplyDiff>('panel-templates/apply-preview', { templateId: t.id, panelId: f.panel.id });
  assert.equal(d.status, 200);
  assert.deepEqual(d.json.create.map((c) => c.number), ['ge7']);
  assert.deepEqual(d.json.update.map((u) => u.number).sort(), ['ge2', 'ge3']);
  assert.deepEqual(d.json.delete.map((x) => x.number), ['ge4']);
  assert.deepEqual(Object.fromEntries(d.json.kept.map((k) => [k.number, k.reasons])), { ge1: ['IP'], ge5: ['CABLE'], ge6: ['MODULE'] });
  assert.deepEqual(d.json.conflicts, []);
  assert.equal(await prisma.port.count({ where: { panelId: f.panel.id } }), 6, 'preview writes nothing');

  const stale = await rpc<{ code: string }>('panel-templates/apply', { templateId: t.id, panelId: f.panel.id, expectedRevision: t.revision + 1 });
  assert.equal(stale.status, 409);
  assert.equal(stale.json.code, 'TEMPLATE_REVISION_MISMATCH');

  const r = await rpc<ApplyDiff>('panel-templates/apply', { templateId: t.id, panelId: f.panel.id, expectedRevision: t.revision });
  assert.equal(r.status, 200);
  const ports = await prisma.port.findMany({ where: { panelId: f.panel.id }, include: { cableEndpoint: true, opticalModule: true, ipAddress: true }, orderBy: { sortIndex: 'asc' } });
  assert.deepEqual(ports.map((p) => p.number), ['ge2', 'ge3', 'ge7', 'ge1', 'ge5', 'ge6'], 'template order first, kept ports after');
  const byNo = Object.fromEntries(ports.map((p) => [p.number, p]));
  assert.equal(byNo.ge2.id, p2.id, 'matched by number, same row');
  assert.deepEqual([byNo.ge2.adminState, byNo.ge2.label, byNo.ge2.notes, byNo.ge2.xMm, byNo.ge2.ifName], ['RESERVED', 'uplink', 'keep me', 30, 'GigabitEthernet0/0/2']);
  assert.ok(byNo.ge5.cableEndpoint);
  assert.ok(byNo.ge6.opticalModule);
  assert.ok(byNo.ge1.ipAddress);
  const panel = await panelService.get(prisma, f.panel.id);
  assert.equal(panel.templateId, t.id);
  assert.equal(panel.templateOutdated, false);
});

test('apply refuses conflicts as a whole: a kept port holding a wanted ifName, a module that no longer fits', async () => {
  const f = await fixture({ ports: 2 }); // ge1, ge2
  const [p1, p2] = f.ports;
  await inTx((tx) => tx.port.update({ where: { id: p1.id }, data: { number: 'uplink', ifName: 'GigabitEthernet0/0/9' } }));
  await cable(p1.id);
  const t1 = await createTemplate('NIGHT-SMOKE-c', { version: 1, groups: [{ portType: 'RJ45', count: 1, names: ['ge9'], ifNamePattern: 'GigabitEthernet0/0/9', xMm: 10, yMm: 5 }] });
  const d = await tpl.applyPreview(prisma, t1.id, f.panel.id);
  assert.deepEqual(d.conflicts.map((c) => [c.kind, c.number, c.value]), [['IFNAME_TAKEN', 'uplink', 'GigabitEthernet0/0/9']]);
  const r = await rpc<{ code: string; details: { conflicts: unknown[] } }>('panel-templates/apply', { templateId: t1.id, panelId: f.panel.id, expectedRevision: 1 });
  assert.equal(r.status, 409);
  assert.equal(r.json.code, 'TEMPLATE_CONFLICT');
  assert.equal(r.json.details.conflicts.length, 1);
  assert.equal(await prisma.port.count({ where: { panelId: f.panel.id } }), 2, 'nothing written');
  assert.equal((await prisma.panel.findUniqueOrThrow({ where: { id: f.panel.id } })).templateId, null);

  await inTx((tx) => tx.port.update({ where: { id: p2.id }, data: { portType: 'SFP_PLUS' } }));
  const mod = await inTx((tx) => opticalModuleService.create(tx, moduleCreateSchema.parse({ serialNo: 'NS-SN2', model: 'm', vendor: 'v', moduleType: 'SFP_PLUS' })));
  await inTx((tx) => opticalModuleService.install(tx, { id: mod.id, portId: p2.id }));
  const t2 = await createTemplate('NIGHT-SMOKE-d', { version: 1, groups: [{ portType: 'SFP', count: 1, names: ['ge2'], xMm: 10, yMm: 5 }] });
  const d2 = await tpl.applyPreview(prisma, t2.id, f.panel.id);
  assert.deepEqual(d2.conflicts.map((c) => [c.kind, c.number, c.value]), [['MODULE_DOES_NOT_FIT', 'ge2', 'SFP']]);
  assert.equal(await errCode(inTx((tx) => tpl.apply(tx, { templateId: t2.id, panelId: f.panel.id, expectedRevision: 1 }))), 'TEMPLATE_CONFLICT');
});

test('apply can swap interface names between ports without tripping the unique index', async () => {
  const f = await fixture({ ports: 2 });
  await inTx(async (tx) => {
    await tx.port.update({ where: { id: f.ports[0].id }, data: { ifName: 'B' } });
    await tx.port.update({ where: { id: f.ports[1].id }, data: { ifName: 'A' } });
  });
  const t = await createTemplate('NIGHT-SMOKE-e', { version: 1, groups: [{ portType: 'RJ45', count: 1, names: ['ge1'], ifNamePattern: 'A', xMm: 10, yMm: 5 }, { portType: 'RJ45', count: 1, names: ['ge2'], ifNamePattern: 'B', xMm: 30, yMm: 5 }] });
  await inTx((tx) => tpl.apply(tx, { templateId: t.id, panelId: f.panel.id, expectedRevision: 1 }));
  const ports = await prisma.port.findMany({ where: { panelId: f.panel.id }, orderBy: { sortIndex: 'asc' } });
  assert.deepEqual(ports.map((p) => [p.number, p.ifName]), [['ge1', 'A'], ['ge2', 'B']]);
});

test('batch apply: every device of the model, existing panels updated, missing panels created, one transaction', async () => {
  const a = await fixture({ ports: 2 });
  const model = await prisma.deviceModel.create({ data: { vendor: 'NS', name: 'NIGHT-SMOKE-model', deviceType: 'SWITCH' } });
  await prisma.device.update({ where: { id: a.device.id }, data: { deviceModelId: model.id } });
  await cable(a.ports[0].id);
  const b = await inTx((tx) =>
    deviceService.create(tx, { name: 'NIGHT-SMOKE-sw-b', type: 'SWITCH', deviceModelId: model.id, cabinetId: a.cabinet.id, uPosition: 5, uHeight: 1, serialNo: null, sysname: null, notes: null }),
  );
  const t = await createTemplate('NIGHT-SMOKE-f', gen(4), model.id);

  const listed = await rpc<{ id: string }[]>('panel-templates/list', { deviceModelId: model.id });
  assert.deepEqual(listed.json.map((x) => x.id), [t.id], 'templates offered for the model');

  const pv = await rpc<BatchPreview>('panel-templates/batch-preview', { templateId: t.id });
  assert.equal(pv.status, 200);
  const byDev = Object.fromEntries(pv.json.targets.map((x) => [x.deviceId, x]));
  assert.equal(byDev[a.device.id].panelId, a.panel.id);
  assert.deepEqual(byDev[a.device.id].diff!.create.map((c) => c.number), ['ge3', 'ge4']);
  assert.equal(byDev[b.id].panelId, null);

  const targets = pv.json.targets.map((x) => ({ deviceId: x.deviceId, panelId: x.panelId }));
  const stale = await rpc<{ code: string }>('panel-templates/batch-apply', { templateId: t.id, expectedRevision: 2, targets });
  assert.equal(stale.json.code, 'TEMPLATE_REVISION_MISMATCH');
  const wrong = await rpc<{ code: string }>('panel-templates/batch-apply', { templateId: t.id, expectedRevision: 1, targets: [{ deviceId: b.id, panelId: a.panel.id }] });
  assert.equal(wrong.json.code, 'VALIDATION_ERROR', 'panel must belong to the device');

  const r = await rpc<{ applied: { deviceId: string; created: boolean }[] }>('panel-templates/batch-apply', { templateId: t.id, expectedRevision: 1, targets });
  assert.equal(r.status, 200);
  assert.equal(r.json.applied.length, 2);
  for (const dev of [a.device.id, b.id]) {
    const panels = await prisma.panel.findMany({ where: { deviceId: dev, templateId: t.id }, include: { ports: true, label: true } });
    assert.equal(panels.length, 1);
    assert.equal(panels[0].ports.length, 4);
    assert.ok(panels[0].label, 'new panels get a label');
  }
  assert.ok(await prisma.cableEndpoint.findFirst({ where: { portId: a.ports[0].id } }), 'connection untouched');
});

test('create-panels gives a new device one panel per chosen template', async () => {
  const f = await fixture({ ports: 0 });
  const t1 = await createTemplate('NIGHT-SMOKE-g1', gen(2));
  const t2 = await inTx((tx) =>
    tpl.create(tx, { name: 'NIGHT-SMOKE-g2', type: 'OTHER', face: 'REAR', widthMm: 482.6, heightMm: 88.9, description: null, deviceModelId: null, generator: GENERATOR_PRESETS.serverRear.generator }),
  );
  const r = await rpc<{ id: string }[]>('panel-templates/create-panels', { deviceId: f.device.id, templateIds: [t1.id, t2.id] });
  assert.equal(r.status, 200);
  assert.equal(r.json.length, 2);
  const rear = await prisma.panel.findFirstOrThrow({ where: { deviceId: f.device.id, templateId: t2.id }, include: { ports: { orderBy: { sortIndex: 'asc' } } } });
  assert.equal(rear.face, 'REAR');
  assert.deepEqual(rear.ports.map((p) => p.number), ['PSU1', 'PSU2', 'NIC1', 'NIC2', 'NIC3', 'NIC4', 'BMC', 'USB1', 'USB2', 'VGA']);
});
