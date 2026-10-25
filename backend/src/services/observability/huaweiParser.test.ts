import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {
  assessPortHealth,
  parseInterfaceBrief,
  parseTransceiverDiagnosis,
  shortInterfaceName,
} from './huaweiParser';

const fixture = (name: string) => readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');

test('shortInterfaceName abbreviates Huawei interface names', () => {
  assert.equal(shortInterfaceName('XGigabitEthernet0/0/2'), 'XGE0/0/2');
  assert.equal(shortInterfaceName('GigabitEthernet0/0/7'), 'GE0/0/7');
  assert.equal(shortInterfaceName('MultiGE0/0/1'), 'MultiGE0/0/1');
  assert.equal(shortInterfaceName('Vlanif3010'), 'Vlanif3010');
});

test('parseInterfaceBrief reads physical ports from real F13 output', () => {
  const rows = parseInterfaceBrief(fixture('f13-interface-brief.txt'));
  const xge2 = rows.find((r) => r.interface === 'XGigabitEthernet0/0/2');
  assert.deepEqual(xge2, {
    interface: 'XGigabitEthernet0/0/2',
    shortName: 'XGE0/0/2',
    phy: 'up',
    protocol: 'up',
    inUtilPercent: 0,
    outUtilPercent: 0,
    inErrors: 2731,
    outErrors: 0,
  });
  const ge7 = rows.find((r) => r.shortName === 'GE0/0/7');
  assert.equal(ge7?.inUtilPercent, 0.59);
  assert.equal(ge7?.outUtilPercent, 1.06);
  assert.equal(rows.find((r) => r.shortName === 'GE0/0/6')?.phy, 'down');
  // Vlanif 的利用率是 "--"，记成 null
  assert.equal(rows.find((r) => r.interface === 'Vlanif3010')?.inUtilPercent, null);
  assert.equal(rows.filter((r) => r.interface.startsWith('XGigabitEthernet')).length, 4);
});

test('parseInterfaceBrief keeps flap markers like *down and ^down', () => {
  const rows = parseInterfaceBrief(
    'GigabitEthernet0/0/9        *down down         0%     0%          0          0\n' +
      'GigabitEthernet0/0/10       ^down down         0%     0%          0          0\n',
  );
  assert.deepEqual(rows.map((r) => r.phy), ['*down', '^down']);
});

test('parseTransceiverDiagnosis reads Tx/Rx power and thresholds per port', () => {
  const ports = parseTransceiverDiagnosis(fixture('445a-u6-transceiver.txt'));
  assert.deepEqual(ports.map((p) => p.interface), ['XGigabitEthernet0/0/1', 'XGigabitEthernet0/0/2']);
  assert.deepEqual(ports[0].items.RxPower, {
    unit: 'dBm',
    value: -16.9,
    highAlarm: 2.5,
    highWarn: 0.5,
    lowAlarm: -16.4,
    lowWarn: -14.4,
    status: 'Abnormal',
  });
  assert.equal(ports[1].items.RxPower.value, -2.51);
  assert.equal(ports[0].items.Temperature.unit, 'C');
  // 没有数据的行（"-"）不收
  assert.equal(ports[0].items.LaserTemp, undefined);
});

test('assessPortHealth flags low rx power and CRC errors like the 445A fiber case', () => {
  const findings = assessPortHealth({
    interfaces: parseInterfaceBrief(fixture('f13-interface-brief.txt')),
    transceivers: parseTransceiverDiagnosis(fixture('445a-u6-transceiver.txt')),
  });

  const rx = findings.find((f) => f.kind === 'RX_POWER' && f.interface === 'XGigabitEthernet0/0/1');
  assert.equal(rx?.severity, 'critical');
  assert.equal(rx?.value, -16.9);
  assert.equal(rx?.marginDb, -0.5);

  const errors = findings.find((f) => f.kind === 'INPUT_ERRORS' && f.interface === 'XGigabitEthernet0/0/2');
  assert.equal(errors?.severity, 'critical');
  assert.equal(errors?.value, 2731);

  const small = findings.find((f) => f.kind === 'INPUT_ERRORS' && f.interface === 'XGigabitEthernet0/0/1');
  assert.equal(small?.severity, 'warning');

  // 正常光功率不报
  assert.equal(findings.some((f) => f.kind === 'RX_POWER' && f.interface === 'XGigabitEthernet0/0/2'), false);
  // critical 排在前面
  assert.equal(findings[0].severity, 'critical');
});

test('assessPortHealth warns when rx power is inside the warning band', () => {
  const findings = assessPortHealth({
    interfaces: [],
    transceivers: [
      {
        interface: 'XGigabitEthernet0/0/3',
        items: {
          RxPower: { unit: 'dBm', value: -15, highAlarm: 2.5, highWarn: 0.5, lowAlarm: -16.4, lowWarn: -14.4, status: 'Normal' },
        },
      },
    ],
  });
  assert.equal(findings.length, 1);
  assert.equal(findings[0].severity, 'warning');
  assert.equal(findings[0].marginDb, 1.4);
});

test('assessPortHealth flags high utilization', () => {
  const findings = assessPortHealth({
    interfaces: [
      { interface: 'GigabitEthernet0/0/7', shortName: 'GE0/0/7', phy: 'up', protocol: 'up', inUtilPercent: 85, outUtilPercent: 3, inErrors: 0, outErrors: 0 },
    ],
    transceivers: [],
  });
  assert.deepEqual(findings.map((f) => [f.kind, f.severity, f.value]), [['UTILIZATION', 'warning', 85]]);
});
