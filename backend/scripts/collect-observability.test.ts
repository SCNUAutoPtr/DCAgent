import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { labPowerCsvToRows, opticalPortsUp, switchRemoteCommand, takeBatches } from './collect-observability';

test('takeBatches drains the buffer in fixed-size chunks', () => {
  const buffer = ['a', 'b', 'c', 'd', 'e'];
  assert.deepEqual(takeBatches(buffer, 2), [['a', 'b'], ['c', 'd'], ['e']]);
  assert.equal(buffer.length, 0);
});

test('opticalPortsUp picks only 10G-and-up ports that are up', () => {
  const brief = readFileSync(path.join(__dirname, '..', 'src', 'services', 'observability', 'fixtures', 'f13-interface-brief.txt'), 'utf8');
  assert.deepEqual(opticalPortsUp(brief), [
    'XGigabitEthernet0/0/1',
    'XGigabitEthernet0/0/2',
    'XGigabitEthernet0/0/3',
    'XGigabitEthernet0/0/4',
  ]);
});

test('switchRemoteCommand keeps the password out of the command line', () => {
  const cmd = switchRemoteCommand('192.0.2.31', ['display interface brief'], 'netadmin');
  assert.match(cmd, /^read -r SSHPASS; export SSHPASS;/);
  assert.match(cmd, /sshpass -e ssh -tt -o ConnectTimeout=8 netadmin@192\.0\.2\.31/);
  assert.match(cmd, /screen-length 0 temporary\\ndisplay interface brief\\nquit\\n/);
});

test('labPowerCsvToRows maps status 4 to online', () => {
  assert.deepEqual(labPowerCsvToRows('room,name,ip,mac,status\nX,C445A-01,10.0.0.5,AA,4\nX,C445A-02,10.0.0.6,BB,0\n'), [
    { name: 'C445A-01', ip: '10.0.0.5', mac: 'AA', online: true },
    { name: 'C445A-02', ip: '10.0.0.6', mac: 'BB', online: false },
  ]);
});
