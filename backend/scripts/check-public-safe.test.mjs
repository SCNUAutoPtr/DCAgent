import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from './check-public-safe.mjs';

const kinds = (text, deny = []) => scanText(text, deny).map((f) => f.kind);

test('public IPv4 outside documentation ranges is flagged', () => {
  assert.deepEqual(kinds('gw 8.8.8.8 dns, host 203.0.113.7, 198.51.100.4, 192.0.2.1'), []);
  assert.deepEqual(kinds('server at 11.22.33.44'), ['public-ip']);
});

test('private, loopback, masks and CGNAT', () => {
  assert.deepEqual(kinds('127.0.0.1 0.0.0.0 255.255.255.0 10.20.0.1 192.168.1.1 172.16.0.1'), []);
  assert.deepEqual(kinds('tailnet 100.64.0.3'), ['cgnat-ip']);
});

test('local deny prefixes catch real private ranges, escaped or not', () => {
  assert.deepEqual(kinds('mgmt 10.77.5.1', ['10.77.']), ['deny']);
  assert.deepEqual(kinds('/ssh admin@10\\.77\\.5\\.1/', ['10.77.']), ['deny']);
  assert.deepEqual(kinds('mgmt 10.78.5.1', ['10.77.']), []);
});

test('MAC must be zero, example or locally administered', () => {
  assert.deepEqual(kinds('00:00:00:00:00:00 00:11:22:33:44:55 02:00:00:aa:bb:cc 02-00-00-00-00-04 0200-0000-0004'), []);
  assert.deepEqual(kinds('ac:de:48:00:11:22'), ['mac']);
  assert.deepEqual(kinds('AC-DE-48-00-00-04'), ['mac']);
  assert.deepEqual(kinds('port acde-4800-1122 up'), ['mac']);
});

test('UUID fragments are not MACs', () => {
  assert.deepEqual(kinds('6cd6e3f1-e18f-421a-aeb3-d49c95ca148e'), []);
});

test('absolute home paths are flagged', () => {
  assert.deepEqual(kinds('cd /Users/alice/code/x'), ['home-path']);
  assert.deepEqual(kinds('cd /home/bob/x'), ['home-path']);
  assert.deepEqual(kinds('~/code/x and backend/src'), []);
});

test('version-like strings and ignore marker', () => {
  assert.deepEqual(kinds('5.14.0.687 kernel'), []);
  assert.deepEqual(kinds('legit 11.22.33.44 // public-safe-ignore'), []);
});
