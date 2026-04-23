import assert from 'node:assert/strict';
import test from 'node:test';
import { panelTemplateService } from '../services/panelTemplateService';
import { deleteRequest, getJson, postJson, putJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('GET /api/v1/panel-templates returns template list', async () => {
  const original = panelTemplateService.getAllTemplates;
  panelTemplateService.getAllTemplates = async () => [{ id: 'tpl-1', name: '24口模板' }] as any;

  try {
    const { response, json } = await getJson('/api/v1/panel-templates');
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'tpl-1', name: '24口模板' }]);
  } finally {
    panelTemplateService.getAllTemplates = original;
  }
});

test('GET /api/v1/panel-templates/:id returns 404 when template is missing', async () => {
  const original = panelTemplateService.getTemplateById;
  panelTemplateService.getTemplateById = async () => null as any;

  try {
    const { response, json } = await getJson('/api/v1/panel-templates/11111111-1111-4111-8111-111111111111');
    assert.equal(response.status, 404);
    assert.equal(json.error, '模板不存在');
  } finally {
    panelTemplateService.getTemplateById = original;
  }
});

test('POST /api/v1/panel-templates/:id/create-panel requires deviceId', async () => {
  const { response, json } = await postJson('/api/v1/panel-templates/11111111-1111-4111-8111-111111111111/create-panel', {});
  assert.equal(response.status, 400);
  assert.equal(json.error, '缺少 deviceId 参数');
});

test('DELETE /api/v1/panel-templates/:id returns 204 on success', async () => {
  const original = panelTemplateService.deleteTemplate;
  panelTemplateService.deleteTemplate = async () => undefined as any;

  try {
    const { response } = await deleteRequest('/api/v1/panel-templates/11111111-1111-4111-8111-111111111111');
    assert.equal(response.status, 204);
  } finally {
    panelTemplateService.deleteTemplate = original;
  }
});

test('PUT /api/v1/panel-templates/:id forwards update payload', async () => {
  const original = panelTemplateService.updateTemplate;
  panelTemplateService.updateTemplate = async (id: string, body: unknown) => ({ id, ...(body as object) }) as any;

  try {
    const { response, json } = await putJson('/api/v1/panel-templates/11111111-1111-4111-8111-111111111111', {
      name: '更新后的模板',
    });
    assert.equal(response.status, 200);
    assert.equal(json.id, '11111111-1111-4111-8111-111111111111');
    assert.equal(json.name, '更新后的模板');
  } finally {
    panelTemplateService.updateTemplate = original;
  }
});
