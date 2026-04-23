import assert from 'node:assert/strict';
import test from 'node:test';
import { shortIdPoolService } from '../services/shortIdPoolService';
import { getJson, hasFieldError, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('POST /api/v1/shortid-pool/check accepts formatted shortId string', async () => {
  const original = shortIdPoolService.checkShortIdExists;
  shortIdPoolService.checkShortIdExists = async (shortId: number) => ({ exists: true, usedBy: 'pool', shortId }) as any;

  try {
    const { response, json } = await postJson('/api/v1/shortid-pool/check', { shortId: 'E-10001' });
    assert.equal(response.status, 200);
    assert.equal(json.exists, true);
    assert.equal(json.shortId, 10001);
  } finally {
    shortIdPoolService.checkShortIdExists = original;
  }
});

test('POST /api/v1/shortid-pool/generate rejects excessive count', async () => {
  const { response, json } = await postJson('/api/v1/shortid-pool/generate', { count: 10001 });
  assert.equal(response.status, 400);
  assert.equal(json.error, 'Validation error');
  assert.equal(hasFieldError(json.details, 'count'), true);
});

test('GET /api/v1/shortid-pool/stats returns service stats', async () => {
  const original = shortIdPoolService.getPoolStats;
  shortIdPoolService.getPoolStats = async () => ({ total: 10, generated: 8, printed: 1, bound: 1, cancelled: 0 }) as any;

  try {
    const { response, json } = await getJson('/api/v1/shortid-pool/stats');
    assert.equal(response.status, 200);
    assert.equal(json.total, 10);
  } finally {
    shortIdPoolService.getPoolStats = original;
  }
});

test('POST /api/v1/shortid-pool/records returns paged records', async () => {
  const original = shortIdPoolService.getPoolRecords;
  shortIdPoolService.getPoolRecords = async () => ({ records: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }) as any;

  try {
    const { response, json } = await postJson('/api/v1/shortid-pool/records', { page: 1, pageSize: 50 });
    assert.equal(response.status, 200);
    assert.deepEqual(json.records, []);
  } finally {
    shortIdPoolService.getPoolRecords = original;
  }
});
