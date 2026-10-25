import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import * as enums from './enums';
import { normalizeIfName, shortIfName, sysnameKey, trailingNumber } from './ifName';
import { formatShortId, parseRangeExpr, parseShortId } from './labels';
import { calculateSubnet, parseCidr, subnetCapacity } from './ip';
import { expandIfName, generatePorts } from './panelTemplates';
import { isOnline } from './workstations';

test('enums.ts matches the Prisma schema', () => {
  const schema = readFileSync(path.join(__dirname, '..', '..', 'prisma', 'schema.prisma'), 'utf8');
  const prismaEnum = (name: string) => {
    const m = new RegExp(`enum ${name} \\{([^}]*)\\}`).exec(schema);
    assert.ok(m, `enum ${name} missing in schema`);
    return m[1].split('\n').map((l) => l.trim()).filter(Boolean);
  };
  const pairs: [string, readonly string[]][] = [
    ['DeviceType', enums.DEVICE_TYPES], ['PanelType', enums.PANEL_TYPES], ['PanelFace', enums.PANEL_FACES], ['PortType', enums.PORT_TYPES],
    ['PortAdminState', enums.PORT_ADMIN_STATES], ['CableMedium', enums.CABLE_MEDIA], ['ConnectorType', enums.CONNECTOR_TYPES],
    ['CableEnd', enums.CABLE_ENDS], ['LabelState', enums.LABEL_STATES], ['PrintTaskStatus', enums.PRINT_TASK_STATUSES],
    ['ModuleStatus', enums.MODULE_STATUSES], ['TransceiverForm', enums.TRANSCEIVER_FORMS], ['MovementType', enums.MOVEMENT_TYPES],
    ['IpStatus', enums.IP_STATUSES], ['WorkstationAdminState', enums.WORKSTATION_ADMIN_STATES], ['UnmatchedSource', enums.UNMATCHED_SOURCES],
  ];
  for (const [name, values] of pairs) assert.deepEqual([...values], prismaEnum(name), name);
});

test('interface names normalise to the long form', () => {
  assert.equal(normalizeIfName('GE0/0/1'), 'GigabitEthernet0/0/1');
  assert.equal(normalizeIfName('XGE0/0/2'), 'XGigabitEthernet0/0/2');
  assert.equal(normalizeIfName('XGigabitEthernet0/0/2'), 'XGigabitEthernet0/0/2');
  assert.equal(normalizeIfName(' Vlanif10 '), 'Vlanif10');
  assert.equal(shortIfName('GigabitEthernet0/0/1'), 'GE0/0/1');
  assert.equal(sysnameKey('445A-U6'), sysnameKey('445au6'));
  assert.equal(trailingNumber('ge11'), 11);
  assert.equal(trailingNumber('xge1/0/1'), 1);
  assert.equal(trailingNumber('BMC'), null);
});

test('shortId format and range expressions', () => {
  assert.equal(formatShortId(1), 'E-00001');
  assert.equal(formatShortId(941306), 'E-941306');
  assert.equal(parseShortId('E-00012'), 12);
  assert.deepEqual(parseRangeExpr('1-3, 8, E-00010-E-00011, 2'), [1, 2, 3, 8, 10, 11]);
  assert.throws(() => parseRangeExpr('5-1'));
  assert.throws(() => parseRangeExpr('1-20000'));
});

test('subnet math', () => {
  assert.deepEqual(parseCidr('10.0.0.0/8'), { network: '10.0.0.0', prefix: 8 });
  assert.equal(parseCidr('10.0.0.0/33'), null);
  assert.equal(subnetCapacity(24), 254);
  assert.equal(subnetCapacity(31), 2);
  const c = calculateSubnet({ network: '192.168.99.0', prefix: 24 });
  assert.equal(c.broadcastAddress, '192.168.99.255');
  assert.equal(c.firstUsableIp, '192.168.99.1');
});

test('generatePorts lays out a two-row switch, column-major', () => {
  const ports = generatePorts({
    version: 1,
    groups: [{ portType: 'RJ45', count: 4, numberPrefix: 'ge', rows: 2, order: 'COLUMN_MAJOR', xMm: 10, yMm: 5, pitchXMm: 20, pitchYMm: 15, ifNamePattern: 'GigabitEthernet0/0/{n}' }],
  });
  assert.deepEqual(ports.map((p) => [p.number, p.xMm, p.yMm, p.ifName, p.sortIndex]), [
    ['ge1', 10, 5, 'GigabitEthernet0/0/1', 1],
    ['ge2', 10, 20, 'GigabitEthernet0/0/2', 2],
    ['ge3', 30, 5, 'GigabitEthernet0/0/3', 3],
    ['ge4', 30, 20, 'GigabitEthernet0/0/4', 4],
  ]);
  assert.equal(ports[0].wMm, 16);
  assert.throws(() => generatePorts({ version: 1, groups: [{ portType: 'RJ45', count: 1, xMm: 0, yMm: 0, pitchXMm: 1 }, { portType: 'SFP', count: 1, xMm: 0, yMm: 0, pitchXMm: 1 }] }), /duplicate/);
  assert.equal(expandIfName('XGigabitEthernet0/0/{n}', 'xge3'), 'XGigabitEthernet0/0/3');
});

test('online is derived from the probe timestamps', () => {
  assert.equal(isOnline(null, null), false);
  assert.equal(isOnline('2026-10-23T10:00:00Z', '2026-10-23T10:00:00Z'), true);
  assert.equal(isOnline('2026-10-23T09:00:00Z', '2026-10-23T10:00:00Z'), false);
});
