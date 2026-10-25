import assert from 'node:assert/strict';
import test from 'node:test';
import { ifNameOf, portTypeOf, sysnameOf, uuidFrom } from './migrate-from-legacy';

test('sysname comes from the name prefix, with explicit overrides', () => {
  assert.equal(sysnameOf('445A-U6 交换机'), '445A-U6');
  assert.equal(sysnameOf('446stack 堆叠交换机'), '446stack');
  assert.equal(sysnameOf('F13 核心交换机'), '445C-F13');
  assert.equal(sysnameOf('A36 交换机'), null);
});

test('ifName only for named, non-stack switches', () => {
  const sw = { sysname: '445A-U6', type: 'SWITCH' };
  assert.equal(ifNameOf('ge11', sw), 'GigabitEthernet0/0/11');
  assert.equal(ifNameOf('xge2', sw), 'XGigabitEthernet0/0/2');
  assert.equal(ifNameOf('xge1/0/1', { sysname: '446stack', type: 'SWITCH' }), null);
  assert.equal(ifNameOf('ge1', { sysname: null, type: 'SWITCH' }), null);
  assert.equal(ifNameOf('ge1', { sysname: 'x-U1', type: 'SERVER' }), null);
});

test('port types and deterministic ids', () => {
  assert.equal(portTypeOf('SFP+'), 'SFP_PLUS');
  assert.equal(portTypeOf('rj45'), 'RJ45');
  assert.equal(portTypeOf('weird'), null);
  assert.equal(uuidFrom('a'), uuidFrom('a'));
  assert.match(uuidFrom('a'), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-a[0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('placeholder model strings are not catalog models; their text moves into the notes and back', async () => {
  const { modelNameOf, deviceNotesOf, splitDeviceNotes } = await import('./migrate-from-legacy');
  assert.equal(modelNameOf(' SR650 '), 'SR650');
  assert.equal(modelNameOf('未确认'), null);
  assert.equal(modelNameOf('台式机'), null);
  assert.equal(modelNameOf(''), null);
  assert.equal(modelNameOf(null), null);
  assert.equal(deviceNotesOf(null, 'SR650'), null);
  assert.equal(deviceNotesOf('rack A', null), 'rack A');
  const n = deviceNotesOf('old note', '台式机');
  assert.deepEqual(splitDeviceNotes(n), ['old note', '台式机']);
  assert.deepEqual(splitDeviceNotes(deviceNotesOf(null, '未确认')), [null, '未确认']);
  assert.deepEqual(splitDeviceNotes('plain'), ['plain', null]);
  assert.deepEqual(splitDeviceNotes(null), [null, null]);
});

test('digestDiff names the tables whose content changed', async () => {
  const { digestDiff } = await import('./migrate-from-legacy');
  const base = { Device: 'a', Panel: 'b' } as Record<string, string>;
  assert.deepEqual(digestDiff(base, { ...base }).filter((t) => t === 'Device' || t === 'Panel'), []);
  assert.ok(digestDiff(base, { ...base, Panel: 'x' }).includes('Panel'));
  assert.ok(!digestDiff(base, { ...base, Panel: 'x' }).includes('Device'));
});
