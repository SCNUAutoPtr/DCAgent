import assert from 'node:assert/strict';
import test from 'node:test';
import deviceService from '../services/deviceService';
import { hasFieldError, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('POST /api/v1/devices/bulk-create returns service payload', async () => {
  const original = deviceService.bulkCreateDevices;
  deviceService.bulkCreateDevices = async () => ({
    success: [{ id: 'dev-1' }],
    failed: [],
  }) as any;

  try {
    const { response, json } = await postJson('/api/v1/devices/bulk-create', {
      devices: [{
        name: 'SW-01',
        type: 'SWITCH',
        cabinetId: '11111111-1111-4111-8111-111111111111',
      }],
    });
    assert.equal(response.status, 201);
    assert.equal(json.success, true);
    assert.equal(json.data.success.length, 1);
  } finally {
    deviceService.bulkCreateDevices = original;
  }
});

test('POST /api/v1/devices/bulk-create rejects invalid nested cabinetId', async () => {
  const { response, json } = await postJson('/api/v1/devices/bulk-create', {
    devices: [{
      name: 'SW-01',
      type: 'SWITCH',
      cabinetId: 'bad-id',
    }],
  });
  assert.equal(response.status, 400);
  assert.equal(json.error, 'Validation error');
  assert.equal(hasFieldError(json.details, 'cabinetId'), true);
});
