import { test, expect, Page } from '@playwright/test';
import { preparePage } from './helpers/setup';

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

const openFloorPlan = async (page: Page) => {
  const roomRow = page.locator('tr', { hasText: 'A区机房' });
  await expect(roomRow).toBeVisible();
  await roomRow.getByRole('button', { name: /平\s*面\s*图/ }).click();
  await expect(page.locator('[data-testid="floor-plan-editor"]')).toBeVisible();
};

const closeFloorPlan = async (page: Page) => {
  await page.locator('.ant-modal-close').click();
  await expect(page.locator('[data-testid="floor-plan-editor"]')).toBeHidden();
};

test('persists cabinet position and room size from the floor plan editor', async ({ page }) => {
  await page.goto('/rooms');
  await openFloorPlan(page);

  await page.locator('[data-testid="floor-plan-edit"]').click();

  // 改机房尺寸（工具栏内联输入，不再是二级弹窗）
  const widthInput = page.locator('[data-testid="floor-plan-width"] input');
  await widthInput.fill('12');
  await widthInput.blur();

  // 拖动第一个机柜
  const cabinet = page.locator('[data-testid^="floor-plan-cabinet-"]').first();
  await expect(cabinet).toBeVisible();
  const cabinetId = await cabinet.getAttribute('data-testid');
  const originalX = await cabinet.getAttribute('data-x');

  const box = await cabinet.boundingBox();
  if (!box) throw new Error('cabinet has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50, { steps: 10 });
  await page.mouse.up();

  const movedX = await cabinet.getAttribute('data-x');
  expect(movedX).not.toBe(originalX);

  await page.locator('[data-testid="floor-plan-save"]').click();
  await expect(page.locator('.ant-message-notice')).toContainText('保存成功');

  // 重新打开确认落库
  await closeFloorPlan(page);
  await openFloorPlan(page);

  await expect(page.locator(`[data-testid="${cabinetId}"]`)).toHaveAttribute('data-x', movedX!);
  await expect(page.locator('[data-testid="floor-plan-editor"]')).toContainText('12 × 8');
});

test('cancel restores positions and room size', async ({ page }) => {
  await page.goto('/rooms');
  await openFloorPlan(page);

  await page.locator('[data-testid="floor-plan-edit"]').click();

  const widthInput = page.locator('[data-testid="floor-plan-width"] input');
  await widthInput.fill('20');
  await widthInput.blur();

  const cabinet = page.locator('[data-testid^="floor-plan-cabinet-"]').first();
  const originalX = await cabinet.getAttribute('data-x');
  const box = await cabinet.boundingBox();
  if (!box) throw new Error('cabinet has no bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  expect(await cabinet.getAttribute('data-x')).not.toBe(originalX);

  await page.locator('[data-testid="floor-plan-cancel"]').click();

  await expect(cabinet).toHaveAttribute('data-x', originalX!);
  await expect(page.locator('[data-testid="floor-plan-editor"]')).toContainText('10 × 8');
});

test('keeps objects inside the room when dragged past the wall', async ({ page }) => {
  await page.goto('/rooms');
  await openFloorPlan(page);

  await page.locator('[data-testid="floor-plan-edit"]').click();

  // 默认 200%，缩到 50% 让整间机房都落在可视区内，鼠标才够得到右墙
  const zoomOut = page.locator('[data-testid="floor-plan-zoom-out"]');
  for (let i = 0; i < 6; i += 1) {
    await zoomOut.click();
  }
  await expect(page.locator('[data-testid="floor-plan-editor"]')).toContainText('50%');

  const cabinet = page.locator('[data-testid^="floor-plan-cabinet-"]').first();
  const canvas = page.locator('[data-testid="floor-plan-canvas"]');
  const box = await cabinet.boundingBox();
  const canvasBox = await canvas.boundingBox();
  if (!box || !canvasBox) throw new Error('missing bounding box');

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvasBox.x + canvasBox.width + 200, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  // 机房宽 10m，机柜宽 0.6m，右边界应为 9.4m 而不是写死的 9m
  await expect(cabinet).toHaveAttribute('data-x', '9.4');
});

test('inspector shows metadata and device preview for the selected cabinet', async ({ page }) => {
  await page.goto('/rooms');
  await openFloorPlan(page);

  const inspector = page.locator('[data-testid="floor-plan-inspector"]');
  // 未选中时是机房概览 + 新建入口
  await expect(inspector).toContainText('机房概览');
  await expect(page.locator('[data-testid="floor-plan-new-cabinet"]')).toBeVisible();

  await page.locator('[data-testid^="floor-plan-cabinet-"]').first().click();

  await expect(inspector).toContainText('A-01');
  await expect(inspector).toContainText('位置');
  await expect(inspector).toContainText('设备');
});

test('creates a cabinet from the inspector and places it in a free slot', async ({ page }) => {
  await page.goto('/rooms');
  await openFloorPlan(page);

  const cabinets = page.locator('[data-testid^="floor-plan-cabinet-"]');
  const before = await cabinets.count();

  await page.locator('[data-testid="floor-plan-new-cabinet"]').click();
  await page.getByLabel('机柜名称').fill('A-99');
  await page.getByLabel('ShortID').fill('E-99991');
  await page.locator('[data-testid="floor-plan-create-submit"]').click();

  await expect(page.locator('.ant-message-notice')).toContainText('机柜创建成功');
  await expect(cabinets).toHaveCount(before + 1);

  // 新机柜落在空位上，不和任何已有对象重叠
  const positions = await cabinets.evaluateAll((nodes) =>
    nodes.map((node) => `${node.getAttribute('data-x')},${node.getAttribute('data-y')}`)
  );
  expect(new Set(positions).size).toBe(positions.length);
});
