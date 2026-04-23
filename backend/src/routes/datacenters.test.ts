import assert from 'node:assert/strict';
import test from 'node:test';
import dataCenterService from '../services/dataCenterService';
import { getJson, hasFieldError, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('GET /api/v1/datacenters returns search results', async () => {
  const original = dataCenterService.searchDataCenters;
  dataCenterService.searchDataCenters = async (query: string) => [{ id: 'dc-1', name: query }] as any;

  try {
    const { response, json } = await getJson('/api/v1/datacenters?search=beijing');
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'dc-1', name: 'beijing' }]);
  } finally {
    dataCenterService.searchDataCenters = original;
  }
});

test('POST /api/v1/datacenters/get returns 404 when service returns null', async () => {
  const original = dataCenterService.getDataCenterById;
  dataCenterService.getDataCenterById = async () => null as any;

  try {
    const { response, json } = await postJson('/api/v1/datacenters/get', {
      id: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(response.status, 404);
    assert.equal(json.error, 'DataCenter not found');
  } finally {
    dataCenterService.getDataCenterById = original;
  }
});

test('POST /api/v1/datacenters/create rejects empty name', async () => {
  const { response, json } = await postJson('/api/v1/datacenters/create', {
    name: '',
  });

  assert.equal(response.status, 400);
  assert.equal(json.error, 'Validation error');
  assert.equal(hasFieldError(json.details, 'name'), true);
});

test('POST /api/v1/datacenters/delete returns success payload', async () => {
  const original = dataCenterService.deleteDataCenter;
  dataCenterService.deleteDataCenter = async () => ({ id: 'dc-1' } as any);

  try {
    const { response, json } = await postJson('/api/v1/datacenters/delete', {
      id: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(response.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.message, 'DataCenter deleted successfully');
  } finally {
    dataCenterService.deleteDataCenter = original;
  }
});
