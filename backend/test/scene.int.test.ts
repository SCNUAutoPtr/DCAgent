import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { fixture, inTx, prisma, startServer, stopServer, truncateAll } from './helpers';
import { cableService } from '../src/services/cableService';
import { deviceService } from '../src/services/deviceService';
import { panelService } from '../src/services/panelService';
import { portService } from '../src/services/portService';
import { roomService } from '../src/services/hierarchyService';

before(startServer);
after(async () => {
  await stopServer();
  await prisma.$disconnect();
});
beforeEach(truncateAll);

test('rooms/scene lists cable links between devices of the room, one per cable, with port counts', async () => {
  const f = await fixture({ ports: 4 });
  const other = await inTx(async (tx) => {
    const d = await deviceService.create(tx, {
      name: 'srv', type: 'SERVER', cabinetId: f.cabinet.id, uPosition: 5, uHeight: 2, serialNo: null, sysname: null, notes: null,
    });
    const p = await panelService.create(tx, { deviceId: d.id, name: 'nic', type: 'NETWORK', face: 'REAR', notes: null });
    await portService.createBulk(tx, { panelId: p.id, count: 2, prefix: 'eth', startNumber: 0, portType: 'RJ45' });
    return { device: d, ports: await tx.port.findMany({ where: { panelId: p.id }, orderBy: { sortIndex: 'asc' } }) };
  });
  const mk = (a?: string, b?: string) =>
    inTx((tx) =>
      cableService.create(tx, {
        medium: 'FIBER_SM', label: null, color: null, notes: null,
        ends: { A: { portId: a, notes: null }, B: { portId: b, notes: null } },
      }),
    );
  const cross = await mk(f.ports[0].id, other.ports[0].id);
  const loop = await mk(f.ports[1].id, f.ports[2].id);
  await mk(f.ports[3].id); // half connected: no link
  await mk(); // stock: no link

  const scene = await roomService.scene(prisma, f.room.id);
  assert.equal(scene.links.length, 2);
  const c = scene.links.find((l) => l.cableId === cross.id)!;
  assert.equal(c.medium, 'FIBER_SM');
  assert.deepEqual(new Set([c.aDeviceId, c.bDeviceId]), new Set([f.device.id, other.device.id]));
  const l = scene.links.find((x) => x.cableId === loop.id)!;
  assert.equal(l.aDeviceId, f.device.id);
  assert.equal(l.bDeviceId, f.device.id);
  assert.equal(l.aFace, 'FRONT');
  assert.equal(c.aDeviceId === other.device.id ? c.aFace : c.bFace, 'REAR');
  const sw = scene.cabinets[0].devices.find((d) => d.id === f.device.id)!;
  assert.equal(sw.panels[0].portCount, 4);
  assert.equal(sw.panels[0].connectedCount, 4);
});

test('rooms/scene does not list links that leave the room', async () => {
  const a = await fixture({ ports: 1 });
  const b = await fixture({ ports: 1 });
  await inTx((tx) =>
    cableService.create(tx, {
      medium: 'CAT6', label: null, color: null, notes: null,
      ends: { A: { portId: a.ports[0].id, notes: null }, B: { portId: b.ports[0].id, notes: null } },
    }),
  );
  const scene = await roomService.scene(prisma, a.room.id);
  assert.equal(scene.links.length, 0);
  assert.equal(scene.externalLinkCount, 1);
});
