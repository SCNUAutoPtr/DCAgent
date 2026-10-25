import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { fixture, prisma, rpc, startServer, stopServer, truncateAll } from './helpers';
import type { DashboardOverview } from '../src/contracts/dashboard';

before(startServer);
after(async () => {
  await stopServer();
  await prisma.$disconnect();
});
beforeEach(truncateAll);

test('dashboard/overview counts devices by type and optical modules by status', async () => {
  const f = await fixture({ ports: 2 });
  await prisma.opticalModule.createMany({
    data: [
      { serialNo: 'NIGHT-SMOKE-OM-1', model: 'm', vendor: 'v', moduleType: 'SFP_PLUS', status: 'IN_STOCK' },
      { serialNo: 'NIGHT-SMOKE-OM-2', model: 'm', vendor: 'v', moduleType: 'SFP_PLUS', status: 'INSTALLED', currentPortId: f.ports[0].id },
      { serialNo: 'NIGHT-SMOKE-OM-3', model: 'm', vendor: 'v', moduleType: 'QSFP28', status: 'SCRAPPED' },
    ],
  });
  const { status, json } = await rpc<DashboardOverview>('dashboard/overview', {});
  assert.equal(status, 200);
  assert.equal(json.devicesByType.SWITCH, 1);
  assert.equal(json.devicesByType.SERVER, 0);
  assert.deepEqual(json.opticalModules, { IN_STOCK: 1, INSTALLED: 1, RESERVED: 0, FAULTY: 0, SCRAPPED: 1 });
  assert.equal(json.counts.opticalModules, 3);
});
