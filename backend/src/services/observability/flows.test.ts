import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { FlowWindow, parseFlowLine } from './flows';

const lines = readFileSync(path.join(__dirname, 'fixtures', 'goflow2-sample.jsonl'), 'utf8').trim().split('\n');

test('parseFlowLine reads sFlow record and scales bytes by sampling rate', () => {
  const flow = parseFlowLine(lines[0]);
  assert.deepEqual(flow, {
    type: 'SFLOW_5',
    sampler: '192.0.2.41',
    src: '10.99.31.201',
    dst: '198.51.100.115',
    proto: 'TCP',
    srcPort: 678,
    dstPort: 1049,
    bytes: 68 * 1024,
    packets: 1024,
    timeMs: Math.floor(1792757331494458785 / 1e6),
  });
});

test('parseFlowLine uses per-sampler default when NetFlow reports sampling_rate 0', () => {
  const netflow = lines.find((l) => l.includes('NETFLOW_V9'))!;
  assert.equal(parseFlowLine(netflow)?.bytes, 105);
  assert.equal(parseFlowLine(netflow, { '192.0.2.12': 1024 })?.bytes, 105 * 1024);
});

test('parseFlowLine ignores counter samples and garbage', () => {
  assert.equal(parseFlowLine('not json'), null);
  assert.equal(parseFlowLine('{"type":"SFLOW_5","sampler_address":"1.1.1.1"}'), null);
  assert.equal(parseFlowLine(''), null);
});

const flow = (src: string, dst: string, bytes: number, timeMs: number, sampler = 's1') => ({
  type: 'SFLOW_5', sampler, src, dst, proto: 'TCP', srcPort: 1, dstPort: 443, bytes, packets: 1, timeMs,
});

test('FlowWindow.top aggregates by conversation inside the window', () => {
  const w = new FlowWindow(1000);
  w.add([flow('a', 'b', 100, 1000), flow('a', 'b', 50, 2000), flow('c', 'd', 120, 2500), flow('x', 'y', 999, 0)]);
  const top = w.top({ now: 3000, windowMs: 2500 });
  assert.deepEqual(top.map((r) => [r.src, r.dst, r.bytes, r.records]), [
    ['a', 'b', 150, 2],
    ['c', 'd', 120, 1],
  ]);
  assert.equal(top[0].bitsPerSecond, Math.round((150 * 8) / 2.5));
});

test('FlowWindow.top can filter by sampler and limit', () => {
  const w = new FlowWindow(1000);
  w.add([flow('a', 'b', 100, 1000, 's1'), flow('c', 'd', 300, 1000, 's2'), flow('e', 'f', 200, 1000, 's2')]);
  const top = w.top({ now: 1000, windowMs: 1000, sampler: 's2', limit: 1 });
  assert.deepEqual(top.map((r) => r.src), ['c']);
});

test('FlowWindow keeps at most capacity records', () => {
  const w = new FlowWindow(2);
  w.add([flow('a', 'b', 1, 1), flow('c', 'd', 1, 2), flow('e', 'f', 1, 3)]);
  assert.equal(w.size(), 2);
  assert.deepEqual(w.samplers(), ['s1']);
});
