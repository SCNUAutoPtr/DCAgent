import assert from 'node:assert/strict';
import test from 'node:test';
import roomService from '../services/roomService';
import { getJson, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('GET /api/v1/rooms returns dataCenter-filtered rooms', async () => {
  const original = roomService.getRoomsByDataCenter;
  roomService.getRoomsByDataCenter = async (dataCenterId: string) => [{ id: 'room-1', dataCenterId }] as any;

  try {
    const { response, json } = await getJson('/api/v1/rooms?dataCenterId=11111111-1111-4111-8111-111111111111');
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'room-1', dataCenterId: '11111111-1111-4111-8111-111111111111' }]);
  } finally {
    roomService.getRoomsByDataCenter = original;
  }
});

test('POST /api/v1/rooms/by-shortid returns 404 when room is missing', async () => {
  const original = roomService.getRoomByShortId;
  roomService.getRoomByShortId = async () => null as any;

  try {
    const { response, json } = await postJson('/api/v1/rooms/by-shortid', { shortId: 10001 });
    assert.equal(response.status, 404);
    assert.equal(json.error, 'Room not found');
  } finally {
    roomService.getRoomByShortId = original;
  }
});

test('POST /api/v1/rooms/floor-plan returns room floor plan payload', async () => {
  const original = roomService.getFloorPlanData;
  roomService.getFloorPlanData = async (id: string) => ({ id, width: 1200, height: 800 }) as any;

  try {
    const { response, json } = await postJson('/api/v1/rooms/floor-plan', {
      id: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(response.status, 200);
    assert.equal(json.width, 1200);
  } finally {
    roomService.getFloorPlanData = original;
  }
});
