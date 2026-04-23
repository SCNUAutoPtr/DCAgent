import { test, expect } from '@playwright/test';
import { preparePage } from './helpers/setup';
import { apiCreatePanel, apiCreatePort, apiDeletePanel, apiGetDeviceByName } from './helpers/api';

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

test('shows panel layout ports in device panel editor', async ({ page, request }) => {
  const device = await apiGetDeviceByName(request, 'WEB-Server-01');
  expect(device, '需要 seed 中存在设备 WEB-Server-01').not.toBeNull();

  const panel = await apiCreatePanel(request, {
    deviceId: device!.id,
    name: 'E2E-Layout-Panel',
    type: 'NETWORK',
    shortId: 70011,
  });
  await apiCreatePort(request, {
    panelId: panel.id,
    number: '1',
    label: 'Port-1',
    portType: 'RJ45',
    position: { x: 40, y: 12 },
    size: { width: 18, height: 12 },
  });
  await apiCreatePort(request, {
    panelId: panel.id,
    number: '2',
    label: 'Port-2',
    portType: 'RJ45',
    position: { x: 80, y: 12 },
    size: { width: 18, height: 12 },
  });
  await apiCreatePort(request, {
    panelId: panel.id,
    number: '3',
    label: 'Port-3',
    portType: 'RJ45',
    position: { x: 120, y: 12 },
    size: { width: 18, height: 12 },
  });
  await apiCreatePort(request, {
    panelId: panel.id,
    number: '4',
    label: 'Port-4',
    portType: 'RJ45',
    position: { x: 160, y: 12 },
    size: { width: 18, height: 12 },
  });

  try {
    await page.goto('/cabinets');
    await expect(page.getByRole('heading', { name: '机柜列表' })).toBeVisible();

    const listTab = page.locator('.ant-tabs-tab').filter({ hasText: '机柜列表' });
    await listTab.click();

    const cabinetRow = page.locator('tr', { hasText: 'A-01' });
    await expect(cabinetRow).toBeVisible();
    await cabinetRow.locator('[data-testid="cabinet-view-btn"]').click();

    const panelEditorLaunchers = page.locator('[data-testid="cabinet-device-panel-btn"]');
    const matchingLauncher = panelEditorLaunchers.nth(0);
    await expect(matchingLauncher).toBeVisible();

    const targetRow = page.locator('li').filter({ hasText: device!.name });
    await targetRow.locator('[data-testid="cabinet-device-panel-btn"]').click();

    await expect(page.locator('[data-testid="device-panel-editor-modal"]')).toBeVisible();
  } finally {
    await apiDeletePanel(request, panel.id);
  }
});
