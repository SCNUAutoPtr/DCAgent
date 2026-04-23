import assert from 'node:assert/strict';
import test from 'node:test';
import deviceService from '../services/deviceService';
import { getJson, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('GET /api/v1/devices returns cabinet-filtered devices', async () => {
  const original = deviceService.getDevicesByCabinet;
  deviceService.getDevicesByCabinet = async (cabinetId: string) => [{ id: 'dev-1', cabinetId }] as any;

  try {
    const { response, json } = await getJson('/api/v1/devices?cabinetId=11111111-1111-4111-8111-111111111111');
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'dev-1', cabinetId: '11111111-1111-4111-8111-111111111111' }]);
  } finally {
    deviceService.getDevicesByCabinet = original;
  }
});

test('POST /api/v1/devices/by-shortid returns 404 when device is missing', async () => {
  const original = deviceService.getDeviceByShortId;
  deviceService.getDeviceByShortId = async () => null as any;

  try {
    const { response, json } = await postJson('/api/v1/devices/by-shortid', { shortId: 10004 });
    assert.equal(response.status, 404);
    assert.equal(json.error, 'Device not found');
  } finally {
    deviceService.getDeviceByShortId = original;
  }
});

test('POST /api/v1/devices/delete returns delete success payload', async () => {
  const original = deviceService.deleteDevice;
  deviceService.deleteDevice = async () => ({ id: 'dev-1' } as any);

  try {
    const { response, json } = await postJson('/api/v1/devices/delete', {
      id: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(response.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.message, 'Device deleted successfully');
  } finally {
    deviceService.deleteDevice = original;
  }
});
