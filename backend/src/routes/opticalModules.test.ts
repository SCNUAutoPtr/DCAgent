import assert from 'node:assert/strict';
import test from 'node:test';
import opticalModuleService from '../services/opticalModuleService';
import { deleteRequest, getJson, hasFieldError, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('GET /api/v1/optical-modules returns queried modules', async () => {
  const original = opticalModuleService.listModules;
  opticalModuleService.listModules = async () => [{ id: 'mod-1', serialNo: 'SFP-001' }] as any;

  try {
    const { response, json } = await getJson('/api/v1/optical-modules?vendor=Cisco');
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'mod-1', serialNo: 'SFP-001' }]);
  } finally {
    opticalModuleService.listModules = original;
  }
});

test('POST /api/v1/optical-modules rejects invalid moduleType', async () => {
  const { response, json } = await postJson('/api/v1/optical-modules', {
    serialNo: 'SFP-001',
    model: 'X',
    vendor: 'Cisco',
    moduleType: 'BAD_TYPE',
  });
  assert.equal(response.status, 400);
  assert.equal(json.error, 'Validation error');
  assert.equal(hasFieldError(json.details, 'moduleType'), true);
});

test('GET /api/v1/optical-modules/statistics returns statistics', async () => {
  const original = opticalModuleService.getStatistics;
  opticalModuleService.getStatistics = async () => ({ total: 5, installed: 2 }) as any;

  try {
    const { response, json } = await getJson('/api/v1/optical-modules/statistics');
    assert.equal(response.status, 200);
    assert.equal(json.total, 5);
  } finally {
    opticalModuleService.getStatistics = original;
  }
});

test('DELETE /api/v1/optical-modules/:id returns delete success payload', async () => {
  const original = opticalModuleService.deleteModule;
  opticalModuleService.deleteModule = async () => undefined as any;

  try {
    const { response, json } = await deleteRequest('/api/v1/optical-modules/11111111-1111-4111-8111-111111111111');
    assert.equal(response.status, 200);
    assert.equal(json.message, 'Optical module deleted successfully');
  } finally {
    opticalModuleService.deleteModule = original;
  }
});
