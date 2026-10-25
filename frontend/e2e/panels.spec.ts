import { expect, test } from './helpers/test';
import { createHierarchy, rpc, uniq } from './helpers/api';
import type { PanelDto } from '@contracts/panels';

test('creates, renames and deletes a panel from the list page', async ({ page, request }) => {
  const h = await createHierarchy(request);
  const name = uniq('panel');

  await page.goto('/panels');
  await expect(page.getByRole('heading', { name: '面板管理' })).toBeVisible();
  await page.getByTestId('panel-create-btn').click();
  await expect(page.getByTestId('panel-modal')).toBeVisible();

  await page.getByTestId('panel-name-input').fill(name);
  await page.getByTestId('panel-type-select').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: '网络面板' }).first().click();
  await page.getByTestId('panel-device-select').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: `${h.device.name} (SWITCH)` }).click();
  await page.getByTestId('panel-save-btn').click();

  await expect(page.locator('.ant-message-notice', { hasText: '面板创建成功' })).toBeVisible();
  const row = page.locator('tr', { hasText: name });
  await expect(row).toBeVisible();
  // the label was allocated automatically: every panel carries one
  await expect(row).toContainText('E-');

  await row.getByTestId('panel-edit-btn').click();
  await page.getByTestId('panel-name-input').fill(`${name}-renamed`);
  await page.getByTestId('panel-save-btn').click();
  await expect(page.locator('.ant-message-notice', { hasText: '面板更新成功' })).toBeVisible();

  const renamed = page.locator('tr', { hasText: `${name}-renamed` });
  await renamed.getByTestId('panel-delete-btn').click();
  await expect(page.locator('.ant-message-notice', { hasText: '面板删除成功' })).toBeVisible();
  await expect(page.locator('tr', { hasText: `${name}-renamed` })).toHaveCount(0);

  const left = await rpc<PanelDto[]>(request, 'panels/list', { deviceId: h.device.id });
  expect(left.map((p) => p.name)).not.toContain(`${name}-renamed`);
});

test('shows the ports of a device and opens the panel editor from the rack view', async ({ page, request }) => {
  const h = await createHierarchy(request, { ports: 4 });

  await page.goto(`/cabinets/${h.cabinet.id}`);
  await page.getByTestId(`rack-device-${h.device.id}`).click();
  const view = page.getByTestId('panel-view');
  await expect(view).toBeVisible();
  for (const n of ['1', '2', '3', '4']) await expect(view.getByTestId(`panel-port-${n}`)).toHaveCount(1);
  await page.locator('.ant-modal', { has: view }).locator('.ant-modal-close').click();
  await expect(view).toBeHidden();

  await page.getByTestId('cabinet-device-panel-btn').click();
  await expect(page.getByTestId('device-panel-editor-modal')).toBeVisible();
});
