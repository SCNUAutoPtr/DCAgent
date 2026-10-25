import assert from 'node:assert/strict';
import test from 'node:test';
import { assertNotLegacy, assertTestDb, dbName, withDb } from './assertDb';

const base = 'postgresql://u:p@localhost:5432/dcagent?schema=public';

test('assertTestDb accepts only *_test databases', () => {
  assert.equal(assertTestDb(withDb(base, 'dcagent_test')), 'dcagent_test');
  assert.throws(() => assertTestDb(base), /must end with _test/);
  assert.throws(() => assertTestDb(withDb(base, 'dcagent_legacy')), /must end with _test/);
});

test('assertNotLegacy refuses the legacy database', () => {
  assert.equal(assertNotLegacy(base), 'dcagent');
  assert.throws(() => assertNotLegacy(withDb(base, 'dcagent_legacy')), /legacy/);
});

test('withDb keeps the query string', () => {
  assert.equal(dbName(withDb(base, 'x_test')), 'x_test');
  assert.match(withDb(base, 'x_test'), /schema=public/);
});
