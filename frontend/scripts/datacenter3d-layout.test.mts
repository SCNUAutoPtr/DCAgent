// Pure layout maths of the 3D room view (src/pages/datacenter3d/layout.ts).
// Node strips the TypeScript types; the hook below only maps the @contracts alias like vite does.
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contracts = path.resolve(root, '../backend/src/contracts');
registerHooks({
  resolve(specifier, context, next) {
    if (specifier.startsWith('@contracts/')) return next(pathToFileURL(path.join(contracts, `${specifier.slice(11)}.ts`)).href, context);
    return next(specifier, context);
  },
});
const L = await import(pathToFileURL(path.join(root, 'src/pages/datacenter3d/layout.ts')).href);

const cab = (over = {}) => ({
  id: 'c', name: 'c', label: null, fpX: null, fpY: null, fpW: null, fpD: null, fpRotation: 0, heightU: 42, devices: [], ...over,
});
const dev = (over = {}) => ({ id: 'd', name: 'd', type: 'SERVER', uPosition: 1, uHeight: 1, deviceModel: null, panels: [], ...over });
const close = (a: number, b: number, msg?: string) => assert.ok(Math.abs(a - b) < 1e-6, `${msg ?? ''} ${a} != ${b}`);

test('a positioned cabinet is centred on its footprint; defaults 0.6 x 1.2 m', () => {
  const { placements } = L.placeCabinets([cab({ fpX: 2, fpY: 3 })], { widthM: 10, depthM: 8 });
  const p = placements.get('c');
  close(p.cx, 2.3);
  close(p.cz, 3.6);
  close(p.w, 0.6);
  close(p.d, 1.2);
  assert.equal(p.auto, false);
});

test('a cabinet rotated 90 degrees swaps its footprint and faces +x', () => {
  const { placements } = L.placeCabinets([cab({ fpX: 0, fpY: 0, fpRotation: 90 })], { widthM: null, depthM: null });
  const p = placements.get('c');
  close(p.cx, 0.6);
  close(p.cz, 0.3);
  const front = L.toWorld(p, 0, 0, -p.d / 2);
  close(front.x, 0.6 + 0.6);
  close(front.z, 0.3);
});

test('cabinets without coordinates go on a grid below the positioned ones and never overlap', () => {
  const cabs = [cab({ id: 'a', fpX: 1, fpY: 1 }), ...Array.from({ length: 10 }, (_, i) => cab({ id: `g${i}` }))];
  const { placements, roomW, roomD } = L.placeCabinets(cabs, { widthM: null, depthM: null });
  const grid = [...placements.values()].filter((p) => p.auto);
  assert.equal(grid.length, 10);
  for (const g of grid) assert.ok(g.cz - g.d / 2 > 1 + 1.2, 'below the positioned cabinet');
  for (const a of grid) for (const b of grid) if (a !== b) assert.ok(Math.abs(a.cx - b.cx) >= 0.6 - 1e-9 || Math.abs(a.cz - b.cz) >= 1.2, 'no overlap');
  for (const p of placements.values()) {
    assert.ok(p.cx + p.w / 2 <= roomW && p.cz + p.d / 2 <= roomD, 'room grows to fit');
  }
});

test('grid cabinets also stay clear of the workstations on the plan', () => {
  const ws = { id: 'w', name: 'w', fpX: 0.5, fpY: 0.5, fpW: 1.2, fpD: 0.6, online: false, adminState: 'ACTIVE' };
  const { placements } = L.placeCabinets([cab()], { widthM: 10, depthM: 5 }, [ws]);
  const p = placements.get('c');
  assert.ok(p.cz - p.d / 2 > 0.5 + 0.6, 'below the desk');
});

test('the room keeps its own size when it is large enough', () => {
  const { roomW, roomD } = L.placeCabinets([cab({ fpX: 1, fpY: 1 })], { widthM: 12, depthM: 9 });
  assert.equal(roomW, 12);
  assert.equal(roomD, 9);
});

test('device boxes follow U position and height, front aligned, depth from the model', () => {
  const { placements } = L.placeCabinets([cab({ fpX: 0, fpY: 0 })], { widthM: null, depthM: null });
  const p = placements.get('c');
  const b = L.deviceBox(p, 42, dev({ uPosition: 3, uHeight: 2, deviceModel: { id: 'm', name: 'm', depthMm: 600 } }));
  close(b.y0, L.CABINET_BASE_M + 2 * L.U_M);
  assert.ok(b.h < 2 * L.U_M && b.h > 1.9 * L.U_M);
  close(b.depth, 0.6);
  close(b.zCenter - b.depth / 2, -p.d / 2 + L.RAIL_INSET_M);
  assert.equal(L.deviceBox(p, 42, dev({ uPosition: null })), null);
  assert.equal(L.deviceBox(p, 42, dev({ uPosition: 42, uHeight: 2 })), null, 'out of the cabinet');
});

test('port usage and occupancy colours', () => {
  const d = dev({ panels: [{ id: 'p', name: 'p', face: 'FRONT', portCount: 4, connectedCount: 1 }, { id: 'q', name: 'q', face: 'REAR', portCount: 4, connectedCount: 3 }] });
  assert.deepEqual(L.portUsage(d), { total: 8, connected: 4, ratio: 0.5 });
  assert.equal(L.portUsage(dev()).ratio, null);
  assert.equal(L.occupancyColor(null), L.NO_DATA_COLOR);
  assert.notEqual(L.occupancyColor(0), L.occupancyColor(1));
  assert.match(L.occupancyColor(0.5), /^#[0-9a-f]{6}$/);
});

test('U usage of a cabinet counts placed devices only', () => {
  const c = cab({ heightU: 10, devices: [dev({ uHeight: 2 }), dev({ id: 'x', uPosition: null, uHeight: 4 })] });
  assert.deepEqual(L.uUsage(c), { used: 2, total: 10, ratio: 0.2 });
});

test('a link arc rises above both ends; a loop on one device still has length', () => {
  const a = { x: 0, y: 1, z: 0 };
  const b = { x: 4, y: 0.5, z: 0 };
  const mid = L.arcControl(a, b);
  assert.ok(mid.y > 1);
  close(mid.x, 2);
  const loop = L.arcControl(a, a);
  assert.ok(loop.y > a.y);
});
