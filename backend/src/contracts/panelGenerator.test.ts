import assert from 'node:assert/strict';
import test from 'node:test';
import { GENERATOR_PRESETS, GeneratorError, generatePorts as pure, generatorIssues, pruneOverrides } from './panelGenerator';
import { generatePorts, generatorSchema, templateDocSchema } from './panelTemplates';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

test('48 x RJ45 + 4 x SFP+, two rows, odd top / even bottom, Huawei names', () => {
  const ports = pure(GENERATOR_PRESETS.switch48ge4xge.generator);
  assert.equal(ports.length, 52);
  const ge1 = ports.find((p) => p.number === 'ge1')!;
  const ge2 = ports.find((p) => p.number === 'ge2')!;
  const ge3 = ports.find((p) => p.number === 'ge3')!;
  assert.equal(ge1.xMm, ge2.xMm, 'ge1 above ge2');
  assert.ok(ge1.yMm < ge2.yMm, 'odd on top');
  assert.ok(ge3.xMm > ge1.xMm);
  assert.equal(ge1.yMm, ge3.yMm);
  assert.equal(ge1.ifName, 'GigabitEthernet0/0/1');
  const xge = ports.filter((p) => p.portType === 'SFP_PLUS');
  assert.deepEqual(xge.map((p) => p.number), ['xge1', 'xge2', 'xge3', 'xge4']);
  assert.equal(xge[0].ifName, 'XGigabitEthernet0/0/1');
  const lastGe = ports.find((p) => p.number === 'ge48')!;
  // the SFP+ group starts after the RJ45 block plus its gap
  assert.equal(xge[0].xMm, Math.round((lastGe.xMm + lastGe.wMm + 12) * 100) / 100);
  assert.deepEqual(ports.map((p) => p.sortIndex), ports.map((_, i) => i + 1));
});

test('prefix numbering like GE0/0/1 and index step', () => {
  const ports = pure({ version: 1, groups: [{ portType: 'RJ45', count: 3, numberPrefix: 'GE0/0/', startIndex: 0, indexStep: 2, ifNamePattern: 'GigabitEthernet0/0/{n}' }] });
  assert.deepEqual(ports.map((p) => [p.number, p.ifName]), [
    ['GE0/0/0', 'GigabitEthernet0/0/0'],
    ['GE0/0/2', 'GigabitEthernet0/0/2'],
    ['GE0/0/4', 'GigabitEthernet0/0/4'],
  ]);
});

test('24-port patch panel numbers 1..24 in one row', () => {
  const ports = pure(GENERATOR_PRESETS.patchPanel24.generator);
  assert.equal(ports.length, 24);
  assert.equal(ports[0].number, '1');
  assert.equal(ports[23].number, '24');
  assert.equal(new Set(ports.map((p) => p.yMm)).size, 1);
});

test('server rear: 2 PSU + 4 NIC + BMC + 2 USB + VGA with explicit names', () => {
  const p = GENERATOR_PRESETS.serverRear;
  const ports = pure(p.generator, { panelHeightMm: p.heightMm });
  assert.deepEqual(ports.map((x) => x.number), ['PSU1', 'PSU2', 'NIC1', 'NIC2', 'NIC3', 'NIC4', 'BMC', 'USB1', 'USB2', 'VGA']);
  const bmc = ports.find((x) => x.number === 'BMC')!;
  // vertically centred on a 2U plate
  assert.equal(bmc.yMm, Math.round(((p.heightMm - bmc.hMm) / 2) * 100) / 100);
  for (const x of ports) assert.ok(x.xMm + x.wMm <= p.widthMm, `${x.number} inside the plate`);
  // groups never overlap horizontally
  const nic4 = ports.find((x) => x.number === 'NIC4')!;
  assert.ok(bmc.xMm >= nic4.xMm + nic4.wMm);
});

test('overrides move single ports (drag adjustment) and are validated', () => {
  const gen = { version: 1 as const, groups: [{ portType: 'RJ45' as const, count: 2, numberPrefix: 'p', xMm: 10, yMm: 5 }], overrides: [{ number: 'p2', xMm: 100, yMm: 20 }] };
  const ports = pure(gen);
  assert.deepEqual([ports[1].xMm, ports[1].yMm], [100, 20]);
  assert.deepEqual(generatorIssues({ ...gen, overrides: [{ number: 'nope', xMm: 0, yMm: 0 }] }), [{ kind: 'UNKNOWN_OVERRIDE', value: 'nope' }]);
  assert.equal(pruneOverrides({ ...gen, groups: [{ ...gen.groups[0], count: 1 }] }).overrides, undefined);
});

test('duplicates and bad names are reported, not silently fixed', () => {
  assert.throws(
    () => pure({ version: 1, groups: [{ portType: 'RJ45', count: 2, names: ['a', 'a'] }] }),
    (e: unknown) => e instanceof GeneratorError && e.issues[0].kind === 'DUPLICATE_NUMBER',
  );
  assert.deepEqual(generatorIssues({ version: 1, groups: [{ portType: 'RJ45', count: 2, names: ['a'] }] }), [{ kind: 'NAMES_COUNT_MISMATCH', value: '1' }]);
  assert.deepEqual(
    generatorIssues({ version: 1, groups: [{ portType: 'RJ45', count: 1, numberPrefix: 'a', ifNamePattern: 'x' }, { portType: 'RJ45', count: 1, numberPrefix: 'b', ifNamePattern: 'x' }] }),
    [{ kind: 'DUPLICATE_IFNAME', value: 'x' }],
  );
  // zod guards the shape before the pure function runs
  assert.throws(() => generatePorts({ version: 2, groups: [] }));
  assert.ok(generatorSchema.safeParse(GENERATOR_PRESETS.serverRear.generator).success);
});

test('template-kit examples are valid exchange documents', () => {
  const dir = path.join(__dirname, '..', '..', '..', 'template-kit', 'examples');
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 6);
  for (const f of files) {
    const doc = templateDocSchema.parse(JSON.parse(readFileSync(path.join(dir, f), 'utf8')));
    for (const t of doc.templates) {
      const ports = t.generator ? generatePorts(t.generator, { panelHeightMm: t.heightMm }) : t.ports!;
      for (const p of ports) assert.ok(p.xMm + p.wMm <= t.widthMm && p.yMm + p.hMm <= t.heightMm, `${f}: ${p.number} inside the plate`);
    }
  }
});
