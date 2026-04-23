import assert from 'node:assert/strict';
import test from 'node:test';
import searchService from '../services/searchService';
import { hasFieldError, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('POST /api/v1/search/global returns service results', async () => {
  const original = searchService.globalSearch;
  searchService.globalSearch = async (query: string) => [{ type: 'DEVICE', query }] as any;

  try {
    const { response, json } = await postJson('/api/v1/search/global', { query: 'core' });
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ type: 'DEVICE', query: 'core' }]);
  } finally {
    searchService.globalSearch = original;
  }
});

test('POST /api/v1/search/global rejects empty query', async () => {
  const { response, json } = await postJson('/api/v1/search/global', { query: '' });
  assert.equal(response.status, 400);
  assert.equal(json.error, 'Validation error');
  assert.equal(hasFieldError(json.details, 'query'), true);
});

test('POST /api/v1/search/by-shortid returns 404 for missing entity', async () => {
  const original = searchService.findByShortId;
  searchService.findByShortId = async () => null as any;

  try {
    const { response, json } = await postJson('/api/v1/search/by-shortid', { shortId: 10001 });
    assert.equal(response.status, 404);
    assert.equal(json.error, 'Entity not found');
  } finally {
    searchService.findByShortId = original;
  }
});
