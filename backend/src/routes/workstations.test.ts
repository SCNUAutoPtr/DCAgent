import assert from 'node:assert/strict';
import test from 'node:test';
import workstationService from '../services/workstationService';
import { getJson, hasFieldError, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('GET /api/v1/workstations returns room-filtered workstations', async () => {
  const original = workstationService.getWorkstationsByRoom;
  workstationService.getWorkstationsByRoom = async (roomId: string) => [{ id: 'ws-1', roomId }] as any;

  try {
    const { response, json } = await getJson('/api/v1/workstations?roomId=11111111-1111-4111-8111-111111111111');
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'ws-1', roomId: '11111111-1111-4111-8111-111111111111' }]);
  } finally {
    workstationService.getWorkstationsByRoom = original;
  }
});

test('POST /api/v1/workstations/by-code returns 404 when workstation is missing', async () => {
  const original = workstationService.getWorkstationByCode;
  workstationService.getWorkstationByCode = async () => null as any;

  try {
    const { response, json } = await postJson('/api/v1/workstations/by-code', { code: 'WS-001' });
    assert.equal(response.status, 404);
    assert.equal(json.error, 'Workstation not found');
  } finally {
    workstationService.getWorkstationByCode = original;
  }
});

test('POST /api/v1/workstations/create rejects invalid roomId', async () => {
  const { response, json } = await postJson('/api/v1/workstations/create', {
    name: '设计工位',
    roomId: 'bad-id',
  });
  assert.equal(response.status, 400);
  assert.equal(json.error, 'Validation error');
  assert.equal(hasFieldError(json.details, 'roomId'), true);
});
