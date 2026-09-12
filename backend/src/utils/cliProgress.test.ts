import assert from 'node:assert/strict';
import test from 'node:test';
import { formatProgressBar, formatProgressLine } from './cliProgress';

test('formatProgressBar renders empty, partial, and full bars', () => {
  assert.equal(formatProgressBar(0, 10, 10), '----------');
  assert.equal(formatProgressBar(5, 10, 10), '#####-----');
  assert.equal(formatProgressBar(10, 10, 10), '##########');
});

test('formatProgressLine includes phase, counts, percent, and label', () => {
  const line = formatProgressLine({
    phase: '导入设备',
    completed: 25,
    total: 100,
    label: 'F21 SR660V2',
    width: 10,
  });

  assert.match(line, /导入设备/);
  assert.match(line, /25\/100/);
  assert.match(line, /25%/);
  assert.match(line, /F21 SR660V2/);
  assert.match(line, /\[###-------\]/);
});
