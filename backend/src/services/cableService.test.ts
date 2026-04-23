import assert from 'node:assert/strict';
import test from 'node:test';
import cableService from './cableService';
import prisma from '../utils/prisma';
import cableGraphService from '../graph/cableGraph';
import { shortIdPoolService } from './shortIdPoolService';

function createPrismaMethodStub(target: any, key: string, implementation: any) {
  const original = target[key];
  target[key] = implementation;
  return () => {
    target[key] = original;
  };
}

test('connectSinglePort creates panel-anchored dangling endpoint when portId is omitted', async () => {
  const panelId = '11111111-1111-4111-8111-111111111111';
  const cableId = 'cable-1';
  const endpointId = 'endpoint-1';

  const restores = [
    createPrismaMethodStub(prisma.panel, 'findUnique', async () => ({
      id: panelId,
      name: 'Panel A',
      device: {
        id: 'device-1',
        name: 'Device A',
        cabinet: { id: 'cab-1', name: 'Cab 1', room: { id: 'room-1', name: 'Room 1', dataCenter: { id: 'dc-1', name: 'DC 1' } } },
      },
    }) as any),
    createPrismaMethodStub(prisma.cableEndpoint, 'findUnique', async () => null as any),
    createPrismaMethodStub(prisma.cable, 'create', async ({ data }: any) => ({ id: cableId, ...data }) as any),
    createPrismaMethodStub(prisma.cableEndpoint, 'create', async ({ data }: any) => ({ id: endpointId, ...data, panel: { id: panelId, name: 'Panel A' }, port: null }) as any),
    createPrismaMethodStub(prisma.cable, 'findUnique', async () => ({ id: cableId, endpoints: [{ id: endpointId, panelId, portId: null, shortId: 12345 }] }) as any),
  ];

  const originalAllocate = shortIdPoolService.allocateShortId;
  const originalBind = shortIdPoolService.bindShortIdToEntity;
  shortIdPoolService.allocateShortId = async () => undefined as any;
  shortIdPoolService.bindShortIdToEntity = async () => undefined as any;

  try {
    const result = await cableService.connectSinglePort({ panelId, shortId: 12345, type: 'OTHER' as any });
    assert.equal(result.connectedEndpoint.panelId, panelId);
    assert.equal(result.connectedEndpoint.portId, null);
  } finally {
    restores.reverse().forEach((restore) => restore());
    shortIdPoolService.allocateShortId = originalAllocate;
    shortIdPoolService.bindShortIdToEntity = originalBind;
  }
});

test('disconnectEndpoint keeps panelId while clearing portId', async () => {
  const cableId = 'cable-1';
  const endpointId = 'endpoint-1';
  const portId = 'port-1';
  const panelId = 'panel-1';

  const deleteCalls: string[] = [];

  const restores = [
    createPrismaMethodStub(prisma.cableEndpoint, 'findUnique', async ({ where }: any) => {
      if (where.shortId) {
        return {
          id: endpointId,
          shortId: 12345,
          cableId,
          panelId,
          portId,
          cable: { id: cableId, endpoints: [{ id: endpointId, portId }, { id: 'endpoint-2', portId: null }] },
          port: { id: portId, panelId, opticalModule: null, panel: { id: panelId } },
          panel: { id: panelId },
        } as any;
      }

      return { id: endpointId, panelId, portId: null, cable: { id: cableId } } as any;
    }),
    createPrismaMethodStub(prisma.cableEndpoint, 'update', async ({ data }: any) => ({ id: endpointId, ...data }) as any),
    createPrismaMethodStub(prisma.port, 'findUnique', async () => ({ id: portId, opticalModule: null }) as any),
    createPrismaMethodStub(prisma.port, 'update', async ({ data }: any) => ({ id: portId, ...data }) as any),
    createPrismaMethodStub(prisma.cable, 'update', async ({ data }: any) => ({ id: cableId, ...data }) as any),
  ];

  const originalDeleteConnection = cableGraphService.deleteConnection;
  cableGraphService.deleteConnection = async (id: string) => {
    deleteCalls.push(id);
  };

  try {
    const result = await cableService.disconnectEndpoint(12345);
    assert.equal(result.endpoint?.panelId, panelId);
    assert.equal(deleteCalls[0], cableId);
  } finally {
    restores.reverse().forEach((restore) => restore());
    cableGraphService.deleteConnection = originalDeleteConnection;
  }
});
