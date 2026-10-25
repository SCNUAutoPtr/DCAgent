import { expect, test } from './helpers/test';
import { createHierarchy, display, nextLabel, resolveLabel, rpc, uniq } from './helpers/api';
import type { DataCenterDto, RoomDto } from '@contracts/hierarchy';
import type { DeviceDto } from '@contracts/devices';

test('edits a room and binds a label to it', async ({ page, request }) => {
  const dc = await rpc<DataCenterDto>(request, 'datacenters/create', { name: uniq('dc') });
  const room = await rpc<RoomDto>(request, 'rooms/create', { dataCenterId: dc.id, name: uniq('room') });
  const label = await nextLabel(request);

  await page.goto('/rooms');
  await expect(page.getByRole('heading', { name: '机房列表' })).toBeVisible();
  const row = page.locator('tr', { hasText: room.name });
  await row.getByRole('button', { name: /编\s*辑/ }).click();
  await expect(page.getByTestId('room-modal')).toBeVisible();

  const input = page.getByTestId('room-shortid-input');
  await input.fill(display(label));
  await input.blur();
  await page.getByTestId('room-floor-input').fill('3F');
  await page.getByRole('button', { name: /保\s*存/ }).click();

  await expect(page.locator('.ant-message-notice', { hasText: '机房更新成功' })).toBeVisible();
  await expect(row).toContainText(display(label));
  await expect(row).toContainText('3F');
  const r = await resolveLabel(request, label);
  expect(r.bound).toMatchObject({ kind: 'ROOM', id: room.id });
});

test('moves a cabinet to another room', async ({ page, request }) => {
  const h = await createHierarchy(request);
  const target = await rpc<RoomDto>(request, 'rooms/create', { dataCenterId: h.dc.id, name: uniq('room') });

  await page.goto('/cabinets');
  await expect(page.getByRole('heading', { name: '机柜列表' })).toBeVisible();
  const row = page.locator('tr', { hasText: h.cabinet.name });
  await expect(row).toContainText(h.room.name);
  await row.getByRole('button', { name: /编\s*辑/ }).click();
  await expect(page.getByTestId('cabinet-modal')).toBeVisible();

  await page.getByTestId('cabinet-room-select').click();
  await page.locator('.ant-select-item-option-content').filter({ hasText: `${h.dc.name} - ${target.name}` }).click();
  await page.getByRole('button', { name: /保\s*存/ }).click();

  await expect(page.locator('.ant-message-notice', { hasText: '机柜更新成功' })).toBeVisible();
  await expect(row).toContainText(target.name);
});

test.describe('conflicts', () => {
    // the browser logs the 409 of the refused request itself
    test.use({ allowedConsole: [/status of 409/] });

  test('a duplicate serial number is refused with the translated error', async ({ page, request }) => {
    const h = await createHierarchy(request);
    const serialNo = uniq('sn');
    await rpc<DeviceDto>(request, 'devices/create', { name: uniq('srv'), type: 'SERVER', cabinetId: h.cabinet.id, uPosition: 10, serialNo });

    await page.goto('/devices');
    await expect(page.getByRole('heading', { name: '设备管理' })).toBeVisible();
    await page.getByRole('button', { name: /新\s*建\s*设\s*备/ }).click();
    await expect(page.getByTestId('device-modal')).toBeVisible();

    await page.getByTestId('device-name-input').fill(uniq('srv'));
    await page.getByTestId('device-type-select').click();
    await page.locator('.ant-select-item-option-content').filter({ hasText: '服务器' }).click();
    await page.getByTestId('device-serialno-input').fill(serialNo);
    await page.getByTestId('device-cabinet-select').click();
    await page.locator('.ant-select-item-option-content').filter({ hasText: h.cabinet.name }).click();
    await page.getByTestId('device-uposition-input').fill('20');
    await page.getByRole('button', { name: /保\s*存/ }).click();

    await expect(page.locator('.ant-message-notice', { hasText: '已存在相同的记录' })).toBeVisible();
    await expect(page.getByTestId('device-modal')).toBeVisible();
  });
});
