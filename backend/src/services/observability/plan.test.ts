import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEndpointIndex,
  errorGrowthFindings,
  mergeObservations,
  planPortSync,
  planPowerSync,
} from './plan';

const ws = (id: string, name: string, extra: Record<string, unknown> = {}) => ({
  id, name, code: null, ip: null, mac: null, ...extra,
});

test('planPowerSync matches by code, name, ip, then mac and reports every probed seat', () => {
  const workstations = [
    ws('1', 'A-01', { code: 'C445A-01' }),
    ws('2', 'C445A-02'),
    ws('3', 'x', { ip: '198.51.100.7' }),
    ws('4', 'y', { mac: '02:00:00:00:00:04' }),
  ];
  const plan = planPowerSync(
    [
      { name: 'C445A-01', ip: '', mac: '', online: true },
      { name: 'C445A-02', ip: '', mac: '', online: true },
      { name: 'C445A-03', ip: '198.51.100.7', mac: '', online: false },
      { name: 'C445A-04', ip: '', mac: '02-00-00-00-00-04', online: true },
      { name: 'C445A-99', ip: '1.1.1.1', mac: '', online: true },
    ],
    workstations,
  );
  assert.deepEqual(plan.updates, [
    { id: '1', online: true },
    { id: '2', online: true },
    { id: '3', online: false },
    { id: '4', online: true },
  ]);
  assert.deepEqual(plan.unmatched, ['C445A-99']);
});

test('planPortSync accepts seatmap ports.json rows', () => {
  const plan = planPortSync(
    { 'C445A-37': ['445AU12', 'GE0/0/5', '20261023-live'], 'C445A-40': ['445AU6', 'GE0/0/1'], 'NOPE': ['x', 'y'] },
    [ws('1', 'C445A-37'), ws('2', 'C445A-38', { code: 'C445A-40' })],
  );
  assert.deepEqual(plan.matches, [
    { id: '1', seat: 'C445A-37', sysname: '445AU12', ifName: 'GE0/0/5', source: '20261023-live' },
    { id: '2', seat: 'C445A-40', sysname: '445AU6', ifName: 'GE0/0/1', source: null },
  ]);
  assert.deepEqual(plan.unmatched, ['NOPE']);
});

test('mergeObservations combines brief and transceiver rows per interface', () => {
  const rows = mergeObservations(
    [{ interface: 'XGigabitEthernet0/0/1', shortName: 'XGE0/0/1', phy: 'up', protocol: 'up', inUtilPercent: 1, outUtilPercent: 2, inErrors: 5, outErrors: 0 }],
    [
      { interface: 'XGigabitEthernet0/0/1', items: { RxPower: { unit: 'dBm', value: -16.9, highAlarm: 2.5, highWarn: 0.5, lowAlarm: -16.4, lowWarn: -14.4, status: 'Abnormal' }, TxPower: { unit: 'dBm', value: -2.65, highAlarm: null, highWarn: null, lowAlarm: null, lowWarn: null, status: 'Normal' } } },
      { interface: 'XGigabitEthernet0/0/2', items: {} },
    ],
  );
  assert.deepEqual(rows, [
    { ifName: 'XGigabitEthernet0/0/1', phy: 'up', inUtilPercent: 1, outUtilPercent: 2, inErrors: 5, outErrors: 0, rxPowerDbm: -16.9, txPowerDbm: -2.65, rxLowAlarmDbm: -16.4, rxLowWarnDbm: -14.4 },
    { ifName: 'XGigabitEthernet0/0/2', phy: null, inUtilPercent: null, outUtilPercent: null, inErrors: null, outErrors: null, rxPowerDbm: null, txPowerDbm: null, rxLowAlarmDbm: null, rxLowWarnDbm: null },
  ]);
});

test('errorGrowthFindings reports counters that grew since the previous snapshot', () => {
  const findings = errorGrowthFindings(
    [
      { ifName: 'XGigabitEthernet0/0/2', inErrors: 2731, outErrors: 0 },
      { ifName: 'XGigabitEthernet0/0/1', inErrors: 4, outErrors: 0 },
      { ifName: 'GigabitEthernet0/0/7', inErrors: 0, outErrors: 3 },
    ],
    new Map([
      ['XGigabitEthernet0/0/2', { inErrors: 2720, outErrors: 0, collectedAt: new Date('2026-10-23T10:00:00Z') }],
      ['XGigabitEthernet0/0/1', { inErrors: 4, outErrors: 0, collectedAt: new Date('2026-10-23T10:00:00Z') }],
      ['GigabitEthernet0/0/7', { inErrors: 0, outErrors: 10, collectedAt: new Date('2026-10-23T10:00:00Z') }],
    ]),
  );
  // 计数器变小 = 被清零或设备重启，不算增长
  assert.deepEqual(findings.map((f) => [f.interface, f.kind, f.value, f.severity]), [
    ['XGigabitEthernet0/0/2', 'ERRORS_GROWING', 11, 'critical'],
  ]);
});

test('buildEndpointIndex names IPs by workstation, then IP record hostname or device', () => {
  const index = buildEndpointIndex(
    [{ name: 'C445A-01', ip: '198.51.100.5', location: '445A-U6 GE0/0/3' }],
    [
      { address: '203.0.113.13', hostname: null, device: { name: 'GPU服务器4' } },
      { address: '192.0.2.2', hostname: 'NVR', device: null },
      { address: '198.51.100.5', hostname: 'dup', device: null },
    ],
  );
  assert.deepEqual(index.get('198.51.100.5'), { name: 'C445A-01', kind: 'workstation', location: '445A-U6 GE0/0/3' });
  assert.deepEqual(index.get('203.0.113.13'), { name: 'GPU服务器4', kind: 'device' });
  assert.deepEqual(index.get('192.0.2.2'), { name: 'NVR', kind: 'ip' });
});
