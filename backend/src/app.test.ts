process.env.NODE_ENV = 'test';

import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { createApp } from './app';
import deviceService from './services/deviceService';

let baseUrl = '';
let server: ReturnType<ReturnType<typeof createApp>['listen']>;

async function startServer() {
  server = createApp().listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  const address = server.address() as AddressInfo | null;
  if (!address) {
    throw new Error('Test server did not expose an address');
  }

  baseUrl = `http://127.0.0.1:${address.port}`;
}

async function stopServer() {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function postJson(path: string, body: unknown) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  return {
    response,
    json: await response.json(),
  };
}

function hasFieldError(details: unknown, field: string) {
  return Array.isArray(details) && details.some((detail) => {
    if (!detail || typeof detail !== 'object' || !('path' in detail)) {
      return false;
    }

    const path = (detail as { path?: unknown }).path;
    return Array.isArray(path) && path.includes(field);
  });
}

function makeUniqueConstraintError(field: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: '5.0.0',
    meta: { target: [field] },
  });
}

test.before(startServer);
test.after(stopServer);

test('GET /health returns the backend heartbeat', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.status, 'ok');
  assert.equal(json.service, 'DCAgent Backend');
  assert.equal(typeof json.timestamp, 'string');
});

test('GET /api/v1 lists the mounted API groups', async () => {
  const response = await fetch(`${baseUrl}/api/v1`);
  const json = await response.json();

  assert.equal(response.status, 200);
  assert.equal(json.message, 'DCAgent API v1');
  assert.equal(json.endpoints.rooms, '/api/v1/rooms');
  assert.equal(json.endpoints.cabinets, '/api/v1/cabinets');
  assert.equal(json.endpoints.devices, '/api/v1/devices');
  assert.equal(json.endpoints.panels, '/api/v1/panels');
});

const validationCases = [
  {
    name: 'POST /api/v1/rooms/create rejects an invalid dataCenterId before service execution',
    path: '/api/v1/rooms/create',
    body: {
      name: 'Room A',
      shortId: 101,
      dataCenterId: 'not-a-uuid',
    },
    field: 'dataCenterId',
  },
  {
    name: 'POST /api/v1/cabinets/create rejects a missing shortId before service execution',
    path: '/api/v1/cabinets/create',
    body: {
      name: 'Cabinet A01',
      height: 42,
      roomId: '11111111-1111-4111-8111-111111111111',
    },
    field: 'shortId',
  },
  {
    name: 'POST /api/v1/devices/create rejects an invalid cabinetId before service execution',
    path: '/api/v1/devices/create',
    body: {
      name: 'Switch 1',
      type: 'SWITCH',
      cabinetId: 'bad-id',
    },
    field: 'cabinetId',
  },
  {
    name: 'POST /api/v1/panels/create rejects an invalid deviceId before service execution',
    path: '/api/v1/panels/create',
    body: {
      name: 'Patch Panel 1',
      type: 'NETWORK',
      shortId: 301,
      deviceId: 'bad-id',
    },
    field: 'deviceId',
  },
] as const;

for (const validationCase of validationCases) {
  test(validationCase.name, async () => {
    const { response, json } = await postJson(validationCase.path, validationCase.body);

    assert.equal(response.status, 400);
    assert.equal(json.error, 'Validation error');
    assert.equal(hasFieldError(json.details, validationCase.field), true);
  });
}

test('POST /api/v1/devices/create returns serialNo conflict details', async () => {
  const originalCreateDevice = deviceService.createDevice;
  deviceService.createDevice = async () => {
    throw makeUniqueConstraintError('serialNo');
  };

  try {
    const { response, json } = await postJson('/api/v1/devices/create', {
      name: 'Switch 1',
      type: 'SWITCH',
      serialNo: 'SN-001',
      cabinetId: '11111111-1111-4111-8111-111111111111',
    });

    assert.equal(response.status, 409);
    assert.equal(json.code, 'UNIQUE_CONSTRAINT');
    assert.deepEqual(json.conflictFields, ['serialNo']);
    assert.equal(json.error, 'serialNo already exists');
  } finally {
    deviceService.createDevice = originalCreateDevice;
  }
});

test('POST /api/v1/devices/update returns serialNo conflict details', async () => {
  const originalUpdateDevice = deviceService.updateDevice;
  deviceService.updateDevice = async () => {
    throw makeUniqueConstraintError('serialNo');
  };

  try {
    const { response, json } = await postJson('/api/v1/devices/update', {
      id: '22222222-2222-4222-8222-222222222222',
      serialNo: 'SN-001',
    });

    assert.equal(response.status, 409);
    assert.equal(json.code, 'UNIQUE_CONSTRAINT');
    assert.deepEqual(json.conflictFields, ['serialNo']);
    assert.equal(json.error, 'serialNo already exists');
  } finally {
    deviceService.updateDevice = originalUpdateDevice;
  }
});
