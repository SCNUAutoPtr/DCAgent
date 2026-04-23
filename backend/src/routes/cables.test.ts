import assert from 'node:assert/strict';
import test from 'node:test';
import cableService from '../services/cableService';
import { getJson, hasFieldError, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('GET /api/v1/cables returns searched cables', async () => {
  const original = cableService.searchCables;
  cableService.searchCables = async (search: string) => [{ id: 'cable-1', label: search }] as any;

  try {
    const { response, json } = await getJson('/api/v1/cables?search=core');
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'cable-1', label: 'core' }]);
  } finally {
    cableService.searchCables = original;
  }
});

test('POST /api/v1/cables/connect-single-port accepts panel-only endpoint target', async () => {
  const original = cableService.connectSinglePort;
  const panelId = '11111111-1111-4111-8111-111111111111';
  cableService.connectSinglePort = async (data: any) => {
    assert.equal(data.panelId, panelId);
    assert.equal(data.portId, undefined);
    assert.equal(data.shortId, 12345);
    return {
      connectedEndpoint: {
        panelId,
        portId: null,
        shortId: 12345,
      },
    } as any;
  };

  try {
    const { response, json } = await postJson('/api/v1/cables/connect-single-port', {
      panelId,
      shortId: 12345,
    });
    assert.equal(response.status, 201);
    assert.equal(json.connectedEndpoint.panelId, panelId);
    assert.equal(json.connectedEndpoint.portId, null);
  } finally {
    cableService.connectSinglePort = original;
  }
});

test('POST /api/v1/cables/connect-single-port rejects missing endpoint target', async () => {
  const { response, json } = await postJson('/api/v1/cables/connect-single-port', {
    shortId: 12345,
  });
  assert.equal(response.status, 400);
  assert.equal(json.error, 'Validation error');
  assert.equal(hasFieldError(json.details, 'panelId'), true);
});

test('POST /api/v1/cables/connect-single-port rejects invalid portId', async () => {
  const { response, json } = await postJson('/api/v1/cables/connect-single-port', {
    portId: 'bad-id',
    shortId: 12345,
  });
  assert.equal(response.status, 400);
  assert.equal(json.error, 'Validation error');
  assert.equal(hasFieldError(json.details, 'portId'), true);
});

test('POST /api/v1/cables/dangling-by-device returns service result', async () => {
  const original = cableService.getDanglingEndpointsByDevice;
  const deviceId = '22222222-2222-4222-8222-222222222222';
  cableService.getDanglingEndpointsByDevice = async (id: string) => {
    assert.equal(id, deviceId);
    return {
      total: 1,
      panels: {
        '11111111-1111-4111-8111-111111111111': [
          { id: 'endpoint-1', shortId: 12345, panelId: '11111111-1111-4111-8111-111111111111', portId: null },
        ],
      },
    } as any;
  };

  try {
    const { response, json } = await postJson('/api/v1/cables/dangling-by-device', { deviceId });
    assert.equal(response.status, 200);
    assert.equal(json.total, 1);
    assert.equal(json.panels['11111111-1111-4111-8111-111111111111'][0].shortId, 12345);
  } finally {
    cableService.getDanglingEndpointsByDevice = original;
  }
});

test('POST /api/v1/cables/disconnect-endpoint returns service result', async () => {
  const original = cableService.disconnectEndpoint;
  cableService.disconnectEndpoint = async (shortId: number) => ({ success: true, shortId }) as any;

  try {
    const { response, json } = await postJson('/api/v1/cables/disconnect-endpoint', { shortId: 12345 });
    assert.equal(response.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.shortId, 12345);
  } finally {
    cableService.disconnectEndpoint = original;
  }
});

test('POST /api/v1/cables/endpoints-by-shortid returns 404 when cable is missing', async () => {
  const original = cableService.getCableEndpointsByShortId;
  cableService.getCableEndpointsByShortId = async () => null as any;

  try {
    const { response, json } = await postJson('/api/v1/cables/endpoints-by-shortid', { shortId: 12345 });
    assert.equal(response.status, 404);
    assert.equal(json.error, 'Cable not found');
  } finally {
    cableService.getCableEndpointsByShortId = original;
  }
});
