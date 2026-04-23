import { test, expect } from '@playwright/test';
import { preparePage } from './helpers/setup';

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

test('persists cabinet room migration', async ({ page }) => {
  await page.goto('/cabinets');

  await expect(page.getByRole('heading', { name: '机柜列表' })).toBeVisible();

  // 机柜页默认可能显示可视化视图，需要先切换到列表 Tab
  const listTab = page.locator('.ant-tabs-tab').filter({ hasText: '机柜列表' });
  await listTab.click();
  await page.waitForTimeout(500);

  const cabinetRow = page.locator('tr', { hasText: 'B-01' });
  await expect(cabinetRow).toBeVisible();
  await expect(cabinetRow).toContainText('北京数据中心');
  await expect(cabinetRow).toContainText('B区机房');

  await cabinetRow.getByRole('button', { name: /编\s*辑/ }).click();
  await expect(page.locator('[data-testid="cabinet-modal"]')).toBeVisible();

  // 填写 ShortID（必填项，用 blur 触发校验）
  const shortIdInput = page.locator('[data-testid="cabinet-shortid-input"]');
  await shortIdInput.clear();
  await shortIdInput.fill('E-10002');
  await shortIdInput.blur();
  // 等待异步校验完成
  await page.waitForTimeout(1000);

  // 切换所属机房
  await page.locator('[data-testid="cabinet-room-select"]').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: '上海数据中心 - C区机房' }).click();

  await page.getByRole('button', { name: /保\s*存/ }).click();

  await expect(page.locator('.ant-message-notice')).toContainText('机柜更新成功');
  await expect(cabinetRow).toContainText('上海数据中心');
  await expect(cabinetRow).toContainText('C区机房');
});
