import { test, expect } from '@playwright/test';
import { preparePage } from './helpers/setup';
import { apiGetDeviceByName, apiGetPanelByName } from './helpers/api';

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

test('creates, edits, and deletes a panel from list page', async ({ page, request }) => {
  const device = await apiGetDeviceByName(request, 'WEB-Server-01');
  expect(device, '需要 seed 中存在设备 WEB-Server-01').not.toBeNull();
  const shortId = 900000 + Number(String(Date.now()).slice(-5));

  await page.goto('http://localhost:5173/panels');
  await expect(page.getByRole('heading', { name: '面板管理' })).toBeVisible();

  await page.locator('[data-testid="panel-create-btn"]').click();
  await expect(page.locator('[data-testid="panel-modal"]')).toBeVisible();

  const shortIdInput = page.locator('[data-testid="panel-shortid-input"]');
  await shortIdInput.fill(String(shortId));
  await shortIdInput.blur();

  await page.locator('[data-testid="panel-name-input"]').fill('E2E-Panel-CRUD');

  await page.locator('[data-testid="panel-type-select"]').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: '网络面板' }).first().click();

  await page.locator('[data-testid="panel-device-select"]').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: `${device!.name} (${device!.type})` }).click();

  await page.locator('[data-testid="panel-save-btn"]').click();

  await expect(page.locator('.ant-message-notice').filter({ hasText: '面板创建成功' }).last()).toBeVisible();
  const newRow = page.locator('tr', { hasText: 'E2E-Panel-CRUD' });
  await expect(newRow).toBeVisible();

  await newRow.locator('[data-testid="panel-edit-btn"]').click();
  await expect(page.locator('[data-testid="panel-modal"]')).toBeVisible();

  const nameInput = page.locator('[data-testid="panel-name-input"]');
  await nameInput.fill('E2E-Panel-CRUD-Renamed');
  await page.locator('[data-testid="panel-save-btn"]').click();

  await expect(page.locator('.ant-message-notice').filter({ hasText: '面板更新成功' }).last()).toBeVisible();
  const renamedRow = page.locator('tr', { hasText: 'E2E-Panel-CRUD-Renamed' });
  await expect(renamedRow).toBeVisible();

  await renamedRow.locator('[data-testid="panel-delete-btn"]').click();
  await page.locator('[data-testid="panel-delete-confirm-btn"]').click();

  await expect(page.locator('tr', { hasText: 'E2E-Panel-CRUD-Renamed' })).toHaveCount(0);

  const residual = await apiGetPanelByName(request, 'E2E-Panel-CRUD-Renamed');
  expect(residual).toBeNull();
});
