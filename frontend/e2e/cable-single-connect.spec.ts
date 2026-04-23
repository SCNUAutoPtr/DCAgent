import { test, expect } from '@playwright/test';
import { preparePage } from './helpers/setup';
import {
  apiCreatePanel,
  apiCreatePort,
  apiDeletePanel,
  apiGetDeviceByName,
} from './helpers/api';

test.beforeEach(async ({ page }) => {
  await preparePage(page);
});

test('prepares single-end cable connection form with selected panel and port', async ({ page, request }) => {
  const device = await apiGetDeviceByName(request, 'WEB-Server-01');
  expect(device).not.toBeNull();

  const panel = await apiCreatePanel(request, {
    deviceId: device!.id,
    name: 'E2E-Single-Cable-Panel',
    type: 'NETWORK',
    shortId: 70014,
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

  try {
    await page.goto('http://localhost:5173/topology');
    await page.locator('[data-testid="topology-create-cable-btn"]').click();
    await expect(page.locator('[data-testid="create-cable-modal"]')).toBeVisible();

    await page.locator('[data-testid="cable-tab-single"]').click();
    await expect(page.locator('[data-testid="cable-single-mode"]')).toBeVisible();
    await page.locator('[data-testid="cable-single-panel-scan-input"]').fill('E-70014');
    await page.locator('[data-testid="cable-single-panel-scan-input"]').blur();

    await expect(page.locator('[data-testid="panel-visualizer"]')).toBeVisible();
    await page.locator('[data-testid="panel-port-hitbox-1"]').click({ force: true });

    const plugInput = page.locator('[data-testid="cable-single-shortid-input"]');
    await plugInput.fill('E-70030');
    await plugInput.blur();

    await expect(page.locator('[data-testid="cable-submit-btn"]')).toBeEnabled();
    await expect(page.locator('[data-testid="cable-single-mode"]')).toContainText('已选择: 1');
    await expect(page.locator('[data-testid="cable-single-mode"]')).toContainText('已录入：E-70030');
  } finally {
    try {
      await apiDeletePanel(request, panel.id);
    } catch {
    }
  }
});
