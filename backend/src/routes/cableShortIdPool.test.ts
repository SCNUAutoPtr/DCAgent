import assert from 'node:assert/strict';
import test from 'node:test';
import { cableShortIdPoolService } from '../services/cableShortIdPoolService';
import { getJson, hasFieldError, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('POST /api/v1/cable-shortid-pool/generate returns generated ids', async () => {
  const original = cableShortIdPoolService.generateShortIds;
  cableShortIdPoolService.generateShortIds = async () => [10001, 10002];

  try {
    const { response, json } = await postJson('/api/v1/cable-shortid-pool/generate', { count: 2 });
    assert.equal(response.status, 201);
    assert.deepEqual(json.shortIds, [10001, 10002]);
  } finally {
    cableShortIdPoolService.generateShortIds = original;
  }
});

test('POST /api/v1/cable-shortid-pool/check rejects invalid shortId', async () => {
  const { response, json } = await postJson('/api/v1/cable-shortid-pool/check', { shortId: 0 });
  assert.equal(response.status, 400);
  assert.equal(json.error, 'Validation error');
  assert.equal(hasFieldError(json.details, 'shortId'), true);
});

test('GET /api/v1/cable-shortid-pool/stats returns stats payload', async () => {
  const original = cableShortIdPoolService.getPoolStats;
  cableShortIdPoolService.getPoolStats = async () => ({ total: 3, available: 2, used: 1 }) as any;

  try {
    const { response, json } = await getJson('/api/v1/cable-shortid-pool/stats');
    assert.equal(response.status, 200);
    assert.equal(json.total, 3);
  } finally {
    cableShortIdPoolService.getPoolStats = original;
  }
});
