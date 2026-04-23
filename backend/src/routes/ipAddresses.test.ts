import assert from 'node:assert/strict';
import test from 'node:test';
import ipAddressService from '../services/ipAddressService';
import { getJson, hasFieldError, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('POST /api/v1/ip-addresses/next-available returns 404 when subnet is exhausted', async () => {
  const original = ipAddressService.getNextAvailableIp;
  ipAddressService.getNextAvailableIp = async () => null as any;

  try {
    const { response, json } = await postJson('/api/v1/ip-addresses/next-available', {
      subnetId: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(response.status, 404);
    assert.equal(json.error, '子网中没有可用的IP地址');
  } finally {
    ipAddressService.getNextAvailableIp = original;
  }
});

test('POST /api/v1/ip-addresses/allocate rejects invalid mac address', async () => {
  const { response, json } = await postJson('/api/v1/ip-addresses/allocate', {
    ipAddressId: '11111111-1111-4111-8111-111111111111',
    macAddress: 'not-a-mac',
  });
  assert.equal(response.status, 400);
  assert.equal(json.error, '验证错误');
  assert.equal(hasFieldError(json.details, 'macAddress'), true);
});

test('GET /api/v1/ip-addresses returns filtered addresses', async () => {
  const original = ipAddressService.listIpAddresses;
  ipAddressService.listIpAddresses = async () => [{ id: 'ip-1', address: '10.0.0.10' }] as any;

  try {
    const { response, json } = await getJson('/api/v1/ip-addresses?search=10.0.0.10');
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'ip-1', address: '10.0.0.10' }]);
  } finally {
    ipAddressService.listIpAddresses = original;
  }
});
