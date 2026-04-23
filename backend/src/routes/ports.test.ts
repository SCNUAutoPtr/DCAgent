import assert from 'node:assert/strict';
import test from 'node:test';
import portService from '../services/portService';
import { getJson, hasFieldError, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('GET /api/v1/ports returns panel-filtered ports', async () => {
  const original = portService.getPortsByPanel;
  portService.getPortsByPanel = async (panelId: string) => [{ id: 'port-1', panelId }] as any;

  try {
    const { response, json } = await getJson('/api/v1/ports?panelId=11111111-1111-4111-8111-111111111111');
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'port-1', panelId: '11111111-1111-4111-8111-111111111111' }]);
  } finally {
    portService.getPortsByPanel = original;
  }
});

test('POST /api/v1/ports/get returns 404 when port is missing', async () => {
  const original = portService.getPortById;
  portService.getPortById = async () => null as any;

  try {
    const { response, json } = await postJson('/api/v1/ports/get', {
      id: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(response.status, 404);
    assert.equal(json.error, 'Port not found');
  } finally {
    portService.getPortById = original;
  }
});

test('POST /api/v1/ports/create-bulk rejects invalid panelId', async () => {
  const { response, json } = await postJson('/api/v1/ports/create-bulk', {
    panelId: 'bad-id',
    count: 4,
  });

  assert.equal(response.status, 400);
  assert.equal(json.error, 'Validation error');
  assert.equal(hasFieldError(json.details, 'panelId'), true);
});

test('POST /api/v1/ports/available returns available ports', async () => {
  const original = portService.getAvailablePortsByPanel;
  portService.getAvailablePortsByPanel = async (panelId: string) => [{ id: 'port-2', panelId, status: 'AVAILABLE' }] as any;

  try {
    const { response, json } = await postJson('/api/v1/ports/available', {
      panelId: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'port-2', panelId: '11111111-1111-4111-8111-111111111111', status: 'AVAILABLE' }]);
  } finally {
    portService.getAvailablePortsByPanel = original;
  }
});
