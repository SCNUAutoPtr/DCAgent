import { test, expect } from '@playwright/test';
import { preparePage } from './helpers/setup';

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

test('persists room data center migration', async ({ page }) => {
  await page.goto('/rooms');

  await expect(page.getByRole('heading', { name: '机房列表' })).toBeVisible();

  const roomRow = page.locator('tr', { hasText: 'A区机房' });
  await expect(roomRow).toBeVisible();
  await expect(roomRow).toContainText('北京数据中心');

  await roomRow.getByRole('button', { name: /编\s*辑/ }).click();
  // 等待 modal 出现
  await expect(page.locator('[data-testid="room-modal"]')).toBeVisible();

  // 填写 ShortID（必填项，用 blur 触发校验）
  const shortIdInput = page.locator('[data-testid="room-shortid-input"]');
  await shortIdInput.clear();
  await shortIdInput.fill('E-99901');
  await shortIdInput.blur();
  // 等待异步校验完成
  await page.waitForTimeout(1000);

  // 切换数据中心
  await page.locator('[data-testid="room-datacenter-select"]').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: '上海数据中心' }).click();

  await page.getByRole('button', { name: /保\s*存/ }).click();

  await expect(page.locator('.ant-message-notice')).toContainText('机房更新成功');
  await expect(roomRow).toContainText('上海数据中心');
});
