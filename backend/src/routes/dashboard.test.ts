import assert from 'node:assert/strict';
import test from 'node:test';
import dashboardService from '../services/dashboardService';
import { getJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('GET /api/v1/dashboard/overview returns aggregated counts', async () => {
  const original = dashboardService.getOverview;
  dashboardService.getOverview = async () =>
    ({
      counts: { dataCenters: 1, rooms: 2, cabinets: 3, devices: 4, panels: 5, ports: 48, cables: 6 },
      ports: {
        total: 48,
        occupied: 12,
        available: 36,
        reserved: 0,
        faulty: 0,
        occupancyRate: 25,
      },
      cables: { total: 6, notInventoried: 1, inventoried: 2, inUse: 3 },
      recentDevices: [],
    }) as any;

  try {
    const { response, json } = await getJson('/api/v1/dashboard/overview');
    assert.equal(response.status, 200);
    assert.equal(json.counts.devices, 4);
    assert.equal(json.ports.occupancyRate, 25);
    assert.equal(json.cables.inUse, 3);
  } finally {
    dashboardService.getOverview = original;
  }
});

test('GET /api/v1/dashboard/overview maps service failure to 500', async () => {
  const original = dashboardService.getOverview;
  dashboardService.getOverview = async () => {
    throw new Error('boom');
  };

  try {
    const { response, json } = await getJson('/api/v1/dashboard/overview');
    assert.equal(response.status, 500);
    assert.ok(json.error);
  } finally {
    dashboardService.getOverview = original;
  }
});
