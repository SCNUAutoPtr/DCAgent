import type { Page } from '@playwright/test';
import { expect, test } from './helpers/test';
import { createHierarchy, display, nextLabel, uniq, type Hierarchy } from './helpers/api';

let h: Hierarchy;

test.beforeEach(async ({ request }) => {
  // a 10 m x 8 m room with one cabinet that has no position yet
  h = await createHierarchy(request, { room: { widthM: 10, depthM: 8 } });
});

const openFloorPlan = async (page: Page) => {
  // the room list is paged: narrow it to this room first
  await page.getByPlaceholder('搜索机房名称').fill(h.room.name);
  await page.getByPlaceholder('搜索机房名称').press('Enter');
  const row = page.locator('tr', { hasText: h.room.name });
  await expect(row).toBeVisible();
  await row.getByRole('button', { name: /平\s*面\s*图/ }).click();
  await expect(page.getByTestId('floor-plan-editor')).toBeVisible();
};

const closeFloorPlan = async (page: Page) => {
  await page.locator('.ant-modal', { has: page.getByTestId('floor-plan-editor') }).locator('.ant-modal-close').click();
  await expect(page.getByTestId('floor-plan-editor')).toBeHidden();
};

const dragBy = async (page: Page, testId: string, dx: number, dy: number) => {
  // hover waits until the element is stable, i.e. the modal finished its opening animation
  await page.getByTestId(testId).hover();
  const box = await page.getByTestId(testId).boundingBox();
  if (!box) throw new Error(`${testId} has no bounding box`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + dx, box.y + box.height / 2 + dy, { steps: 10 });
  await page.mouse.up();
};

test('saves a cabinet position and the room size', async ({ page }) => {
  const cabinetId = `floor-plan-cabinet-${h.cabinet.id}`;
  await page.goto('/rooms');
  await openFloorPlan(page);
  await page.getByTestId('floor-plan-edit').click();

  const width = page.locator('input[data-testid="floor-plan-width"], [data-testid="floor-plan-width"] input');
  await width.fill('12');
  await width.blur();

  const cabinet = page.getByTestId(cabinetId);
  const originalX = await cabinet.getAttribute('data-x');
  await dragBy(page, cabinetId, 100, 50);
  const movedX = await cabinet.getAttribute('data-x');
  expect(movedX).not.toBe(originalX);

  await page.getByTestId('floor-plan-save').click();
  await expect(page.locator('.ant-message-notice', { hasText: '保存成功' })).toBeVisible();

  await closeFloorPlan(page);
  await openFloorPlan(page);
  await expect(page.getByTestId(cabinetId)).toHaveAttribute('data-x', movedX!);
  await expect(page.getByTestId('floor-plan-editor')).toContainText('12 × 8');
});

test('cancel restores positions and room size', async ({ page }) => {
  const cabinetId = `floor-plan-cabinet-${h.cabinet.id}`;
  await page.goto('/rooms');
  await openFloorPlan(page);
  await page.getByTestId('floor-plan-edit').click();

  const width = page.locator('input[data-testid="floor-plan-width"], [data-testid="floor-plan-width"] input');
  await width.fill('20');
  await width.blur();

  const cabinet = page.getByTestId(cabinetId);
  const originalX = await cabinet.getAttribute('data-x');
  await dragBy(page, cabinetId, 80, 0);
  expect(await cabinet.getAttribute('data-x')).not.toBe(originalX);

  await page.getByTestId('floor-plan-cancel').click();
  await expect(cabinet).toHaveAttribute('data-x', originalX!);
  await expect(page.getByTestId('floor-plan-editor')).toContainText('10 × 8');
});

test('keeps objects inside the room when dragged past the wall', async ({ page }) => {
  const cabinetId = `floor-plan-cabinet-${h.cabinet.id}`;
  await page.goto('/rooms');
  await openFloorPlan(page);
  await page.getByTestId('floor-plan-edit').click();

  // zoom out to 50% so the whole room fits and the mouse can reach the right wall
  const zoomOut = page.getByTestId('floor-plan-zoom-out');
  for (let i = 0; i < 6; i += 1) await zoomOut.click();
  await expect(page.getByTestId('floor-plan-editor')).toContainText('50%');

  await page.getByTestId(cabinetId).hover();
  const box = await page.getByTestId(cabinetId).boundingBox();
  const canvas = await page.getByTestId('floor-plan-canvas').boundingBox();
  if (!box || !canvas) throw new Error('missing bounding box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(canvas.x + canvas.width + 200, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();

  // 10 m room, 0.6 m wide cabinet: the right edge stops at 9.4 m
  await expect(page.getByTestId(cabinetId)).toHaveAttribute('data-x', '9.4');
});

test('the inspector shows the selected cabinet', async ({ page }) => {
  await page.goto('/rooms');
  await openFloorPlan(page);
  const inspector = page.getByTestId('floor-plan-inspector');
  await expect(inspector).toContainText('机房概览');
  await expect(page.getByTestId('floor-plan-new-cabinet')).toBeVisible();

  await page.getByTestId(`floor-plan-cabinet-${h.cabinet.id}`).click();
  await expect(inspector).toContainText(h.cabinet.name);
  await expect(inspector).toContainText('位置');
  await expect(inspector).toContainText('设备');
});

test('creates a cabinet from the inspector in a free slot', async ({ page, request }) => {
  await page.goto('/rooms');
  await openFloorPlan(page);
  const cabinets = page.locator('[data-testid^="floor-plan-cabinet-"]');
  const before = await cabinets.count();

  await page.getByTestId('floor-plan-new-cabinet').click();
  await page.getByLabel('机柜名称').fill(uniq('cab'));
  await page.getByLabel('ShortID').fill(display(await nextLabel(request)));
  await page.getByTestId('floor-plan-create-submit').click();

  await expect(page.locator('.ant-message-notice', { hasText: '机柜创建成功' })).toBeVisible();
  await expect(cabinets).toHaveCount(before + 1);
  const positions = await cabinets.evaluateAll((nodes) => nodes.map((n) => `${n.getAttribute('data-x')},${n.getAttribute('data-y')}`));
  expect(new Set(positions).size).toBe(positions.length);
});
