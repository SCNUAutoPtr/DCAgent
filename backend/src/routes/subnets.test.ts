import assert from 'node:assert/strict';
import test from 'node:test';
import subnetService from '../services/subnetService';
import { getJson, hasFieldError, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('POST /api/v1/subnets/calculate returns subnet calculation', async () => {
  const original = subnetService.calculateSubnet;
  subnetService.calculateSubnet = () => ({ network: '10.0.0.0', cidr: 24, usableHosts: 254 }) as any;

  try {
    const { response, json } = await postJson('/api/v1/subnets/calculate', { network: '10.0.0.0', cidr: 24 });
    assert.equal(response.status, 200);
    assert.equal(json.usableHosts, 254);
  } finally {
    subnetService.calculateSubnet = original;
  }
});

test('POST /api/v1/subnets/create rejects invalid roomId', async () => {
  const { response, json } = await postJson('/api/v1/subnets/create', {
    name: '办公网',
    network: '10.0.0.0',
    cidr: 24,
    roomId: 'bad-id',
  });
  assert.equal(response.status, 400);
  assert.equal(json.error, '验证错误');
  assert.equal(hasFieldError(json.details, 'roomId'), true);
});

test('GET /api/v1/subnets/statistics returns statistics', async () => {
  const original = subnetService.getStatistics;
  subnetService.getStatistics = async () => ({ totalSubnets: 2, totalAddresses: 512 }) as any;

  try {
    const { response, json } = await getJson('/api/v1/subnets/statistics');
    assert.equal(response.status, 200);
    assert.equal(json.totalSubnets, 2);
  } finally {
    subnetService.getStatistics = original;
  }
});
