import assert from 'node:assert/strict';
import test from 'node:test';
import cabinetService from '../services/cabinetService';
import { getJson, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('GET /api/v1/cabinets returns room-filtered cabinets', async () => {
  const original = cabinetService.getCabinetsByRoom;
  cabinetService.getCabinetsByRoom = async (roomId: string) => [{ id: 'cab-1', roomId }] as any;

  try {
    const { response, json } = await getJson('/api/v1/cabinets?roomId=11111111-1111-4111-8111-111111111111');
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'cab-1', roomId: '11111111-1111-4111-8111-111111111111' }]);
  } finally {
    cabinetService.getCabinetsByRoom = original;
  }
});

test('POST /api/v1/cabinets/by-shortid returns 404 when cabinet is missing', async () => {
  const original = cabinetService.getCabinetByShortId;
  cabinetService.getCabinetByShortId = async () => null as any;

  try {
    const { response, json } = await postJson('/api/v1/cabinets/by-shortid', { shortId: 10002 });
    assert.equal(response.status, 404);
    assert.equal(json.error, 'Cabinet not found');
  } finally {
    cabinetService.getCabinetByShortId = original;
  }
});

test('POST /api/v1/cabinets/delete returns delete success payload', async () => {
  const original = cabinetService.deleteCabinet;
  cabinetService.deleteCabinet = async () => ({ id: 'cab-1' } as any);

  try {
    const { response, json } = await postJson('/api/v1/cabinets/delete', {
      id: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(response.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.message, 'Cabinet deleted successfully');
  } finally {
    cabinetService.deleteCabinet = original;
  }
});
