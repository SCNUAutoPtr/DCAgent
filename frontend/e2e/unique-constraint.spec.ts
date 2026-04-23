import { test, expect } from '@playwright/test';
import { preparePage } from './helpers/setup';

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

test('shows serialNo conflict error when creating a device', async ({ page }) => {
  await page.goto('/devices');

  await expect(page.getByRole('heading', { name: '设备管理' })).toBeVisible();

  await page.getByRole('button', { name: /新\s*建\s*设\s*备/ }).click();
  await expect(page.locator('[data-testid="device-modal"]')).toBeVisible();

  await page.locator('[data-testid="device-name-input"]').fill('E2E Serial Conflict Device');
  await page.locator('[data-testid="device-type-select"]').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: '服务器' }).click();
  await page.locator('[data-testid="device-serialno-input"]').fill('SN-WEB-001');
  await page.locator('[data-testid="device-cabinet-select"]').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: '北京数据中心 - A区机房 - A-01' }).click();
  await page.locator('[data-testid="device-uposition-input"]').fill('20');
  await page.locator('[data-testid="device-uheight-input"]').fill('1');
  await page.getByRole('button', { name: /保\s*存/ }).click();

  await expect(page.locator('[data-testid="device-modal"]')).toBeVisible();
  await expect(page.locator('[data-testid="device-form"] .ant-form-item-explain-error')).toContainText('serialNo already exists');
});
