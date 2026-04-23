import assert from 'node:assert/strict';
import test from 'node:test';
import panelService from '../services/panelService';
import { getJson, postJson, useHttpTestServer } from '../test/httpTestHelper';

useHttpTestServer();

test('GET /api/v1/panels returns type-filtered panels', async () => {
  const original = panelService.getPanelsByType;
  panelService.getPanelsByType = async (type: string) => [{ id: 'panel-1', type }] as any;

  try {
    const { response, json } = await getJson('/api/v1/panels?type=NETWORK');
    assert.equal(response.status, 200);
    assert.deepEqual(json, [{ id: 'panel-1', type: 'NETWORK' }]);
  } finally {
    panelService.getPanelsByType = original;
  }
});

test('POST /api/v1/panels/by-shortid returns 404 when panel is missing', async () => {
  const original = panelService.getPanelByShortId;
  panelService.getPanelByShortId = async () => null as any;

  try {
    const { response, json } = await postJson('/api/v1/panels/by-shortid', { shortId: 10003 });
    assert.equal(response.status, 404);
    assert.equal(json.error, 'Panel not found');
  } finally {
    panelService.getPanelByShortId = original;
  }
});

test('POST /api/v1/panels/delete returns delete success payload', async () => {
  const original = panelService.deletePanel;
  panelService.deletePanel = async () => ({ id: 'panel-1' } as any);

  try {
    const { response, json } = await postJson('/api/v1/panels/delete', {
      id: '11111111-1111-4111-8111-111111111111',
    });
    assert.equal(response.status, 200);
    assert.equal(json.success, true);
    assert.equal(json.message, 'Panel deleted successfully');
  } finally {
    panelService.deletePanel = original;
  }
});
